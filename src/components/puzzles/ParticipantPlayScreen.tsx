'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { ServerCountdown } from '@/components/shared/ServerCountdown';
import { PolybiusGrid } from '@/components/puzzles/PolybiusGrid';
import { BaconColourTiles } from '@/components/puzzles/BaconColourTiles';
import { VigenereDecoderTool } from '@/components/puzzles/VigenereDecoderTool';

interface PlayRoundProps {
  round: {
    id: string;
    round_number: number;
    title: string;
    topic: string;
    round_type: string;
    state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
    deadline: string | null;
    max_points: number;
  };
  team: {
    id: string;
    name: string;
    is_qualified: boolean;
    eliminated_after_round?: number | null;
  };
  questions?: Array<{
    id: string;
    question_type: 'mcq' | 'text';
    question_text: string;
    monospace_code?: string;
    options?: string[];
    points: number;
  }>;
  specialContent?: any;
  hasAlreadySubmitted: boolean;
  priorSubmissionScore?: number;
}

export function ParticipantPlayScreen({
  round,
  team,
  questions = [],
  specialContent,
  hasAlreadySubmitted,
  priorSubmissionScore,
}: PlayRoundProps) {
  // Submission payloads
  const [standardAnswers, setStandardAnswers] = useState<Record<string, any>>({});
  const [specialPayload, setSpecialPayload] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(hasAlreadySubmitted);
  const [scoreResult, setScoreResult] = useState<number | null>(priorSubmissionScore ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Anti-cheat telemetry
  const [tabSwitches, setTabSwitches] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1);
      }
    };
    const handlePaste = () => {
      setPasteCount((prev) => prev + 1);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Check 1: Qualification Gate
  if (!team.is_qualified && round.round_number > 1) {
    return (
      <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-800/40 text-red-400 mx-auto flex items-center justify-center font-mono-code text-2xl font-bold">
            !
          </div>
          <h2 className="text-3xl font-bold text-white">Qualification Status Notice</h2>
          <p className="text-sm font-mono-code text-red-300">
            Eliminated after Round {team.eliminated_after_round || round.round_number - 1}.
          </p>
          <p className="text-xs text-typography-muted leading-relaxed">
            Your team is not qualified to enter Round {round.round_number}. Your final scores remain recorded on the public leaderboard.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  // Check 2: Round Locked Gate
  if (round.state === 'locked') {
    return (
      <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between">
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
          <span className="w-3 h-3 rounded-full bg-accent-blue inline-block animate-ping" />
          <h2 className="text-2xl font-bold text-white">Round {round.round_number}: {round.title}</h2>
          <p className="text-xs font-mono-code text-typography-muted">
            Awaiting organizer kickoff. The server will synchronize your timer once the organizer unlocks the round.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = round.round_type === 'standard' ? standardAnswers : specialPayload;

    try {
      const res = await fetch(`/api/rounds/${round.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: round.id,
          teamId: team.id,
          payload,
          telemetry: {
            tab_switch_count: tabSwitches,
            paste_event_count: pasteCount,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Submission rejected by server.');
      } else {
        setSubmissionSuccess(true);
        setScoreResult(data.scoreAwarded ?? data.score ?? 0);
        setShowConfirmModal(false);
      }
    } catch {
      setErrorMessage('Network connection error while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Stage Header & Authoritative Server Timer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono-code text-accent-blue font-bold uppercase">
                Round {round.round_number} ({round.round_type})
              </span>
              <span className="text-xs text-typography-muted">•</span>
              <span className="text-xs font-mono-code text-typography-muted font-bold">
                Team: {team.name}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white">{round.title}</h1>
            <p className="text-xs text-typography-muted mt-1">{round.topic}</p>
          </div>

          <ServerCountdown deadline={round.deadline} state={round.state} />
        </div>

        {/* Already Submitted State */}
        {submissionSuccess && (
          <div className="p-6 rounded-xl bg-surface-card border border-accent-blue/40 space-y-3 text-center">
            <span className="w-3 h-3 rounded-full bg-accent-blue inline-block animate-pulse" />
            <h3 className="text-xl font-bold text-white">Final Submission Recorded</h3>
            <p className="text-xs text-typography-muted">
              One final submission allowed per team. Your response was accepted and scored authoritatively by the server.
            </p>
            {scoreResult !== null && (
              <div className="pt-2 font-mono-code">
                <span className="text-xs text-typography-muted block">MARKS AWARDED</span>
                <span className="text-3xl font-extrabold text-accent-hover">{scoreResult} pts</span>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 font-mono-code text-xs">
            {errorMessage}
          </div>
        )}

        {/* Interactive Play Arena (Active if not submitted) */}
        {!submissionSuccess && round.state === 'open' && (
          <div className="space-y-8">
            {/* 1. STANDARD QUIZ (MCQ & TEXT) */}
            {round.round_type === 'standard' && (
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono-code text-accent-blue font-bold">
                        Question {idx + 1}
                      </span>
                      <span className="text-xs font-mono-code text-typography-muted">
                        {q.points} pts
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-white">{q.question_text}</p>

                    {q.monospace_code && (
                      <div className="p-3 rounded bg-surface-dark border border-surface-border font-mono-code text-xs text-accent-hover overflow-x-auto">
                        {q.monospace_code}
                      </div>
                    )}

                    {/* MCQ Options */}
                    {q.question_type === 'mcq' && q.options && (
                      <div className="space-y-2 pt-2">
                        {q.options.map((opt, oIdx) => (
                          <label
                            key={oIdx}
                            className={`p-3 rounded-lg border text-xs font-mono-code flex items-center gap-3 cursor-pointer transition-all ${
                              standardAnswers[q.id]?.selected_option_index === oIdx
                                ? 'bg-surface-dark border-accent-blue text-white shadow-sm'
                                : 'bg-surface-dark/50 border-surface-border text-typography-muted hover:border-surface-hover'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question_${q.id}`}
                              checked={standardAnswers[q.id]?.selected_option_index === oIdx}
                              onChange={() =>
                                setStandardAnswers({
                                  ...standardAnswers,
                                  [q.id]: { question_id: q.id, type: 'mcq', selected_option_index: oIdx },
                                })
                              }
                              className="w-4 h-4 text-accent-blue cursor-pointer"
                            />
                            <span>{String.fromCharCode(65 + oIdx)}) {opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* TEXT Input */}
                    {q.question_type === 'text' && (
                      <div className="pt-2">
                        <input
                          type="text"
                          placeholder="Type your cryptographic answer..."
                          value={standardAnswers[q.id]?.text_answer || ''}
                          onChange={(e) =>
                            setStandardAnswers({
                              ...standardAnswers,
                              [q.id]: { question_id: q.id, type: 'text', text_answer: e.target.value },
                            })
                          }
                          className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-sm uppercase tracking-wider"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 2. POLYBIUS CODE GRID */}
            {round.round_type === 'polybius' && (
              <PolybiusGrid
                onMessageChange={(msg) => setSpecialPayload({ message: msg })}
              />
            )}

            {/* 3. COLOUR CIPHER */}
            {round.round_type === 'colour' && (
              <BaconColourTiles
                onWordChange={(w) => setSpecialPayload({ word: w })}
              />
            )}

            {/* 4. VIGENERE CRYPTANALYST */}
            {round.round_type === 'vigenere' && (
              <VigenereDecoderTool
                onPlaintextChange={(pt) => setSpecialPayload((prev: any) => ({ ...prev, plaintext: pt }))}
                onExplanationChange={(exp) => setSpecialPayload((prev: any) => ({ ...prev, explanation: exp }))}
              />
            )}

            {/* Submit Action Bar */}
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border flex items-center justify-between">
              <span className="text-xs text-typography-muted font-mono-code">
                Review carefully: Single submission per round.
              </span>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-6 py-2.5 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-bold transition-all shadow-sm shadow-accent-glow"
              >
                Submit Round Answers →
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl bg-surface-card border border-surface-border p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">Confirm Final Submission</h3>
              <p className="text-xs text-typography-muted leading-relaxed">
                You are about to lock in your submission for Round {round.round_number}. Once sent, you cannot alter answers or re-submit.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono-code text-typography-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="px-5 py-2 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-bold transition-all shadow-sm shadow-accent-glow"
                >
                  {isSubmitting ? 'Recording On Server...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
