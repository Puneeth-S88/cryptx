import Link from 'next/link';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';

const competitionRounds = [
  { num: 1, title: 'The Secret Code', topic: 'MCQ & Classical Concepts', type: 'Standard Quiz', marks: 100, status: 'OPEN' },
  { num: 2, title: 'Cipher Breakers', topic: 'Caesar, Atbash, Binary', type: 'Standard Quiz', marks: 150, status: 'LOCKED' },
  { num: 3, title: 'Code Grid', topic: 'Polybius Coordinate Decryption', type: 'Polybius Grid', marks: 150, status: 'LOCKED' },
  { num: 4, title: 'Cipher Scramble', topic: 'Cryptographic Anagrams', type: 'Letter Scramble', marks: 150, status: 'LOCKED' },
  { num: 5, title: 'Memory Cipher', topic: 'Timed Key Memorization', type: 'Memory Decryption', marks: 200, status: 'LOCKED' },
  { num: 6, title: 'Cipher Auction', topic: 'Rail Fence with Point Bidding', type: 'Auction Rails', marks: 200, status: 'LOCKED' },
  { num: 7, title: 'Colour Cipher', topic: 'Baconian Steganography', type: 'Colour Tiles', marks: 200, status: 'LOCKED' },
  { num: 8, title: 'Master Cryptanalyst', topic: 'Vigenere & Proof Methodology', type: 'Polyalphabetic', marks: 300, status: 'LOCKED' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans">
      <Navbar />

      <main className="flex-1 space-y-12 pb-16">
        {/* HERO LIVE COMMAND CONSOLE */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-10">
          <div className="max-w-6xl mx-auto neo-card p-8 sm:p-12 relative overflow-hidden space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-accent-blue animate-pulse" />
                <span className="font-mono-code text-xs text-accent-hover tracking-widest uppercase font-bold">
                  LIVE LIVE IN-PERSON ARENA ACTIVE • VENUE DFL04
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono-code text-xs text-typography-muted">
                <span>EVENT DATE: 11 NOVEMBER 2026</span>
                <span>•</span>
                <span>2:00 PM – 4:00 PM IST</span>
              </div>
            </div>

            <div className="space-y-4 max-w-3xl">
              <span className="text-xs font-mono-code tracking-[0.25em] uppercase text-accent-blue font-bold block">
                The Ultimate Cryptography Championship
              </span>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-mono-code">
                CRYPTEX 2026
              </h1>
              <p className="text-base sm:text-lg text-typography-muted leading-relaxed font-light">
                Authoritative organizer-controlled competition platform. No client-side trust. Crack live ciphers, outscore competing teams, and advance through qualification checkpoints.
              </p>
            </div>

            {/* QUICK PORTAL LAUNCHPAD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <Link
                href="/play"
                className="neo-btn p-5 group flex flex-col justify-between hover:border-accent-blue/80"
              >
                <div>
                  <span className="text-[10px] font-mono-code text-accent-hover uppercase font-bold block mb-1">
                    FOR COMPETITORS
                  </span>
                  <h3 className="font-bold text-white text-base group-hover:text-accent-hover transition-colors font-mono-code">
                    Enter Play Arena →
                  </h3>
                  <p className="text-xs text-typography-muted mt-1">
                    Access active round puzzles & submit team answers.
                  </p>
                </div>
                <div className="pt-4 flex items-center gap-1.5 text-xs text-accent-blue font-mono-code">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> Round 1 Open Now
                </div>
              </Link>

              <Link
                href="/events"
                className="neo-btn p-5 group flex flex-col justify-between hover:border-accent-blue/80"
              >
                <div>
                  <span className="text-[10px] font-mono-code text-typography-dim uppercase font-bold block mb-1">
                    TEAM PROFILE
                  </span>
                  <h3 className="font-bold text-white text-base group-hover:text-accent-hover transition-colors font-mono-code">
                    Teams & Roster →
                  </h3>
                  <p className="text-xs text-typography-muted mt-1">
                    Manage team members, join codes, and lock roster.
                  </p>
                </div>
                <div className="pt-4 text-xs text-typography-dim font-mono-code">
                  15 Teams Max (DFL04)
                </div>
              </Link>

              <Link
                href="/leaderboard"
                className="neo-btn p-5 group flex flex-col justify-between hover:border-accent-blue/80"
              >
                <div>
                  <span className="text-[10px] font-mono-code text-typography-dim uppercase font-bold block mb-1">
                    PUBLIC STANDINGS
                  </span>
                  <h3 className="font-bold text-white text-base group-hover:text-accent-hover transition-colors font-mono-code">
                    Live Leaderboard →
                  </h3>
                  <p className="text-xs text-typography-muted mt-1">
                    Real-time ranks, round rollback tie-breaks, scores.
                  </p>
                </div>
                <div className="pt-4 text-xs text-typography-dim font-mono-code">
                  Auto-updating via Supabase
                </div>
              </Link>

              <Link
                href="/organizer"
                className="neo-btn p-5 group flex flex-col justify-between hover:border-accent-blue/80"
              >
                <div>
                  <span className="text-[10px] font-mono-code text-accent-hover uppercase font-bold block mb-1">
                    EVENT OFFICIALS
                  </span>
                  <h3 className="font-bold text-white text-base group-hover:text-accent-hover transition-colors font-mono-code">
                    Organizer Console →
                  </h3>
                  <p className="text-xs text-typography-muted mt-1">
                    Control Room, Password Gate, Qualify, Jury, Audit.
                  </p>
                </div>
                <div className="pt-4 text-xs text-accent-hover font-mono-code">
                  Password Gated (10m)
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* 8 OFFICIAL COMPETITION ROUNDS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-surface-border">
            <div>
              <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block mb-1 font-bold">
                Championship Curriculum
              </span>
              <h2 className="text-2xl font-extrabold text-white font-mono-code">
                Competition Stages
              </h2>
            </div>
            <p className="text-xs font-mono-code text-typography-muted">
              Live rounds gated sequentially by organizer confirmation
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {competitionRounds.map((r) => (
              <div key={r.num} className="neo-card p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between font-mono-code text-xs mb-2">
                    <span className="text-accent-hover font-bold">ROUND 0{r.num}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        r.status === 'OPEN'
                          ? 'bg-green-950/60 text-green-300 border border-green-700/40'
                          : 'bg-surface-inset text-typography-dim border border-surface-border'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base font-mono-code">{r.title}</h3>
                  <p className="text-xs text-typography-muted mt-1">{r.topic}</p>
                </div>

                <div className="pt-3 border-t border-surface-border/60 flex items-center justify-between text-xs font-mono-code">
                  <span className="text-typography-dim">{r.type}</span>
                  <span className="font-bold text-white">{r.marks} pts</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OFFICIAL COORDINATORS & RULES */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="neo-card p-6 space-y-4">
            <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block font-bold">
              Event Mentors & Coordinators
            </span>
            <div className="space-y-3 font-mono-code text-xs">
              <div className="neo-inset p-3.5">
                <span className="text-typography-dim block mb-1 text-[10px]">FACULTY COORDINATORS</span>
                <span className="text-white font-bold block text-sm">Dr. Vijay Kumar AV & Ms. Soumya</span>
              </div>
              <div className="neo-inset p-3.5">
                <span className="text-typography-dim block mb-1 text-[10px]">STUDENT COORDINATORS</span>
                <span className="text-white font-bold block text-sm">Prajwal B U & Puneeth S</span>
              </div>
            </div>
          </div>

          <div className="neo-card p-6 space-y-4">
            <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block font-bold">
              Fair Play Architecture
            </span>
            <ul className="space-y-2 text-xs font-mono-code text-typography-muted">
              <li className="flex items-start gap-2">
                <span className="text-accent-hover font-bold">✓</span>
                <span>Single submission per team strictly enforced by PostgreSQL transaction constraint.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-hover font-bold">✓</span>
                <span>Client clock tamper resistance: deadlines validated strictly by server timestamps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-hover font-bold">✓</span>
                <span>Organizer Round Control Password gate protects all round transitions and qualifier approvals.</span>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
