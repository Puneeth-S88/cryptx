-- ==============================================================================
-- CRYPTEX 2026 - MIGRATION 06: Grant Role Permissions & Fix Schema Cache
-- ==============================================================================
-- This migration fixes the "permission denied for table" (Error 42501)
-- and "Could not find table in schema cache" (PGRST205) issues by:
-- 1. Granting USAGE and table permissions to anon, authenticated, and service_role
-- 2. Setting default privileges for any future tables
-- 3. Moving organizer_control_secrets to public schema so PostgREST / supabaseAdmin
--    can access it while keeping RLS locked down against anon/authenticated.

-- 1. Grant Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant Permissions on all existing tables, views, sequences, and routines
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Configure Default Privileges for future creations
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. Move organizer_control_secrets to public schema if it was created in private schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'private' AND table_name = 'organizer_control_secrets'
  ) THEN
    ALTER TABLE private.organizer_control_secrets SET SCHEMA public;
  END IF;
END $$;

-- 5. Secure public.organizer_control_secrets so only service_role has access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'organizer_control_secrets'
  ) THEN
    ALTER TABLE public.organizer_control_secrets ENABLE ROW LEVEL SECURITY;
    -- Revoke from anon & authenticated
    REVOKE ALL ON TABLE public.organizer_control_secrets FROM anon, authenticated, public;
    -- Grant strictly to service_role and postgres
    GRANT ALL ON TABLE public.organizer_control_secrets TO service_role, postgres;
    
    -- Ensure no anon/authenticated policy allows access
    DROP POLICY IF EXISTS "Deny all public access to organizer secrets" ON public.organizer_control_secrets;
    CREATE POLICY "Deny all public access to organizer secrets"
      ON public.organizer_control_secrets FOR ALL
      TO anon, authenticated
      USING (false);
  END IF;
END $$;

-- 6. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

-- 7. Defense-in-depth: Revoke password_hash SELECT from anon and authenticated
REVOKE SELECT (password_hash) ON public.teams FROM anon, authenticated, public;
GRANT SELECT (password_hash) ON public.teams TO service_role, postgres;
