-- ==============================================================================
-- CRYPTEX 2026 — Migration 07: Fix Teams RLS Policies for Organizers & Admin Ops
-- Ensures organizers and captains can insert and delete teams without violating RLS.
-- ==============================================================================

-- 1. Replace restrictive insert policy with organizer-aware policy
DROP POLICY IF EXISTS "Participants can create teams during registration" ON public.teams;
DROP POLICY IF EXISTS "Allow team creation by captains and organizers" ON public.teams;

CREATE POLICY "Allow team creation by captains and organizers"
  ON public.teams FOR INSERT
  WITH CHECK (
    public.is_admin_or_organizer() OR
    (auth.uid() IS NOT NULL AND captain_id = auth.uid())
  );

-- 2. Add organizer delete policy on teams
DROP POLICY IF EXISTS "Captains and Organizers can delete team" ON public.teams;
DROP POLICY IF EXISTS "Captains and Organizers can delete teams" ON public.teams;

CREATE POLICY "Captains and Organizers can delete team"
  ON public.teams FOR DELETE
  USING (
    public.is_admin_or_organizer() OR
    (auth.uid() IS NOT NULL AND captain_id = auth.uid())
  );
