# CRYPTEX 2026 — Production Deployment & Supabase Setup Guide

This guide provides a comprehensive, step-by-step walkthrough to deploy **CRYPTEX 2026** to **Vercel** with a live **Supabase** backend, zero-trust security policies, single-device enforcement, and competition day operational workflows.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             Vercel Edge / CDN          │
                      │   - Next.js 14.2 App Router            │
                      │   - Edge Middleware (HMAC Session Auth)│
                      │   - Strict CSP & Security Headers      │
                      └───────────────────┬────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │                                                 │
        Client HTTPS/WSS                                   Server API Routes
                 │                                                 │
                 ▼                                                 ▼
     ┌───────────────────────┐                         ┌───────────────────────┐
     │  Participant Browser  │                         │  Supabase PostgreSQL  │
     │  & Auditorium Screen  │                         │  - Public Schema      │
     │  (/display)           │                         │  - Private Schema     │
     │  Anon Key + RLS       │                         │  - Service Role Key   │
     └───────────────────────┘                         └───────────────────────┘
```

---

## Step 1: Create & Configure Supabase

### 1.1 Create a New Project
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and select your organization.
3. Configure the project:
   - **Name:** `cryptex-2026-prod`
   - **Database Password:** Generate a strong password (save this securely).
   - **Region:** Select the region closest to your venue (e.g. `ap-south-1` Mumbai if running in India).
   - **Pricing Plan:** Free tier or Pro.
4. Wait 1–2 minutes for the database cluster to provision.

### 1.2 Retrieve API Keys
Go to **Project Settings** → **API**:
1. Copy **Project URL** (e.g. `https://xyzprojectref.supabase.co`).
2. Copy **Project API Keys** → `anon` `public` key.
3. Copy **Project API Keys** → `service_role` `secret` key.

> **CRITICAL SECURITY RULE:** The `service_role` key bypasses all Row-Level Security (RLS). Never expose it in client components or prefix it with `NEXT_PUBLIC_`.

---

### 1.3 Apply Database Migrations (In Order)

Navigate to **SQL Editor** in the Supabase Dashboard. Run the 5 migration scripts located in [`supabase/migrations/`](file:///c:/Users/Aadithya%20S%20Nair/Projects/CryptX/supabase/migrations/) sequentially:

#### 1. Core Schema (`20261111000001_initial_schema.sql`)
- Creates the `private` schema (inaccessible to public/anon).
- Creates core enums (`user_role`, `event_status`, `round_state`, `puzzle_type`).
- Creates tables: `profiles`, `events`, `organizer_control_secrets`, `elevated_sessions`, `event_rounds`, `teams`, `team_members`, `round_qualifications`, `puzzles`, `submissions`, `scores`, `announcements`, `audit_logs`.

#### 2. Row-Level Security Policies (`20261111000002_rls_policies.sql`)
- Enables RLS on all tables.
- Public read for active event metadata and announcements.
- Teams can only inspect their own submissions.
- Strict isolation on `private.organizer_control_secrets` and `private.puzzle_secrets`.

#### 3. Functions & Triggers (`20261111000003_functions_triggers.sql`)
- Auto-timestamps (`updated_at` triggers).
- Server-side score calculations and tie-breaking calculations.
- Tamper-proofing trigger rejecting late submissions past the round deadline.

#### 4. Seed Data (`20261111000004_seed_data.sql`)
- Seeds the official event (`CRYPTEX 2026`, ID: `20261111-0000-0000-0000-000000002026`).
- Seeds 8 Competition Rounds with official metadata, time limits, and point values.
- Seeds initial organizer password hash.

#### 5. Question Builder Store (`20261111000005_round_question_builder.sql`)
- Populates competition questions, ciphertexts, and verification parameters for all 8 rounds.

---

### 1.4 Enable Supabase Realtime
To allow the Auditorium Projector Screen (`/display`) and Arena to update live without polling:
1. Go to **Database** → **Replication** in the Supabase sidebar.
2. Under **Source**, click on `supabase_realtime`.
3. Enable replication for these tables:
   - `public.announcements`
   - `public.event_rounds`
   - `public.scores`
   - `public.teams`

---

## Step 2: Generate Production Cryptographic Secrets

Run the following in PowerShell or Node.js to generate strong production secrets:

### 2.1 Generate `NEXTAUTH_SECRET`
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
*Save the 64-character hex output. This signs and verifies HMAC-SHA256 session tokens in Edge Middleware.*

### 2.2 Generate Organizer Control Password Hash (Bcrypt)
If you want to set a custom Master Control Password for competition organizers (default is `CryptX@2026!`):
```bash
node -e "console.log(require('bcryptjs').hashSync('YourSecureOrganizerPasswordHere!', 10))"
```
Take note of the resulting `$2a$10$...` hash to update `DEFAULT_FALLBACK_PASS_HASH` if modifying default seeds.

---

## Step 3: Local Pre-Flight Verification

Before pushing to GitHub and Vercel, run the local verification suite inside your Docker container or Node environment:

```bash
# 1. Run full unit and API integration suite (all 47 tests must pass)
npm run test

# 2. Check for ESLint errors
npm run lint

# 3. Check for TypeScript compilation errors
npm run typecheck

# 4. Audit client bundles to ensure zero service-role key leaks
npm run audit:secrets

# 5. Verify production build compiles cleanly
npm run build
```

---

## Step 4: Deploying to Vercel

### 4.1 Push to GitHub / GitLab
1. Create a private repository on GitHub (e.g. `your-user/cryptx-2026`).
2. Verify `.gitignore` contains:
   ```gitignore
   .env
   .env.local
   .env*.local
   .next
   node_modules
   coverage
   playwright-report
   test-results
   ```
3. Push your repository:
   ```bash
   git init
   git add .
   git commit -m "feat: deployment-ready CryptX 2026 with hardened security"
   git branch -M main
   git remote add origin https://github.com/your-user/cryptx-2026.git
   git push -u origin main
   ```

---

### 4.2 Import Project in Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select your `cryptx-2026` Git repository and click **Import**.
4. Configure Project Settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** Default (`.next`)
   - **Install Command:** `npm install`

---

### 4.3 Configure Production Environment Variables in Vercel

In the **Environment Variables** section of your Vercel import screen (or under **Settings** → **Environment Variables**), add the following:

| Variable Name | Environment | Value | Description |
|:---|:---|:---|:---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | `https://your-project-ref.supabase.co` | Public Supabase API Endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | `eyJhbGciOiJI...` | Supabase Public Anonymous Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | `eyJhbGciOiJI...` | Server-only Service Role Key |
| `NEXTAUTH_SECRET` | Production, Preview | `(64-char hex generated in Step 2)` | Edge HMAC Session Token Key |
| `NODE_ENV` | Production | `production` | Enforces production runtime optimizations |

> **IMPORTANT:** Ensure `SUPABASE_SERVICE_ROLE_KEY` does **NOT** have `NEXT_PUBLIC_` prefixed to it.

Click **Deploy**. Vercel will build and assign a production URL (e.g. `https://cryptx-2026.vercel.app`).

---

## Step 5: Post-Deployment Verification

Once deployed, perform these verification checks on your live production URL:

### 5.1 Content-Security-Policy (CSP) Check
Open DevTools (`F12`) on your live Vercel URL and check the Network headers:
- `Content-Security-Policy` must include your `https://*.supabase.co` and `wss://*.supabase.co` endpoints.
- Check that styles, scripts, and fonts load with `200 OK` (no CSP blocking errors in console).

### 5.2 Single-Device Session Enforcement Test
1. Open an Incognito window and log into team `CipherAces` with code `ACES-9942` and password `Competitor@2026`.
2. Open a separate browser or mobile phone and log into the same team.
3. Observe that the first session is immediately superseded and redirected with an alert explaining the single-device security policy.

### 5.3 Walk-In Team Registration Test
1. Visit `/auth/signup` and register a test walk-in team.
2. Confirm the team receives auto-generated credentials (e.g. `TEAM-XXXX` and password).
3. Confirm the team immediately appears in the Organizer Console at `/organizer` under **Registered Teams Roster**.

### 5.4 Qualification Checkpoint Test
1. Log in as Organizer (`organizer@cryptex.internal` / `CryptX@2026!`).
2. Go to **Qualify Checkpoint** tab.
3. Select the advancing teams and click **Save & Enforce Qualifiers →**.
4. Refresh the page to confirm selections persist across reloads and database queries.

---

## Step 6: Competition Day Runbook

### Pre-Event Checklist (1 Hour Before Kickoff)
1. **Connect Projector Screen:**
   - Open a dedicated laptop connected to the auditorium display projector.
   - Navigate to `/display` and press `F11` (Full Screen).
   - Verify live audio chimes and WebSocket announcement ticker are active.
2. **Team Check-In & Credential Slips:**
   - Open `/organizer` on organizer laptops.
   - For walk-in registrations or forgotten passwords, use **Registered Teams Roster** → **Copy** to print or text the login handover slip to team captains.
3. **Verify Participant Devices:**
   - Instruct teams to open their laptops, navigate to `/auth/login`, and enter their Team Code and Password.
   - Confirm all teams show up under **Event Hub** (`/events`) with their teammates registered (1–4 members).

### During Competition
1. **Starting a Round:**
   - Go to `/organizer` → **Round Control**.
   - Select Round (e.g. Round 1).
   - Enter your Organizer Control Password and click **Unlock Controls**.
   - Click **Open Round**. The countdown timer synchronizes across all participant screens instantly.
2. **Pushing Live Auditorium Announcements:**
   - In `/organizer` → **Broadcast Notice**, type a message (e.g. `5 MINUTES REMAINING IN ROUND 1!`) and select `🚨 Urgent`.
   - The notice pulses immediately on the `/display` screen and player arena headers.
3. **Closing & Scoring a Round:**
   - Click **Close Round** when time expires (late submissions are rejected by the server timestamp constraint).
   - Go to **Qualify Checkpoint**, review leaderboard scores, select the advancing teams, and click **Save & Enforce Qualifiers →**.
   - Transition to the next round.

---

## Troubleshooting & FAQ

### Issue: Styles are missing or CSP blocks stylesheets
- **Cause:** Strict Content-Security-Policy headers in `src/middleware.ts` blocking external styles or scripts.
- **Solution:** `src/middleware.ts` is configured with `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`. If adding custom CDN fonts or analytics, add their origin to the `cspHeader` string in `src/middleware.ts`.

### Issue: Supabase connection fails on Vercel
- **Cause:** Incorrect or missing environment variables.
- **Solution:** In Vercel Project Settings → Environment Variables, verify `NEXT_PUBLIC_SUPABASE_URL` begins with `https://` and does not have a trailing slash. Verify `SUPABASE_SERVICE_ROLE_KEY` matches the secret key in your Supabase Dashboard.

### Issue: Realtime updates do not trigger on `/display`
- **Cause:** Supabase Realtime replication is disabled for tables.
- **Solution:** In Supabase Dashboard → **Database** → **Replication**, ensure `supabase_realtime` is toggled ON for `announcements`, `event_rounds`, and `scores`.
