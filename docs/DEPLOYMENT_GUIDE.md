# CRYPTEX 2026 — Production Deployment & Setup Guide

## 1. Supabase Project Setup
1. Create a Supabase Project at [https://supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and execute the migrations in exact order:
   - `supabase/migrations/20261111000001_initial_schema.sql`
   - `supabase/migrations/20261111000002_rls_policies.sql`
   - `supabase/migrations/20261111000003_functions_triggers.sql`
   - `supabase/migrations/20261111000004_seed_data.sql`
   - `supabase/migrations/20261111000005_round_question_builder.sql`
3. Verify RLS execution with `supabase/tests/rls_security_test.sql`.

## 2. Supabase Auth Configuration
- Enable **Email / Password** provider.
- Enable **Google OAuth** (Optional, configure Client ID & Secret).
- Under **Authentication -> URL Configuration**, set Site URL to `https://your-domain.vercel.app` and add redirect URLs `https://your-domain.vercel.app/auth/callback`.

## 3. Vercel Environment Variables
Set the following variables in Vercel Project Settings:

```env
# Public Supabase API (Safe for client, restricted by RLS)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Server-Only Service Role Key (NEVER use NEXT_PUBLIC_ prefix)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Competition App Secret
NEXTAUTH_SECRET=your-32-byte-hex-secret
```

## 4. Run Locally with Docker
If you do not have Node.js installed locally on your host, you can run the entire test and audit suite using Docker:

```powershell
# Run unit tests
docker run --rm -v "${PWD}:/app" -w /app node:20-alpine npm test

# Run zero service-role leak audit
docker run --rm -v "${PWD}:/app" -w /app node:20-alpine npm run audit:secrets

# Run dev server
docker compose up
```

## 5. Post-Deployment Verification Checklist
- [ ] Access public landing page and verify date (11 Nov 2026), venue (DFL04), and coordinators.
- [ ] Confirm `/leaderboard` displays real-time score columns for R1 through R8.
- [ ] Confirm `/display` loads without authentication and auto-cycles between Leaderboard, Round Status, and Notices.
- [ ] Attempt organizer actions and verify that the 10-minute elevated Password Gate triggers properly.
