# CRYPTEX 2026 — OWASP Top 10 Application Security Mapping

| Vulnerability Category | Mitigation Architecture in CRYPTEX 2026 |
|---|---|
| **A01: Broken Access Control** | Default-deny PostgreSQL RLS on every table. Participant cannot access private schemas (`private.puzzle_secrets`). Round qualification gating enforced in database triggers and queries. Organizer actions require double-gate (role + short-lived elevated password session). |
| **A02: Cryptographic Failures** | Round Control Password stored as salted bcrypt hash in private schema. Constant-time comparisons (`timingSafeEqualString`) for answers and tokens to eliminate side-channel timing attacks. TLS 1.3 in transit with HSTS `max-age=63072000`. |
| **A03: Injection** | Parameterized queries and Supabase PostgREST client throughout. All inputs parsed and validated using strict Zod schemas on API route boundaries. |
| **A04: Insecure Design** | Zero-trust architecture: server is the single source of truth for all timers, rounds, scores, and qualifications. Single submission per round enforced by database unique constraint (`round_id, team_id`). |
| **A05: Security Misconfiguration** | Strict Content-Security-Policy (CSP) headers with nonces, `X-Frame-Options: DENY` (except `/display`), `X-Content-Type-Options: nosniff`, and disabled `X-Powered-By`. Dedicated CI script (`npm run audit:secrets`) to block service-role leaks in client code. |
| **A06: Vulnerable & Outdated Components** | Minimal dependencies. Automated npm vulnerability audit and dependency checks. |
| **A07: Identification & Auth Failures** | 10-minute maximum elevation for organizer sessions. 5-failure lockout with exponential backoff on password gate. Session checks on both middleware and server actions. |
| **A08: Software & Data Integrity Failures** | Submissions immutable once posted. Auto-computed SHA-256 hashes for elevated tokens. CI pipeline runs automated test suites on commits. |
| **A09: Security Logging & Monitoring** | Immutable, append-only `public.audit_log` recording all state changes, failed and successful elevations, timer extensions, and manual adjustments with IP and User Agent. |
| **A10: Server-Side Request Forgery (SSRF)** | No arbitrary user-supplied URLs fetched on backend. Static endpoints and restricted Supabase client egress only. |
