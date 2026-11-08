'use client';

import { useState } from 'react';
import type { RoundType } from '@/lib/crypto/schemas';

export interface RoundSummary {
  id: string;
  round_number: number;
  title: string;
  topic: string;
  round_type: RoundType;
  duration_seconds: number;
  max_points: number;
  state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
  order_index: number;
  qualification_note?: string;
}

interface RoundBuilderDashboardProps {
  eventId: string;
  rounds: RoundSummary[];
  onSelectRound: (roundId: string) => void;
  onCreateRound: (round: Omit<RoundSummary, 'id'>) => Promise<void>;
  onDeleteRound: (roundId: string) => Promise<void>;
  onDuplicateRound: (roundId: string) => Promise<void>;
  onReorderRounds: (reorderedIds: string[]) => Promise<void>;
  requireElevation: (action: () => Promise<void>) => void;
}

const templateRoundTypes: Array<{ type: RoundType; label: string; desc: string }> = [
  { type: 'standard', label: 'Standard Quiz', desc: 'Questions built using Question Builder (MCQ & Text answers)' },
  { type: 'polybius', label: 'Polybius Code Grid', desc: 'Interactive 5x5 coordinate click grid' },
  { type: 'scramble', label: 'Cipher Scramble', desc: 'Interactive drag-and-drop letter anagrams' },
  { type: 'memory', label: 'Memory Cipher', desc: 'Timed key reveal with anti-replay memory decoding' },
  { type: 'auction', label: 'Cipher Auction', desc: 'Rail Fence cipher with tiered penalty hints' },
  { type: 'colour', label: 'Colour Cipher', desc: 'Baconian visual steganography with coloured tiles' },
  { type: 'vigenere', label: 'Master Cryptanalyst', desc: 'Vigenere workbench with plaintext and explanation marking' },
  { type: 'jury', label: 'Jury Manual Scoring', desc: 'Organizer/jury enters marks per team directly' },
];

export function RoundBuilderDashboard({
  eventId,
  rounds,
  onSelectRound,
  onCreateRound,
  onDeleteRound,
  onDuplicateRound,
  onReorderRounds,
  requireElevation,
}: RoundBuilderDashboardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newType, setNewType] = useState<RoundType>('standard');
  const [newDurationMin, setNewDurationMin] = useState(10);
  const [newPoints, setNewPoints] = useState(100);
  const [newNote, setNewNote] = useState('Top teams with highest cumulative score advance.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requireElevation(async () => {
      setIsSubmitting(true);
      try {
        await onCreateRound({
          round_number: rounds.length + 1,
          title: newTitle,
          topic: newTopic,
          round_type: newType,
          duration_seconds: newDurationMin * 60,
          max_points: newPoints,
          state: 'locked',
          order_index: rounds.length + 1,
          qualification_note: newNote,
        });
        setShowCreateModal(false);
        setNewTitle('');
        setNewTopic('');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const moveRound = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= rounds.length) return;
    const reordered = [...rounds];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onReorderRounds(reordered.map((r) => r.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-card border border-surface-border">
        <div>
          <span className="text-[10px] font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
            Competition Structure
          </span>
          <h2 className="text-xl font-bold text-white">Dynamic Round Builder</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-bold transition-all shadow-sm shadow-accent-glow"
        >
          + Add New Round
        </button>
      </div>

      {/* Rounds List */}
      <div className="grid grid-cols-1 gap-3">
        {rounds.map((round, idx) => (
          <div
            key={round.id}
            className="p-4 rounded-xl bg-surface-card border border-surface-border hover:border-surface-hover transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1 items-center font-mono-code text-xs text-typography-muted">
                <button
                  type="button"
                  onClick={() => moveRound(idx, idx - 1)}
                  disabled={idx === 0}
                  className="hover:text-white disabled:opacity-20"
                >
                  ▲
                </button>
                <span className="font-bold text-white">#{round.round_number}</span>
                <button
                  type="button"
                  onClick={() => moveRound(idx, idx + 1)}
                  disabled={idx === rounds.length - 1}
                  className="hover:text-white disabled:opacity-20"
                >
                  ▼
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">{round.title}</span>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-surface-dark border border-surface-border uppercase text-accent-blue">
                    {round.round_type}
                  </span>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-surface-dark border border-surface-border uppercase text-typography-muted">
                    {round.state}
                  </span>
                </div>
                <p className="text-xs text-typography-muted">{round.topic}</p>
                <div className="flex items-center gap-4 text-[11px] font-mono-code text-typography-muted mt-2">
                  <span>⏱ {Math.round(round.duration_seconds / 60)} mins</span>
                  <span>🏆 {round.max_points} pts</span>
                  {round.qualification_note && <span className="text-zinc-500">Note: {round.qualification_note}</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 font-mono-code text-xs">
              <button
                type="button"
                onClick={() => onSelectRound(round.id)}
                className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border hover:border-accent-blue text-white transition-colors"
              >
                Edit Content / Questions →
              </button>
              <button
                type="button"
                onClick={() => requireElevation(() => onDuplicateRound(round.id))}
                className="px-2.5 py-1.5 rounded bg-surface-dark border border-surface-border text-typography-muted hover:text-white transition-colors"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => requireElevation(() => onDeleteRound(round.id))}
                disabled={round.state === 'open' || round.state === 'scored'}
                className="px-2.5 py-1.5 rounded bg-surface-dark border border-surface-border text-red-400 hover:border-red-500/50 transition-colors disabled:opacity-20"
                title={round.state === 'open' || round.state === 'scored' ? 'Cannot delete open/scored round' : 'Delete'}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Round Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl bg-surface-card border border-surface-border p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div>
              <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest block mb-1">
                New Stage
              </span>
              <h3 className="text-xl font-bold text-white">Create Competition Round</h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Round Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quantum Cryptanalysis"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Topic Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asymmetric key exchange & post-quantum lattice attacks"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-2">
                  Select Round Type Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templateRoundTypes.map((tpl) => (
                    <div
                      key={tpl.type}
                      onClick={() => setNewType(tpl.type)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        newType === tpl.type
                          ? 'border-accent-blue bg-accent-blue/10 text-white'
                          : 'border-surface-border bg-surface-dark text-typography-muted hover:border-surface-hover'
                      }`}
                    >
                      <span className="font-bold block font-mono-code">{tpl.label}</span>
                      <span className="text-[10px] text-typography-muted leading-tight">{tpl.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                    Time Limit (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={newDurationMin}
                    onChange={(e) => setNewDurationMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                    Initial Marks (pts)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPoints}
                    onChange={(e) => setNewPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Qualification Note
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded font-mono-code text-xs text-typography-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-bold transition-all shadow-sm shadow-accent-glow"
                >
                  {isSubmitting ? 'Creating...' : 'Create Round →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
