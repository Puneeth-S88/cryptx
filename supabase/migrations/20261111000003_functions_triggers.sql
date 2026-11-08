-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 03: Triggers, Constraints & Secure RPCs
-- ==============================================================================

-- 1. Automatic updated_at Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_event_rounds_updated_at
  BEFORE UPDATE ON public.event_rounds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_scores_updated_at
  BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Team Capacity & Max Members Check Triggers
CREATE OR REPLACE FUNCTION public.check_team_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_max_members INT;
  v_current_count INT;
  v_is_locked BOOLEAN;
BEGIN
  SELECT e.max_members_per_team, t.is_roster_locked
  INTO v_max_members, v_is_locked
  FROM public.teams t
  JOIN public.events e ON e.id = t.event_id
  WHERE t.id = NEW.team_id;

  IF v_is_locked THEN
    RAISE EXCEPTION 'Cannot add members: Team roster is locked by captain.';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.team_members
  WHERE team_id = NEW.team_id;

  IF v_current_count >= v_max_members THEN
    RAISE EXCEPTION 'Team capacity exceeded. Maximum % members allowed.', v_max_members;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_limits
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.check_team_limits();

-- 3. One Team Per User Per Event Constraint Trigger
CREATE OR REPLACE FUNCTION public.check_one_team_per_user_per_event()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id UUID;
  v_already_joined BOOLEAN;
BEGIN
  SELECT event_id INTO v_event_id FROM public.teams WHERE id = NEW.team_id;

  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.event_id = v_event_id AND tm.user_id = NEW.user_id
  ) INTO v_already_joined;

  IF v_already_joined THEN
    RAISE EXCEPTION 'User has already joined a team in this event.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_one_team_per_event
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.check_one_team_per_user_per_event();

-- 4. New User Profile Auto-Creation Trigger from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'participant'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger on auth.users (Standard Supabase pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN OTHERS THEN
  -- In case running outside Supabase superuser context, ignore trigger error
  NULL;
END;
$$;

-- 5. Safe Read-Only Public Leaderboard View
-- Calculates tie-break order:
-- 1. Total score (DESC)
-- 2. Final round marks (DESC)
-- 3. Previous round marks (DESC)
-- 4. Final submission time (ASC)
CREATE OR REPLACE VIEW public.leaderboard_live AS
WITH round_scores AS (
  SELECT 
    s.team_id,
    s.event_id,
    s.round_number,
    s.final_points,
    s.final_submitted_at
  FROM public.scores s
),
team_totals AS (
  SELECT
    t.id AS team_id,
    t.event_id,
    t.name AS team_name,
    t.is_eliminated,
    t.eliminated_after_round,
    COALESCE(SUM(s.final_points), 0)::INT AS total_score,
    COALESCE(MAX(CASE WHEN s.round_number = (
      SELECT MAX(round_number) FROM public.event_rounds WHERE event_id = t.event_id AND state IN ('closed', 'scored')
    ) THEN s.final_points ELSE 0 END), 0) AS latest_round_score,
    MAX(s.final_submitted_at) AS last_submission_time,
    jsonb_object_agg(
      COALESCE(s.round_number::text, '0'),
      jsonb_build_object(
        'points', COALESCE(s.final_points, 0)
      )
    ) FILTER (WHERE s.round_number IS NOT NULL) AS per_round_scores
  FROM public.teams t
  LEFT JOIN public.scores s ON s.team_id = t.id
  WHERE t.status = 'approved'
  GROUP BY t.id, t.event_id, t.name, t.is_eliminated, t.eliminated_after_round
)
SELECT
  tt.team_id,
  tt.event_id,
  tt.team_name,
  tt.total_score,
  tt.latest_round_score,
  tt.per_round_scores,
  tt.is_eliminated,
  tt.eliminated_after_round,
  tt.last_submission_time,
  DENSE_RANK() OVER (
    PARTITION BY tt.event_id 
    ORDER BY 
      tt.total_score DESC, 
      tt.latest_round_score DESC, 
      tt.last_submission_time ASC NULLS LAST,
      tt.team_name ASC
  ) AS rank
FROM team_totals tt;

-- 6. SECURITY DEFINER RPC: Fetch Active Leaderboard Safely
-- Returns either live leaderboard or frozen snapshot depending on event is_leaderboard_frozen
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_event_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_frozen BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT is_leaderboard_frozen INTO v_is_frozen
  FROM public.events WHERE id = p_event_id;

  IF v_is_frozen THEN
    SELECT snapshot_data INTO v_result
    FROM public.leaderboard_frozen_snapshot
    WHERE event_id = p_event_id
    ORDER BY frozen_at DESC
    LIMIT 1;

    IF v_result IS NOT NULL THEN
      RETURN jsonb_build_object(
        'frozen', true,
        'leaderboard', v_result
      );
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'frozen', false,
    'leaderboard', COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT 
      rank,
      team_id,
      team_name,
      total_score,
      latest_round_score,
      COALESCE(per_round_scores, '{}'::jsonb) AS per_round_scores,
      is_eliminated,
      eliminated_after_round
    FROM public.leaderboard_live
    WHERE event_id = p_event_id
    ORDER BY rank ASC
  ) l;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
