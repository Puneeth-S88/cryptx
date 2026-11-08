-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 01: Core Schemas, Enums & Tables
-- ==============================================================================

-- 1. Create Private Schema for Zero-Trust Secrets
CREATE SCHEMA IF NOT EXISTS private;

-- Restrict schema permissions: Public/Anon/Authenticated cannot see private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT ALL ON SCHEMA private TO postgres;
GRANT ALL ON SCHEMA private TO service_role;

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('super_admin', 'organizer', 'participant', 'public');
CREATE TYPE event_status AS ENUM ('draft', 'registration_open', 'live', 'paused', 'ended');
CREATE TYPE round_state AS ENUM ('locked', 'open', 'paused', 'closed', 'scored');
CREATE TYPE team_status AS ENUM ('pending', 'approved', 'waitlisted', 'rejected', 'disqualified');
CREATE TYPE puzzle_type AS ENUM (
  'mcq',
  'method_cipher',
  'polybius_grid',
  'drag_scramble',
  'memory_cipher',
  'cipher_auction',
  'colour_cipher',
  'vigenere_analysis',
  'manual_jury'
);

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'participant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT 'CRYPTEX 2026',
  tagline TEXT NOT NULL DEFAULT 'The Ultimate Cryptography Championship',
  description TEXT NOT NULL DEFAULT 'Crack. Decode. Conquer.',
  date_start TIMESTAMPTZ NOT NULL DEFAULT '2026-11-11 14:00:00+05:30',
  date_end TIMESTAMPTZ NOT NULL DEFAULT '2026-11-11 16:00:00+05:30',
  venue TEXT NOT NULL DEFAULT 'DFL04',
  max_teams INT NOT NULL DEFAULT 15,
  max_members_per_team INT NOT NULL DEFAULT 4,
  min_members_per_team INT NOT NULL DEFAULT 1,
  fee_inr INT NOT NULL DEFAULT 200,
  status event_status NOT NULL DEFAULT 'draft',
  is_leaderboard_frozen BOOLEAN NOT NULL DEFAULT false,
  student_coordinators TEXT[] NOT NULL DEFAULT ARRAY['Prajwal B U', 'Puneeth S'],
  faculty_coordinators TEXT[] NOT NULL DEFAULT ARRAY['Dr. Vijay Kumar AV', 'Ms. Soumya'],
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ORGANIZER CONTROL SECRETS (PRIVATE SCHEMA ONLY)
CREATE TABLE IF NOT EXISTS private.organizer_control_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, -- Salted bcrypt / argon2id hash
  salt TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_control_secret UNIQUE (event_id)
);

-- 6. ELEVATED SESSIONS (Temporary 10-minute organizer elevation)
CREATE TABLE IF NOT EXISTS public.elevated_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- 7. EVENT ROUNDS
CREATE TABLE IF NOT EXISTS public.event_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  puzzle_type puzzle_type NOT NULL,
  state round_state NOT NULL DEFAULT 'locked',
  duration_seconds INT NOT NULL DEFAULT 600,
  max_points INT NOT NULL DEFAULT 100,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  order_index INT NOT NULL,
  is_jury_scored BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_round_number UNIQUE (event_id, round_number)
);

-- 8. TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  captain_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  captain_name TEXT,
  captain_email TEXT,
  password_hash TEXT,
  status team_status NOT NULL DEFAULT 'approved',
  is_roster_locked BOOLEAN NOT NULL DEFAULT false,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  eliminated_after_round INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_team_name UNIQUE (event_id, name),
  CONSTRAINT uq_event_join_code UNIQUE (event_id, join_code)
);

-- 9. TEAM MEMBERS
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'captain' or 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);

-- 10. ROUND QUALIFICATIONS
CREATE TABLE IF NOT EXISTS public.round_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  qualified BOOLEAN NOT NULL DEFAULT true,
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_round_team_qualification UNIQUE (event_id, round_number, team_id)
);

-- 11. PUZZLES (Public / Participant Content without answers)
CREATE TABLE IF NOT EXISTS public.puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb, -- questions, scrambled letters, ciphertext, tiles (NO ANSWERS)
  max_hints INT NOT NULL DEFAULT 0,
  hint_penalty_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_round_puzzle UNIQUE (round_id)
);

-- 12. PUZZLE SECRETS (PRIVATE SCHEMA ONLY - Zero Client Visibility)
CREATE TABLE IF NOT EXISTS private.puzzle_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  solution_data JSONB NOT NULL, -- Answers, regex, substitution key maps, correct items
  hints JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of hints revealed sequentially
  jury_criteria JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_puzzle_secret UNIQUE (puzzle_id)
);

-- 13. ROUND ATTEMPTS & TIMERS
CREATE TABLE IF NOT EXISTS public.round_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  memory_revealed_at TIMESTAMPTZ, -- For Round 5 memory cipher one-time reveal
  memory_reveal_consumed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_round_team_attempt UNIQUE (round_id, team_id)
);

-- 14. HINT USAGE
CREATE TABLE IF NOT EXISTS public.hint_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  hint_index INT NOT NULL,
  hint_text TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  points_deducted INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_round_team_hint UNIQUE (round_id, team_id, hint_index)
);

-- 15. SUBMISSIONS (Immutable once submitted, exactly one submission per team per round)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  submission_payload JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  tab_switch_count INT NOT NULL DEFAULT 0,
  paste_event_count INT NOT NULL DEFAULT 0,
  is_late BOOLEAN NOT NULL DEFAULT false,
  score_awarded INT NOT NULL DEFAULT 0,
  scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_evaluated BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_round_team_submission UNIQUE (round_id, team_id)
);

-- 16. SCORES (Aggregated / Finalized Scoreboard Table)
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  bonus_points INT NOT NULL DEFAULT 0,
  penalty_points INT NOT NULL DEFAULT 0,
  final_points INT NOT NULL DEFAULT 0,
  manual_adjustment INT NOT NULL DEFAULT 0,
  adjustment_reason TEXT,
  adjusted_by UUID REFERENCES public.profiles(id),
  final_submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_team_round_score UNIQUE (event_id, team_id, round_id)
);

-- 17. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'urgent', 'alert'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. IMMUTABLE AUDIT LOG (Append-only, strictly no UPDATE or DELETE)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. FROZEN LEADERBOARD SNAPSHOT (Preserves ranks when organizer freezes view)
CREATE TABLE IF NOT EXISTS public.leaderboard_frozen_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  frozen_by UUID REFERENCES public.profiles(id)
);

-- Indexes for maximum performance under live concurrency
CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams(event_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rounds_event ON public.event_rounds(event_id, round_number);
CREATE INDEX IF NOT EXISTS idx_round_qualifications_lookup ON public.round_qualifications(event_id, round_number, team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_round_team ON public.submissions(round_id, team_id);
CREATE INDEX IF NOT EXISTS idx_scores_event_team ON public.scores(event_id, team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON public.audit_log(event_id, created_at DESC);
