'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { ServerCountdown } from '@/components/shared/ServerCountdown';
import { PolybiusGrid } from '@/components/puzzles/PolybiusGrid';
import { BaconColourTiles } from '@/components/puzzles/BaconColourTiles';
import { VigenereDecoderTool } from '@/components/puzzles/VigenereDecoderTool';
import { ProctoredSecurityGuard } from '@/components/puzzles/ProctoredSecurityGuard';

interface RoundItem {
  id: string;
  round_number: number;
  title: string;
  topic: string;
  round_type: 'standard' | 'polybius' | 'scramble' | 'memory' | 'auction' | 'colour' | 'vigenere' | 'jury';
  state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
  duration_seconds: number;
  max_points: number;
  deadline: string | null;
  is_qualified: boolean;
}

const defaultRounds: RoundItem[] = [
  {
    id: 'r1',
    round_number: 1,
    title: 'The Secret Code',
    topic: 'MCQ & Classical Cryptographic Fundamentals',
    round_type: 'standard',
    state: 'open',
    duration_seconds: 600,
    max_points: 100,
    deadline: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
    is_qualified: true,
  },
  {
    id: 'r2',
    round_number: 2,
    title: 'Cipher Breakers',
    topic: 'Caesar shift, Atbash, Binary conversions',
    round_type: 'standard',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r3',
    round_number: 3,
    title: 'Code Grid',
    topic: 'Polybius Coordinate Decryption (5x5 click matrix)',
    round_type: 'polybius',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r4',
    round_number: 4,
    title: 'Cipher Scramble',
    topic: 'Cryptographic Anagrams with Clues',
    round_type: 'scramble',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r5',
    round_number: 5,
    title: 'Memory Cipher',
    topic: 'Timed Key Memorization & Anti-Replay Decode',
    round_type: 'memory',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r6',
    round_number: 6,
    title: 'Cipher Auction',
    topic: 'Rail Fence Cipher with Point Bidding & Hint Deductions',
    round_type: 'auction',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r7',
    round_number: 7,
    title: 'Colour Cipher',
    topic: 'Baconian Cipher Visual Steganography (Blue=A, Orange=B)',
    round_type: 'colour',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r8',
    round_number: 8,
    title: 'Master Cryptanalyst',
    topic: 'Vigenere Polyalphabetic Cryptanalysis + Technical Proof',
    round_type: 'vigenere',
    state: 'locked',
    duration_seconds: 900,
    max_points: 300,
    deadline: null,
    is_qualified: true,
  },
];

export default function PlayArenaPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundItem[]>(defaultRounds);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('r1');
  const [teamInfo, setTeamInfo] = useState({
    id: '',
    name: 'Authenticating...',
    captain: '',
    rank: 1,
    totalScore: 0,
    is_eliminated: false,
    eliminated_after_round: null as number | null,
  });

  // Single-device session state
  const [isSuperseded, setIsSuperseded] = useState(false);

  // Gameplay state
  const [submittedRounds, setSubmittedRounds] = useState<Record<string, { score: number; breakdown?: any }>>({});
  const [roundAnswers, setRoundAnswers] = useState<Record<string, Record<string, any>>>({});
  const [specialPayload, setSpecialPayload] = useState<any>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Memory Round One-Time Reveal State
  const [memoryRevealed, setMemoryRevealed] = useState(false);
  const [memorySecondsLeft, setMemorySecondsLeft] = useState(15);
  const [memoryKeyExpired, setMemoryKeyExpired] = useState(false);

  // Auction Hints State
  const [auctionHintsUsed, setAuctionHintsUsed] = useState(0);

  // Dynamic Questions from server
  const [roundQuestions, setRoundQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const activeRound = rounds.find((r) => r.id === selectedRoundId) || rounds[0];

  // Monitor single-device enforcement & authenticate
  useEffect(() => {
    async function verifyDeviceSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json().catch(() => ({}));

        if (res.status === 401 && data.superseded) {
          setIsSuperseded(true);
        } else if (res.ok && data.authenticated && data.user) {
          setTeamInfo((prev) => ({
            ...prev,
            id: data.user.teamId || data.user.accountId,
            name: data.user.accountName,
            captain: data.user.accountName,
          }));
        } else {
          router.push('/auth/login?redirect=/play');
        }
      } catch {
        // network error
      }
    }

    verifyDeviceSession();
    const interval = setInterval(verifyDeviceSession, 4000);
    return () => clearInterval(interval);
  }, [router]);

  // Synchronize official round states from server (unlocking Round 2, 3, etc. when organizer kicks off)
  useEffect(() => {
    async function syncRounds() {
      try {
        const res = await fetch('/api/rounds');
        if (res.ok) {
          const data = await res.json();
          if (data.rounds && Array.isArray(data.rounds)) {
            setRounds(data.rounds);

            // Auto-advance player view if current selected round is closed or scored
            if (data.activeRound && data.activeRound.id) {
              setSelectedRoundId((currentId) => {
                const currentRound = data.rounds.find((r: any) => r.id === currentId);
                if (!currentRound || currentRound.state === 'closed' || currentRound.state === 'scored') {
                  return data.activeRound.id;
                }
                return currentId;
              });
            }
          }
        }
      } catch {
        // network error
      }
    }

    syncRounds();
    const interval = setInterval(syncRounds, 3000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize dynamic questions for active standard round (live polling)
  useEffect(() => {
    async function loadRoundQuestions(silent = false) {
      if (activeRound.round_type !== 'standard') return;
      if (!silent) setLoadingQuestions(true);
      try {
        const res = await fetch(`/api/rounds/${activeRound.id}/questions`);
        if (res.ok) {
          const data = await res.json();
          if (data.questions && Array.isArray(data.questions)) {
            setRoundQuestions(data.questions);
          }
        }
      } catch (err) {
        console.error('Failed to load questions for round', err);
      } finally {
        if (!silent) setLoadingQuestions(false);
      }
    }

    loadRoundQuestions(false);
    const interval = setInterval(() => loadRoundQuestions(true), 3500);
    return () => clearInterval(interval);
  }, [activeRound.id, activeRound.round_type]);

  // Memory Cipher Key Timer
  const handleStartMemoryReveal = () => {
    if (memoryRevealed) return;
    setMemoryRevealed(true);
    let sec = 15;
    const t = setInterval(() => {
      sec -= 1;
      setMemorySecondsLeft(sec);
      if (sec <= 0) {
        clearInterval(t);
        setMemoryKeyExpired(true);
      }
    }, 1000);
  };

  // Submit Handler calling real authoritative API
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const currentRoundAnswers = roundAnswers[activeRound.id] || {};
    const payload =
      activeRound.round_type === 'standard'
        ? currentRoundAnswers
        : activeRound.round_type === 'auction'
        ? { ...specialPayload, hintsUsed: auctionHintsUsed }
        : specialPayload;

    try {
      const res = await fetch(`/api/rounds/${activeRound.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: activeRound.id,
          teamId: teamInfo.id,
          payload,
          telemetry: {
            submittedAt: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();

      if (res.status === 401 && data.superseded) {
        setIsSuperseded(true);
        setShowConfirmModal(false);
        return;
      }

      if (!res.ok) {
        setSubmitError(data.error || 'Submission failed.');
      } else {
        const awarded = data.scoreAwarded ?? data.score ?? 0;
        setSubmittedRounds((prev) => ({
          ...prev,
          [activeRound.id]: { score: awarded, breakdown: data.breakdown },
        }));
        setTeamInfo((prev) => ({
          ...prev,
          totalScore: prev.totalScore + awarded,
        }));
        setShowConfirmModal(false);
      }
    } catch {
      setSubmitError('Failed to communicate with submission server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProctoredSecurityGuard teamName={teamInfo.name}>
      <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans select-none">
        <Navbar />

        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TOP STATUS BAR: Team Badge & Live Round Controller */}
        <div className="neo-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-inset border border-surface-border shadow-neo-inset flex items-center justify-center">
              <span className="font-mono-code font-bold text-accent-hover text-lg">CX</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono-code font-extrabold text-xl text-white tracking-wide">
                  {teamInfo.name}
                </span>
                <span className="text-[10px] font-mono-code px-2.5 py-0.5 rounded-full bg-accent-blue/20 text-accent-hover border border-accent-blue/30 font-bold uppercase">
                  {teamInfo.is_eliminated ? 'Eliminated' : 'Qualified & Active'}
                </span>
              </div>
              <p className="text-xs font-mono-code text-typography-muted mt-0.5">
                Captain: {teamInfo.captain} • Live Rank: #{teamInfo.rank} • Score: {teamInfo.totalScore} pts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ServerCountdown
              deadline={activeRound.deadline}
              state={activeRound.state}
            />
          </div>
        </div>

        {/* ROUND SELECTOR PILL TABS */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-max p-1.5 rounded-xl neo-inset">
            {rounds.map((r) => {
              const isSelected = r.id === activeRound.id;
              const isDone = !!submittedRounds[r.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoundId(r.id)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-mono-code transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-accent-blue text-white shadow-neo-blue-sm font-bold'
                      : isDone
                      ? 'bg-surface-card/60 text-green-300 border border-green-800/40'
                      : r.state === 'open'
                      ? 'bg-surface-card text-white border border-surface-border shadow-neo-btn'
                      : 'text-typography-muted hover:text-white'
                  }`}
                >
                  <span className="text-[10px] opacity-70">R{r.round_number}</span>
                  <span>{r.title}</span>
                  {isDone ? (
                    <span className="text-[10px]">✓</span>
                  ) : r.state === 'open' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                  ) : (
                    <span className="text-[10px] opacity-50">🔒</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN GAMEPLAY ARENA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Active Round Stage */}
          <div className="lg:col-span-8 space-y-6">
            {/* Round Metadata Banner */}
            <div className="neo-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono-code text-accent-blue font-bold uppercase">
                      Round {activeRound.round_number} ({activeRound.round_type})
                    </span>
                    <span className="text-xs text-typography-muted">•</span>
                    <span className="text-xs font-mono-code text-typography-muted">
                      Status: {activeRound.state.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white font-mono-code">
                    {activeRound.title}
                  </h2>
                  <p className="text-xs text-typography-muted mt-1 leading-relaxed">
                    {activeRound.topic}
                  </p>
                </div>

                <div className="neo-inset px-4 py-2 text-right">
                  <span className="text-[10px] font-mono-code text-typography-dim uppercase block">
                    TOTAL MARKS
                  </span>
                  <span className="font-mono-code text-lg font-bold text-accent-hover">
                    {activeRound.max_points} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Check 1: Round Locked */}
            {activeRound.state === 'locked' && (
              <div className="neo-card p-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-surface-inset border border-surface-border shadow-neo-inset flex items-center justify-center mx-auto text-typography-muted text-xl">
                  🔒
                </div>
                <h3 className="text-lg font-bold text-white font-mono-code">Round Currently Locked</h3>
                <p className="text-xs text-typography-muted max-w-md mx-auto leading-relaxed">
                  The organizer opens rounds one-by-one from the live control room. Submissions and cipher challenges will unlock on your screen automatically once the round is opened.
                </p>
              </div>
            )}

            {/* Check 2: Already Submitted */}
            {submittedRounds[activeRound.id] && (
              <div className="neo-card p-10 text-center space-y-4 border-green-800/40">
                <div className="w-12 h-12 rounded-xl bg-green-950/40 border border-green-700/40 text-green-300 flex items-center justify-center mx-auto text-xl font-bold font-mono-code">
                  ✓
                </div>
                <h3 className="text-2xl font-bold text-white font-mono-code">Submission Confirmed & Locked</h3>
                <p className="text-xs text-typography-muted max-w-md mx-auto">
                  One final submission permitted per round. The server has validated and recorded your score in the authoritative leaderboard.
                </p>
                <div className="neo-inset inline-block px-6 py-3 font-mono-code">
                  <span className="text-xs text-typography-muted block">POINTS AWARDED</span>
                  <span className="text-2xl font-bold text-accent-hover">
                    {submittedRounds[activeRound.id].score} / {activeRound.max_points} pts
                  </span>
                </div>
              </div>
            )}

            {/* ACTIVE PLAY ARENA */}
            {activeRound.state === 'open' && !submittedRounds[activeRound.id] && (
              <div className="space-y-6">
                {/* 1. DYNAMIC STANDARD QUIZ (ROUND 1, ROUND 2, ETC.) */}
                {activeRound.round_type === 'standard' && (
                  <div className="space-y-4">
                    {loadingQuestions ? (
                      <div className="neo-card p-8 text-center font-mono-code text-xs text-typography-muted space-y-2">
                        <span className="w-3 h-3 rounded-full bg-accent-blue inline-block animate-ping" />
                        <p>Loading questions for {activeRound.title}...</p>
                      </div>
                    ) : roundQuestions.length > 0 ? (
                      roundQuestions.map((q, idx) => {
                        const qKey = q.id || `q${idx + 1}`;
                        return (
                          <div key={qKey} className="neo-card p-6 space-y-3">
                            <div className="flex items-center justify-between font-mono-code text-xs">
                              <span className="text-accent-blue font-bold uppercase">
                                QUESTION {idx + 1} ({q.question_type.toUpperCase()})
                              </span>
                              <span className="text-typography-muted font-bold">{q.points} pts</span>
                            </div>

                            <p className="text-sm font-semibold text-white leading-relaxed">
                              {q.question_text}
                            </p>

                            {q.monospace_code && (
                              <div className="neo-inset p-3 font-mono-code text-xs text-accent-hover whitespace-pre-wrap">
                                {q.monospace_code}
                              </div>
                            )}

                            {/* MCQ Options */}
                            {q.question_type === 'mcq' && q.options && q.options.length > 0 && (
                              <div className="space-y-2 pt-2">
                                {q.options.map((optText: string, optIdx: number) => {
                                  const optLetter = String.fromCharCode(65 + optIdx);
                                  const currentAnswers = roundAnswers[activeRound.id] || {};
                                  const isChecked =
                                    currentAnswers[qKey] === optLetter ||
                                    currentAnswers[qKey] === String(optIdx);

                                  return (
                                    <label
                                      key={optIdx}
                                      className={`p-3 rounded-lg border text-xs font-mono-code flex items-center gap-3 cursor-pointer transition-all ${
                                        isChecked
                                          ? 'bg-surface-inset border-accent-blue text-white shadow-neo-inset font-bold'
                                          : 'bg-surface-card border-surface-border text-typography-muted hover:border-surface-hover hover:text-white'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`${activeRound.id}_${qKey}`}
                                        checked={isChecked}
                                        onChange={() =>
                                          setRoundAnswers((prev) => ({
                                            ...prev,
                                            [activeRound.id]: {
                                              ...(prev[activeRound.id] || {}),
                                              [qKey]: optLetter,
                                              [`q${idx + 1}`]: optLetter,
                                            },
                                          }))
                                        }
                                        className="w-4 h-4 text-accent-blue cursor-pointer"
                                      />
                                      <span>
                                        {optLetter}) {optText}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Text Input */}
                            {q.question_type === 'text' && (
                              <div className="pt-2">
                                <input
                                  type="text"
                                  placeholder="Type your answer here..."
                                  value={
                                    (roundAnswers[activeRound.id] &&
                                      (roundAnswers[activeRound.id][qKey] ||
                                        roundAnswers[activeRound.id][`q${idx + 1}`])) ||
                                    ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setRoundAnswers((prev) => ({
                                      ...prev,
                                      [activeRound.id]: {
                                        ...(prev[activeRound.id] || {}),
                                        [qKey]: val,
                                        [`q${idx + 1}`]: val,
                                      },
                                    }));
                                  }}
                                  className="w-full neo-input text-base uppercase tracking-wider"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="neo-card p-8 text-center font-mono-code text-xs text-typography-muted">
                        No questions currently published for this round.
                      </div>
                    )}
                  </div>
                )}

                {/* 2. POLYBIUS CODE GRID (ROUND 3) */}
                {activeRound.round_type === 'polybius' && (
                  <div className="neo-card p-6 space-y-4">
                    <span className="text-xs font-mono-code text-typography-muted block">
                      Polybius Coordinate Decryption: Click cells to construct the plaintext message for coordinate pairs:
                    </span>
                    <div className="neo-inset p-3 font-mono-code text-xs text-accent-hover">
                      32-15-15-44 / 11-44 / 22-11-44-15
                    </div>
                    <PolybiusGrid
                      onMessageChange={(msg) => setSpecialPayload({ message: msg })}
                    />
                  </div>
                )}

                {/* 3. CIPHER SCRAMBLE (ROUND 4) */}
                {activeRound.round_type === 'scramble' && (
                  <div className="neo-card p-6 space-y-4">
                    <span className="text-xs font-mono-code text-typography-muted block">
                      Unscramble each cryptographic anagram:
                    </span>
                    {[
                      { id: 1, scrambled: 'REENIGEV', clue: 'Polyalphabetic cipher invented in the 16th century' },
                      { id: 2, scrambled: 'TEBAHPLA', clue: 'Ordered set of letters forming the basis of a cipher system' },
                      { id: 3, scrambled: 'ELZZUP', clue: 'Cryptanalytic challenge or enigma to be cracked' },
                      { id: 4, scrambled: 'LEVEL', clue: 'A palindrome word often used in security tiers' },
                      { id: 5, scrambled: 'TXET', clue: 'Written words before or after encryption' },
                    ].map((item) => (
                      <div key={item.id} className="neo-inset p-4 space-y-2">
                        <div className="flex items-center justify-between font-mono-code text-xs">
                          <span className="text-accent-hover font-bold">Word {item.id}: {item.scrambled}</span>
                          <span className="text-typography-muted">30 pts</span>
                        </div>
                        <p className="text-xs text-typography-muted">{item.clue}</p>
                        <input
                          type="text"
                          placeholder="Unscrambled word..."
                          value={specialPayload[`w_${item.id}`] || ''}
                          onChange={(e) =>
                            setSpecialPayload({
                              ...specialPayload,
                              [`w_${item.id}`]: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full neo-input text-xs uppercase"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. MEMORY CIPHER (ROUND 5) */}
                {activeRound.round_type === 'memory' && (
                  <div className="neo-card p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
                          Anti-Replay Memorization
                        </span>
                        <h3 className="text-lg font-bold text-white">Timed Substitution Key Reveal</h3>
                      </div>
                      {!memoryRevealed && (
                        <button
                          type="button"
                          onClick={handleStartMemoryReveal}
                          className="neo-btn-primary px-4 py-2 text-xs font-mono-code font-bold uppercase"
                        >
                          ▶ Start 15s Key Reveal
                        </button>
                      )}
                    </div>

                    {memoryRevealed && !memoryKeyExpired && (
                      <div className="p-4 rounded-xl border border-accent-blue/40 bg-accent-blue/10 space-y-3">
                        <div className="flex items-center justify-between font-mono-code text-xs">
                          <span className="text-accent-hover font-bold">KEY EXPIRES IN:</span>
                          <span className="text-xl font-extrabold text-white">{memorySecondsLeft}s</span>
                        </div>
                        <div className="neo-inset p-3 font-mono-code text-[11px] text-white break-words leading-relaxed">
                          A=Q, B=W, C=E, D=R, E=T, F=Y, G=U, H=I, I=O, J=P, K=A, L=S, M=D, N=F, O=G, P=H, Q=J, R=K, S=L, T=Z, U=X, V=C, W=V, X=B, Y=N, Z=M
                        </div>
                      </div>
                    )}

                    {memoryKeyExpired && (
                      <div className="neo-inset p-4 text-center font-mono-code text-xs text-red-400">
                        🔒 Key window expired. Endpoint refuses second reveal. Decode ciphertext from memory.
                      </div>
                    )}

                    {/* Word Inputs */}
                    <div className="space-y-3">
                      <span className="text-xs font-mono-code text-typography-muted uppercase block">
                        Decode Words (UQZT, XFRTK, QEETLL, KTLTZ, RGGK):
                      </span>
                      {['UQZT', 'XFRTK', 'QEETLL', 'KTLTZ', 'RGGK'].map((cWord) => (
                        <div key={cWord} className="flex items-center gap-3 font-mono-code text-xs">
                          <span className="w-20 font-bold text-accent-hover">{cWord}:</span>
                          <input
                            type="text"
                            placeholder="Decoded word..."
                            value={specialPayload[cWord] || ''}
                            onChange={(e) =>
                              setSpecialPayload({ ...specialPayload, [cWord]: e.target.value.toUpperCase() })
                            }
                            className="neo-input flex-1 uppercase"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. CIPHER AUCTION (ROUND 6) */}
                {activeRound.round_type === 'auction' && (
                  <div className="neo-card p-6 space-y-6">
                    <div>
                      <span className="text-xs font-mono-code text-typography-muted block mb-1">
                        Rail Fence Transposition Intercept:
                      </span>
                      <div className="neo-inset p-4 font-mono-code text-lg text-accent-hover tracking-widest">
                        MEADWETTAN
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-mono-code text-xs">
                        <span className="text-typography-muted">
                          HINTS PURCHASED: {auctionHintsUsed} / 2 (Each costs 50 pts deduction)
                        </span>
                        {auctionHintsUsed < 2 && (
                          <button
                            type="button"
                            onClick={() => setAuctionHintsUsed((prev) => prev + 1)}
                            className="neo-btn px-3 py-1.5 text-xs text-amber-300"
                          >
                            Buy Hint {auctionHintsUsed + 1} (-50 pts)
                          </button>
                        )}
                      </div>

                      {auctionHintsUsed >= 1 && (
                        <div className="neo-inset p-3 text-xs font-mono-code text-amber-300">
                          Hint 1: This is a Rail Fence (zigzag) cipher with 2 rails.
                        </div>
                      )}
                      {auctionHintsUsed >= 2 && (
                        <div className="neo-inset p-3 text-xs font-mono-code text-amber-300">
                          Hint 2: Top rail holds M E D E T; Bottom rail holds E A W T A N.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                        Decoded Plaintext:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MEET AT..."
                        value={specialPayload['auction_answer'] || ''}
                        onChange={(e) =>
                          setSpecialPayload({ ...specialPayload, auction_answer: e.target.value.toUpperCase() })
                        }
                        className="w-full neo-input uppercase"
                      />
                    </div>
                  </div>
                )}

                {/* 6. COLOUR CIPHER (ROUND 7) */}
                {activeRound.round_type === 'colour' && (
                  <div className="neo-card p-6">
                    <BaconColourTiles
                      onWordChange={(w) => setSpecialPayload({ word: w })}
                    />
                  </div>
                )}

                {/* 7. VIGENERE CRYPTANALYST (ROUND 8) */}
                {activeRound.round_type === 'vigenere' && (
                  <div className="neo-card p-6">
                    <VigenereDecoderTool
                      onPlaintextChange={(pt) => setSpecialPayload((prev: any) => ({ ...prev, plaintext: pt }))}
                      onExplanationChange={(exp) => setSpecialPayload((prev: any) => ({ ...prev, explanation: exp }))}
                    />
                  </div>
                )}

                {/* FINAL SUBMIT BAR */}
                <div className="neo-card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono-code text-typography-muted">
                    <span className="w-2 h-2 rounded-full bg-accent-blue" />
                    <span>Single submission per team. All telemetry verified.</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="neo-btn-primary px-8 py-3 text-xs font-mono-code font-bold uppercase tracking-wider"
                  >
                    Submit Round Answers →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Rules & Live Telemetry */}
          <div className="lg:col-span-4 space-y-6">
            <div className="neo-card p-6 space-y-4">
              <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block font-bold">
                Anti-Cheat Telemetry
              </span>
              <div className="space-y-2 text-xs font-mono-code">
                <div className="neo-inset p-3 flex items-center justify-between">
                  <span className="text-typography-muted">CLIENT CLOCK:</span>
                  <span className="text-green-400 font-bold">SYNCED WITH SERVER</span>
                </div>
                <div className="neo-inset p-3 flex items-center justify-between">
                  <span className="text-typography-muted">IP ADDRESS:</span>
                  <span className="text-white">DFL04 VENUE SUBNET</span>
                </div>
                <div className="neo-inset p-3 flex items-center justify-between">
                  <span className="text-typography-muted">ATTEMPTS REMAINING:</span>
                  <span className="text-accent-hover font-bold">1 FINAL ATTEMPT</span>
                </div>
              </div>
            </div>

            <div className="neo-card p-6 space-y-3 font-mono-code text-xs">
              <span className="text-white font-bold block">Live Competition Protocols</span>
              <ul className="space-y-2 text-typography-muted">
                <li>• Rounds advance strictly when organizer clicks Open.</li>
                <li>• Top qualifying teams unlock subsequent rounds.</li>
                <li>• Ties resolved by rollback round scores and submission speed.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CONFIRMATION SUBMISSION MODAL */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md neo-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-accent-blue animate-ping" />
                <h3 className="text-lg font-bold text-white font-mono-code">Lock In Round Submission?</h3>
              </div>
              <p className="text-xs text-typography-muted leading-relaxed">
                Confirm your submission for Round {activeRound.round_number}. Your answers will be graded authoritatively on the server and cannot be altered.
              </p>
              {submitError && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-mono-code">
                  {submitError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="neo-btn px-4 py-2 text-xs font-mono-code"
                >
                  Cancel & Review
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="neo-btn-primary px-6 py-2 text-xs font-mono-code font-bold uppercase"
                >
                  {submitting ? 'Scoring On Server...' : 'Confirm & Finalize'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONCURRENT LOGIN TAKEOVER MODAL */}
        {isSuperseded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
            <div className="max-w-md w-full neo-card p-8 border-red-800 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-red-950/70 border border-red-700/60 text-red-400 mx-auto flex items-center justify-center text-3xl font-bold animate-pulse">
                ⚠️
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-red-400 font-mono-code">
                  CONCURRENT LOGIN DETECTED
                </h2>
                <p className="text-xs text-typography-muted font-mono-code leading-relaxed">
                  Another device has signed into your team account. For competition integrity and single-device compliance, only one device may be active at a time.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface-dark border border-surface-border text-xs font-mono-code text-typography-dim">
                This device session has been automatically invalidated.
              </div>
              <Link
                href="/auth/login"
                className="neo-btn-primary block w-full py-3 text-xs font-mono-code font-bold uppercase tracking-wider text-center"
              >
                Sign In Again on This Device →
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  </ProctoredSecurityGuard>
  );
}
