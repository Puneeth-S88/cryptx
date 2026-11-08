# CRYPTEX 2026 (CryptX)

> **The Ultimate Cryptography Championship Platform**  
> A live, zero-trust, organizer-controlled cryptography competition engine built for high-stakes in-person and hybrid hackathons.

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com/)
[![Tests Passing](https://img.shields.io/badge/Vitest-47%2F47%20Passed-brightgreen)](https://vitest.dev/)
[![Docker Ready](https://img.shields.io/badge/Docker-Multi--Stage-2496ed?logo=docker)](https://www.docker.com/)

---

## 🚀 Key Highlights

* **8 Interactive Puzzle Rounds:** Classical ciphers, Polybius 5×5 click grids, timed memory reveal keys, anagram scrambles, Baconian steganography, point-bidding rail fences, and Vigenère cryptanalysis.
* **Organizer Command Center (`/organizer`):** Centralized round state management, live countdown timer control, dynamic question builder, team walk-in intake, qualifier eliminations, and urgent alert broadcasts.
* **Auditorium Projector Display (`/display`):** Fullscreen stage dashboard with live rank feeds, animated tie-breaker scores, and urgent broadcast banners.
* **Zero-Trust Fair Play Architecture:**
  * **Single-Device Enforcement:** Only one active session permitted per team; new logins immediately supersede prior devices.
  * **Server-Side Authoritative Clocks:** Submission deadlines validated strictly by server timestamps to prevent client-clock manipulation.
  * **Tamper-Proof Session Tokens:** HMAC-SHA256 signature verification in Edge Middleware with timing-safe comparison.
  * **Client Security Audit:** Zero service-role key leakage into client bundles enforced via automated pre-commit scanners.
  * **Database Security:** Strict Row-Level Security (RLS) on all PostgreSQL tables with private schemas for solutions and master secrets.

---

## 🧩 The 8 Championship Rounds

| Round | Title | Format & Mechanics | Points | Time Limit |
|:---:|:---|:---|:---:|:---:|
| **R1** | **The Secret Code** | Standard MCQ & Classical Cryptography Fundamentals | 100 pts | 10 min |
| **R2** | **Cipher Breakers** | Structured multi-item ciphers (Caesar, Atbash, Binary conversions) | 150 pts | 10 min |
| **R3** | **Code Grid** | Polybius 5×5 Coordinate Decryption with interactive letter selection | 150 pts | 10 min |
| **R4** | **Cipher Scramble** | Cryptographic Anagrams with dynamic clue cards | 150 pts | 10 min |
| **R5** | **Memory Cipher** | 15-second one-time key reveal with timed anti-replay auto-wipe | 200 pts | 10 min |
| **R6** | **Cipher Auction** | Rail Fence Cipher with strategic point deductions for revealed hints | 200 pts | 10 min |
| **R7** | **Colour Cipher** | Baconian Steganography (Blue = A, Orange = B tile sequences) | 200 pts | 10 min |
| **R8** | **Master Cryptanalyst** | Vigenère Polyalphabetic Analysis + technical proof verification | 300 pts | 15 min |

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 14.2 (App Router), React 18, Tailwind CSS (Neomorphic Dark Theme: Grey, White, Blue, Black), Lucide Icons.
* **Backend:** Next.js Server Route Handlers, Edge Middleware with Web Crypto HMAC verification.
* **Database & Realtime:** Supabase (PostgreSQL 15), Row-Level Security, Database Triggers, Realtime WebSocket replication.
* **Testing:** Vitest 3.0, `@vitest/coverage-v8`, Playwright E2E.
* **DevOps:** Multi-stage Docker, Docker Compose, standalone production output.

---

## 📦 Getting Started

### Prerequisites
* **Node.js** v20.x or higher
* **npm** v10.x or higher
* **Docker & Docker Compose** (optional, for containerized execution)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/cryptx-2026.git
cd cryptx-2026
npm install
```

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example .env.local
```

Configure your variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXTAUTH_SECRET=your_32_byte_hex_secret
PORT=3000
NODE_ENV=development
```

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🐳 Docker Deployment

Run the complete containerized stack using Docker Compose:

```bash
# Build and run development container
docker compose up -d

# Inspect live container logs
docker logs -f cryptex_app

# Run test suite inside container
docker exec cryptex_app npm run test
```

---

## 🧪 Testing & Code Quality

The repository maintains strict verification gates:

```bash
# Run all 47 unit & API integration tests
npm run test

# Run tests with V8 coverage report
npm run test:coverage

# Run TypeScript type-checking (0 errors)
npm run typecheck

# Run ESLint (Next.js core web vitals)
npm run lint

# Security audit (guarantees zero service-role keys leak into client bundles)
npm run audit:secrets

# Run Playwright End-to-End tests
npm run test:e2e
```

---

## 📁 Repository Structure

```
CryptX/
├── src/
│   ├── app/                      # Next.js App Router (pages & API endpoints)
│   │   ├── api/
│   │   │   ├── announcements/    # Real-time auditorium broadcasts
│   │   │   ├── auth/             # Login, session, single-device tracking
│   │   │   ├── organizer/        # Team CRUD, controls, elevation gate
│   │   │   ├── rounds/           # Questions, round timers, submissions
│   │   │   └── team/members/     # Teammate roster additions/deletions
│   │   ├── auth/                 # Sign-in and walk-in signup pages
│   │   ├── display/              # Auditorium projector display dashboard
│   │   ├── events/               # Event overview and participant team hub
│   │   ├── leaderboard/          # Public live leaderboard
│   │   ├── organizer/            # Master organizer administration portal
│   │   ├── play/                 # Participant proctored arena
│   │   ├── globals.css           # Tailwind + neomorphic utility layer
│   │   └── layout.tsx            # Global root layout and dark scheme
│   ├── components/               # Modular UI & puzzle components
│   │   ├── organizer/            # Round editor, qualifier table, elevation gate
│   │   ├── puzzles/              # Interactive cipher widgets (Polybius, Bacon, Vigenère)
│   │   └── shared/               # Navbar, footer, countdown clock
│   ├── lib/                      # Business logic, state stores, security
│   │   ├── crypto/               # Evaluators, timing-safe string normalizers
│   │   ├── supabase/             # Admin and public Supabase clients
│   │   ├── session.ts            # Edge HMAC session signing & device tracking
│   │   ├── teams.ts              # Team registry, member management, score calculations
│   │   └── rounds.ts             # Round lifecycle, question stores
│   └── middleware.ts             # Route guard, CSP headers, organizer protection
├── supabase/
│   └── migrations/               # 5 sequential SQL migrations (Schema, RLS, Seed data)
├── tests/
│   ├── unit/                     # Vitest suites (teams, crypto, rounds, API security)
│   └── e2e/                      # Playwright end-to-end tests
├── scripts/                      # Client bundle security scanner
├── Dockerfile                    # Multi-stage production container
├── docker-compose.yml            # Container orchestration
├── INSTRUCTION.md                # Public Vercel & Supabase deployment guide
└── package.json                  # Dependencies and scripts
```

---

## 🔒 Security & Fair Play Standards

* **Timing Attack Protection:** Constant-time string matching using `crypto.timingSafeEqual` prevents side-channel timing analysis on cipher answers and tokens.
* **Cross-Site Scripting (CSP):** Strict `Content-Security-Policy` with nonces blocks inline script tampering and unauthorized framing.
* **Organizer Authorization:** High-impact administrative actions (round skips, score overrides, eliminations) are shielded behind an elevated session token requirement.
* **Single Device Enforcement:** When a team signs in on a second device, the previous device's session is invalidated instantly.

---

## 🌐 Public Deployment (Vercel & Supabase)

For comprehensive instructions on deploying to **Vercel** with a production **Supabase** backend, refer to:  
📖 **[`INSTRUCTION.md`](./INSTRUCTION.md)**

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details. Built for **CRYPTEX 2026**.