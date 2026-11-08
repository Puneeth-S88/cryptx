# Project: CryptX Deployment Readiness & Codebase Remediation

## Architecture
- **Framework & Runtime:** Next.js 14.2.24 (App Router), React 18.3.1, TypeScript 5.7.3, Tailwind CSS 3.4.17.
- **Backend & Database:** Supabase (PostgreSQL with RLS), Server Route Handlers (`src/app/api/`), Edge Middleware (`src/middleware.ts`).
- **Security Primitives:** HMAC-SHA256 session tokens, Web Crypto API, timing-safe evaluation, sliding-window rate limiting, proctored security guards.
- **Execution & Containerization:** Docker container `cryptex_app` (Node v20.20.2, npm 10.8.2 on Alpine Linux) running under Docker Desktop WSL2.
- **Testing:** Vitest 3.0.6 (unit/integration), Playwright 1.50.1 (E2E).

---

## Feature & Defect Inventory

| # | Item / Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | CFG-01 | ESLint configuration and dependencies missing | M1 | explorer_1 |
| 2 | CFG-02 | `@vitest/coverage-v8` dependency missing | M1 | explorer_1 |
| 3 | CFG-03 | Build prerender failure under default container `NODE_ENV=development` | M1 | explorer_1 |
| 4 | CFG-04 | Playwright E2E container browser dependency and port 3000 collision | M1 | explorer_1 |
| 5 | CFG-05 | Production Dockerfile multi-stage standalone build support | M1 | explorer_1, spec_miner |
| 6 | CFG-06 | Local environment template `.env.local` | M1 | explorer_1 |
| 7 | BUG-09 | Navigation bar link for `/auth/signup` missing | M1 | explorer_1 |
| 8 | DOC-01 | Publish AUDIT_REPORT.md and PROJECT.md to workspace root | M1 | orchestrator |
| 9 | SEC-01 | Middleware authentication bypass via unsigned base64 token payload | M2 | spec_miner |
| 10 | SEC-02 | Hardcoded organizer backdoor passwords (`CryptX@2026!`, `Organizer@2026`) | M2 | spec_miner |
| 11 | SEC-03 | Master competitor password backdoor (`Competitor@2026`) | M2 | spec_miner, explorer_2 |
| 12 | SEC-04 | Plaintext team passwords in `public.teams` exposed by unrestricted RLS | M2 | spec_miner |
| 13 | SEC-05 | Insecure default fallback for `NEXTAUTH_SECRET` | M2 | spec_miner |
| 14 | SEC-06 | Unauthenticated public broadcast manipulation and deletion | M2 | spec_miner |
| 15 | SEC-09 | Unauthenticated elevation endpoint and global DoS lockout | M2 | spec_miner |
| 16 | SEC-10 | Client-side organizer elevation hardcoded to active on initial load | M2 | spec_miner |
| 17 | BUG-03 | Team qualification flag inverted on login (`is_eliminated` vs `is_qualified`) | M2 | explorer_2 |
| 18 | BUG-01 | Round 6 Auction answer key mismatch (`auction_answer` vs `message`) causing 0 pts | M3 | explorer_2 |
| 19 | BUG-02 | Round 4 Scramble key prefix mismatch (`w_1` vs `1`) causing 0 pts | M3 | explorer_2 |
| 20 | BUG-04 | Round 2 cipher evaluation dead code and `{ items: [...] }` payload incompatibility | M3 | explorer_2 |
| 21 | BUG-05 | Standard quiz submissions format mismatch (`answer` vs `text_answer`) | M3 | explorer_2 |
| 22 | BUG-06 | Corrupted test questions in `data/questions_store.json` inflating R2 points | M3 | explorer_2 |
| 23 | BUG-07 | Organizer special round editor hardcoded to Polybius with empty `onSave` | M3 | explorer_2 |
| 24 | BUG-08 | Uncaught TypeError in evaluators on null/undefined submission | M3 | explorer_2 |
| 25 | SEC-07 | Unauthenticated and spoofable answer submission route | M3 | spec_miner |
| 26 | SEC-08 | Swallowed database unique constraint allows brute-force repeat scoring | M3 | spec_miner |
| 27 | SEC-11 | Timing leaks in string normalization and token equality | M3 | spec_miner |
| 28 | SEC-12 | Insecure PRNG (`Math.random()`) in token and ID generation | M3 | spec_miner |
| 29 | BUG-10 | Test suite state contamination across runs without reset fixtures | M4 | explorer_2 |
| 30 | TST-01 | Zero automated test coverage across Next.js API routes | M4 | explorer_2 |
| 31 | VER-01 | Full repository verification: build, typecheck, lint, unit & route tests | M5 | orchestrator |
| 32 | AUD-01 | Forensic integrity victory audit | M5 | orchestrator |

*All 32 inventory items are assigned to milestones M1–M5. Zero items remain unassigned.*

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| **M1** | Build, Linting & Environment Configuration | CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, CFG-06, BUG-09, DOC-01 | None | DONE |
| **M2** | Authentication, Session & Access Control Security | SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-09, SEC-10, BUG-03 | M1 | READY_FOR_EXECUTION |
| **M3** | Application Logic, Puzzle Evaluators & Scoring Remediation | BUG-01, BUG-02, BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, SEC-07, SEC-08, SEC-11, SEC-12 | M2 | PLANNED |
| **M4** | Test Suite Expansion & API Route Verification | BUG-10, TST-01 | M3 | PLANNED |
| **M5** | Full Verification & Forensic Victory Audit | VER-01, AUD-01 | M4 | PLANNED |

---

## Code Layout & File Boundaries

| Milestone | Owned Files | File Description |
|---|---|---|
| **M1** | `package.json`, `.eslintrc.json`, `playwright.config.ts`, `Dockerfile`, `.env.example`, `.env.local`, `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, `AUDIT_REPORT.md`, `PROJECT.md` | Build, lint, and environment configuration files |
| **M2** | `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/announcements/route.ts`, `src/app/api/organizer/elevate/route.ts`, `src/app/organizer/page.tsx`, `src/lib/session.ts`, `src/lib/crypto/password-gate.ts`, `supabase/migrations/` | Security, authentication, and access control files |
| **M3** | `src/app/play/page.tsx`, `src/app/api/rounds/[roundId]/submit/route.ts`, `src/lib/crypto/evaluators.ts`, `src/lib/crypto/normalizer.ts`, `src/lib/teams.ts`, `src/lib/broadcast.ts`, `src/lib/questions.ts`, `data/questions_store.json` | Scoring engine, evaluators, puzzle handlers, and stores |
| **M4** | `tests/unit/rounds.test.ts`, `tests/unit/teams.test.ts`, `tests/api/submit.test.ts`, `tests/api/auth.test.ts`, `tests/api/announcements.test.ts` | Test fixtures and automated API test suites |
| **M5** | None (Read-only verification and audit execution) | Verification reports |

---

## Interface Contracts

### 1. Middleware Session Signature Verification (`src/middleware.ts`)
- Function: `verifySessionTokenEdge(token: string, secret: string): Promise<{ valid: boolean, payload?: SessionPayload }>`
- Uses Web Crypto API (`crypto.subtle`) for Edge compatibility.
- Rejects unsigned or signature-mismatched tokens; returns 401 redirect or JSON error before `/api/organizer` or `/organizer` routes.

### 2. Answer Submission Contract (`src/app/api/rounds/[roundId]/submit/route.ts`)
- Input: `{ teamId: string, payload: Record<string, any>, telemetry?: Record<string, any> }`
- Header / Cookie: `cryptex_session` required.
- Verification: Caller `session.teamId` MUST match `body.teamId` (unless caller is organizer).
- Key Support:
  - Round 4: Maps keys `"w_1"`..`"w_5"` to `"1"`..`"5"`.
  - Round 6: Maps `payload.auction_answer` to `payload.message`.
  - Standard quiz: Maps `payload[qKey] ?? payload.text_answer ?? payload.selected_option_index`.
- Output: `{ success: true, score: number, maxScore: number, breakdown: Record<string, any>, isFullyCorrect: boolean }`.
- Replay: Rejects duplicate submissions with HTTP 409 if already scored.

### 3. Team Authentication & Qualification (`src/app/api/auth/login/route.ts`)
- Authenticates organizers strictly via hashed passwords.
- Authenticates teams strictly via registered passwords; removes `'Competitor@2026'` backdoor.
- Returns session with `is_qualified: !resolvedTeam.is_eliminated`.
