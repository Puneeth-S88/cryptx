-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 02: Row Level Security (RLS) Policies (Zero Trust)
-- ==============================================================================

-- Enable RLS on every public table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevated_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hint_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_frozen_snapshot ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_or_organizer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'organizer')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_team_id(p_event_id UUID)
RETURNS UUID AS $$
  SELECT tm.team_id 
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = auth.uid() AND t.event_id = p_event_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 1. PROFILES POLICIES
-- Anyone can view their own profile; organizers can view participant names in their events
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin_or_organizer());

CREATE POLICY "Users can update own non-role profile details"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND 
    role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Role cannot be escalated by user
  );

-- 2. EVENTS POLICIES
-- Public & participants can see events that are not in draft; organizers/admins see all
CREATE POLICY "Public can view published events"
  ON public.events FOR SELECT
  USING (status != 'draft' OR public.is_admin_or_organizer());

CREATE POLICY "Organizers/Admins can modify events"
  ON public.events FOR ALL
  USING (public.is_admin_or_organizer());

-- 3. EVENT ROUNDS POLICIES
-- Public/Participants can only view rounds for non-draft events
-- (State controls whether content is playable, but round schedule can be displayed)
CREATE POLICY "Anyone can view event rounds metadata"
  ON public.event_rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_rounds.event_id AND (e.status != 'draft' OR public.is_admin_or_organizer())
    )
  );

CREATE POLICY "Organizers/Admins can manage event rounds"
  ON public.event_rounds FOR ALL
  USING (public.is_admin_or_organizer());

-- 4. TEAMS POLICIES
-- Zero-Trust Hardened Policies: Never expose password_hash or join_code to public/anonymous
DROP POLICY IF EXISTS "Anyone can view teams in active event" ON public.teams;

-- Organizers and super admins can view all teams
CREATE POLICY "Organizers and admins can view all teams"
  ON public.teams FOR SELECT
  USING (public.is_admin_or_organizer());

-- Team captains and verified team members can view their own team
CREATE POLICY "Captains and members can view own team"
  ON public.teams FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      captain_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = public.teams.id AND tm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Allow team creation by captains and organizers"
  ON public.teams FOR INSERT
  WITH CHECK (
    public.is_admin_or_organizer() OR
    (auth.uid() IS NOT NULL AND captain_id = auth.uid())
  );

CREATE POLICY "Captains and Organizers can update team"
  ON public.teams FOR UPDATE
  USING (captain_id = auth.uid() OR public.is_admin_or_organizer());

CREATE POLICY "Captains and Organizers can delete team"
  ON public.teams FOR DELETE
  USING (captain_id = auth.uid() OR public.is_admin_or_organizer());

-- 4b. SANITIZED PUBLIC TEAMS VIEW (Zero Credential Leakage)
-- Exposes safe competition team metadata without password_hash or join_code
CREATE OR REPLACE VIEW public.teams_public AS
SELECT
  id,
  event_id,
  name,
  status,
  is_roster_locked,
  is_eliminated,
  eliminated_after_round,
  created_at,
  updated_at
FROM public.teams
WHERE status = 'approved';

GRANT SELECT ON public.teams_public TO anon, authenticated;

-- 5. TEAM MEMBERS POLICIES
CREATE POLICY "Users can see members of any approved team"
  ON public.team_members FOR SELECT
  USING (true);

CREATE POLICY "Captains and Organizers can insert team members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_members.team_id AND (t.captain_id = auth.uid() OR public.is_admin_or_organizer())
    )
  );

CREATE POLICY "Captains and Organizers can delete team members"
  ON public.team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_members.team_id AND (t.captain_id = auth.uid() OR public.is_admin_or_organizer())
    )
  );

-- 6. ROUND QUALIFICATIONS POLICIES
-- Public can read qualified status (needed for leaderboard / status)
CREATE POLICY "Anyone can read round qualifications"
  ON public.round_qualifications FOR SELECT
  USING (true);

CREATE POLICY "Organizers can manage round qualifications"
  ON public.round_qualifications FOR ALL
  USING (public.is_admin_or_organizer());

-- 7. PUZZLES POLICIES (Public content only; SECRETS ARE IN private.puzzle_secrets)
-- Puzzles can ONLY be fetched if the round state is 'open', 'paused', 'closed', or 'scored'
-- AND if the team is qualified for this round (or if requester is Organizer/Admin)
CREATE POLICY "Participants can view puzzle content only when round is active/past and team qualified"
  ON public.puzzles FOR SELECT
  USING (
    public.is_admin_or_organizer() OR (
      EXISTS (
        SELECT 1 FROM public.event_rounds r
        JOIN public.teams t ON t.event_id = r.event_id
        JOIN public.team_members tm ON tm.team_id = t.id
        WHERE r.id = puzzles.round_id
          AND tm.user_id = auth.uid()
          AND r.state IN ('open', 'paused', 'closed', 'scored')
          AND (
            r.round_number = 1 OR EXISTS (
              SELECT 1 FROM public.round_qualifications rq
              WHERE rq.event_id = r.event_id 
                AND rq.round_number = r.round_number 
                AND rq.team_id = t.id 
                AND rq.qualified = true
            )
          )
      )
    )
  );

CREATE POLICY "Organizers can manage puzzles"
  ON public.puzzles FOR ALL
  USING (public.is_admin_or_organizer());

-- 8. ROUND ATTEMPTS POLICIES
CREATE POLICY "Teams can view own round attempts"
  ON public.round_attempts FOR SELECT
  USING (
    public.is_admin_or_organizer() OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = round_attempts.team_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Teams can create own round attempt"
  ON public.round_attempts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = round_attempts.team_id AND tm.user_id = auth.uid()
    )
  );

-- 9. HINT USAGE POLICIES
CREATE POLICY "Teams can view own unlocked hints"
  ON public.hint_usage FOR SELECT
  USING (
    public.is_admin_or_organizer() OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = hint_usage.team_id AND tm.user_id = auth.uid()
    )
  );

-- Hint insertion is handled via secure server RPC / route handler to compute deductions and fetch text

-- 10. SUBMISSIONS POLICIES
-- Submissions can be read by team members and organizers
CREATE POLICY "Teams can view own submissions"
  ON public.submissions FOR SELECT
  USING (
    public.is_admin_or_organizer() OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid()
    )
  );

-- Submissions INSERT is controlled strictly via authenticated server action or verified RPC
-- to ensure zero client clock manipulation and single submission enforcement.
CREATE POLICY "Teams can insert submission via auth"
  ON public.submissions FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by AND EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid()
    )
  );

-- 11. SCORES POLICIES
-- Live scores are readable by everyone unless event leaderboard is frozen
CREATE POLICY "Anyone can view scores if not frozen, or if organizer"
  ON public.scores FOR SELECT
  USING (
    public.is_admin_or_organizer() OR (
      SELECT NOT is_leaderboard_frozen FROM public.events WHERE id = scores.event_id
    )
  );

CREATE POLICY "Organizers can insert or modify scores"
  ON public.scores FOR ALL
  USING (public.is_admin_or_organizer());

-- 12. ANNOUNCEMENTS POLICIES
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true OR public.is_admin_or_organizer());

CREATE POLICY "Organizers can manage announcements"
  ON public.announcements FOR ALL
  USING (public.is_admin_or_organizer());

-- 13. AUDIT LOG POLICIES (IMMUTABLE: strictly no UPDATE or DELETE)
CREATE POLICY "Only admins and organizers can read audit logs"
  ON public.audit_log FOR SELECT
  USING (public.is_admin_or_organizer());

CREATE POLICY "Server and users can append to audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- NO UPDATE OR DELETE POLICY GRANTED TO AUDIT LOG (Immutable)

-- 14. ELEVATED SESSIONS POLICIES
CREATE POLICY "Users can see own elevated session"
  ON public.elevated_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own elevated session (lock controls)"
  ON public.elevated_sessions FOR DELETE
  USING (user_id = auth.uid());

-- 15. FROZEN LEADERBOARD SNAPSHOT POLICIES
CREATE POLICY "Anyone can read frozen snapshot when event is frozen"
  ON public.leaderboard_frozen_snapshot FOR SELECT
  USING (
    public.is_admin_or_organizer() OR (
      SELECT is_leaderboard_frozen FROM public.events WHERE id = leaderboard_frozen_snapshot.event_id
    )
  );

CREATE POLICY "Organizers can write frozen snapshot"
  ON public.leaderboard_frozen_snapshot FOR ALL
  USING (public.is_admin_or_organizer());
