# CRYPTEX 2026 — Pre-Event Operational Runbook & Dry-Run Protocol

**Event Date:** 11 November 2026 | **Time:** 2:00 PM – 4:00 PM IST | **Venue:** DFL04  
**Faculty Coordinators:** Dr. Vijay Kumar AV & Ms. Soumya  
**Student Coordinators:** Prajwal B U & Puneeth S  

---

## 1. Pre-Event Verification Checklist (T-60 Minutes)
- [ ] **Hardware & Projector Setup:**
  - Connect venue projector in DFL04 to organizer auxiliary laptop.
  - Open `https://<your-domain>/display` in browser (press `F11` for full-screen mode).
  - Verify that the carousel automatically rotates across the 3 viewports (Leaderboard, Round Status, Notices) every 15 seconds.
- [ ] **Super Admin Elevation Test:**
  - Login to Organizer Console at `/organizer`.
  - Enter the Round Control Password (`CryptX@2026!` default seed or rotated production password).
  - Confirm green elevation indicator appears and remains active for 10 minutes.
- [ ] **Puzzle & Cipher Answer Validation:**
  - Confirm all 8 seed puzzles and private answers are in place in PostgreSQL.
  - Verify Round 5 Memory Cipher key reveal returns key strictly on first request and blocks subsequent calls.
  - Verify Round 7 Colour Cipher tiles render properly (Blue = A, Orange = B).

---

## 2. Live Competition Round Lifecycle (Per Round Flow)
For each round (1 through 8):
1. **Organizer Unlock:**
   - Organizer clicks **"▶ Open Round & Start Timer"** in the Control Room.
   - The authoritative Postgres timestamp is set for `deadline = now() + duration_seconds`.
2. **Participant Gameplay:**
   - Qualified teams access the interactive puzzle and submit their answer.
   - Database enforces strictly **one submission per team** via unique constraint.
3. **Closing Submissions:**
   - Submissions close automatically when server deadline is reached, or when organizer clicks **"⏹ Close Submissions"**.
4. **Scoring & Review:**
   - Organizer reviews automated scores or enters jury marks for manual rounds.
   - Any manual adjustments are recorded with reason in `audit_log`.
5. **Qualification Selection:**
   - Organizer opens Qualification Screen.
   - Uses Quick Actions (e.g. *Select Top 10* or *Score ≥ 100*) to mark advancing teams.
   - Confirms qualification using Round Control Password.
   - Database enforces that only confirmed teams can access the next round.
6. **Repeat for Next Round.**

---

## 3. Wi-Fi / Network Contingency & Failover Plan
If venue Wi-Fi becomes unstable:
1. **Organizer Standby Mobile Hotspot:** Organizer and display screen should switch to a dedicated organizer 5G mobile hotspot.
2. **Timer Extension:** Organizer can extend active round timer by +2 or +5 minutes from the Control Room panel.
3. **Walk-In Registration:** Organizers can manually add or adjust team rosters from `/organizer/[eventId]/teams`.
4. **Audit Snapshot Export:** Organizers can click "Export CSV" to retain local offline snapshots of scores and submissions after every round.
