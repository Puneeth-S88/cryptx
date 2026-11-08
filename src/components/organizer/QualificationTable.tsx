'use client';

import { useState, useEffect } from 'react';
import type { TeamLeaderboardEntry } from '@/lib/crypto/tie-break';

interface QualificationTableProps {
  teams: TeamLeaderboardEntry[];
  currentRoundNumber: number;
  onConfirmQualifiers: (selectedTeamIds: string[]) => Promise<void>;
  disabled?: boolean;
}

export function QualificationTable({
  teams,
  currentRoundNumber,
  onConfirmQualifiers,
  disabled,
}: QualificationTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(teams.filter((t) => !t.is_eliminated).map((t) => t.team_id))
  );
  const [confirming, setConfirming] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Re-sync selectedIds whenever teams data updates from server
  useEffect(() => {
    setSelectedIds(new Set(teams.filter((t) => !t.is_eliminated).map((t) => t.team_id)));
  }, [teams]);

  // Quick Action: Select Top N
  const handleSelectTopN = (n: number) => {
    const topIds = teams.slice(0, n).map((t) => t.team_id);
    setSelectedIds(new Set(topIds));
  };

  // Quick Action: Select Above Score
  const handleSelectAboveScore = (minScore: number) => {
    const matching = teams.filter((t) => t.total_score >= minScore).map((t) => t.team_id);
    setSelectedIds(new Set(matching));
  };

  const toggleTeam = (teamId: string) => {
    const next = new Set(selectedIds);
    if (next.has(teamId)) {
      next.delete(teamId);
    } else {
      next.add(teamId);
    }
    setSelectedIds(next);
  };

  const handleFinalConfirm = async () => {
    setConfirming(true);
    setSavedFeedback(false);
    try {
      await onConfirmQualifiers(Array.from(selectedIds));
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 4000);
    } finally {
      setConfirming(false);
    }
  };

  const advancingCount = selectedIds.size;
  const eliminatingCount = teams.length - advancingCount;

  return (
    <div className="space-y-6">
      {/* Quick Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-card border border-surface-border">
        <div className="flex items-center gap-2 font-mono-code text-xs">
          <span className="text-typography-muted mr-1">QUICK SELECT:</span>
          <button
            type="button"
            onClick={() => handleSelectTopN(5)}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-white hover:border-accent-blue transition-colors"
          >
            Top 5
          </button>
          <button
            type="button"
            onClick={() => handleSelectTopN(10)}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-white hover:border-accent-blue transition-colors"
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => handleSelectAboveScore(100)}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-white hover:border-accent-blue transition-colors"
          >
            Score ≥ 100
          </button>
        </div>

        {/* Live Preview Summary */}
        <div className="flex items-center gap-4 font-mono-code text-xs">
          <span className="text-accent-hover font-semibold">
            {advancingCount} Advancing
          </span>
          <span className="text-typography-muted">•</span>
          <span className="text-red-400 font-semibold">
            {eliminatingCount} Eliminated
          </span>
        </div>
      </div>

      {/* Teams Qualification Table */}
      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
        <table className="w-full text-left border-collapse text-xs font-mono-code">
          <thead>
            <tr className="border-b border-surface-border bg-surface-dark text-typography-muted uppercase">
              <th className="py-3 px-4 text-center w-12">Advance</th>
              <th className="py-3 px-4 text-center w-12">Rank</th>
              <th className="py-3 px-6">Team Name</th>
              <th className="py-3 px-4 text-center">Round {currentRoundNumber} Score</th>
              <th className="py-3 px-4 text-center">Cumulative Score</th>
              <th className="py-3 px-6 text-right">Preview Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {teams.map((team) => {
              const isSelected = selectedIds.has(team.team_id);
              const roundScore = team.per_round_scores?.[String(currentRoundNumber)]?.points ?? 0;

              return (
                <tr
                  key={team.team_id}
                  className={`hover:bg-surface-hover/30 transition-colors ${
                    !isSelected ? 'opacity-50 bg-red-950/10' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={isSelected}
                      onChange={() => toggleTeam(team.team_id)}
                      className="w-4 h-4 rounded border-surface-border bg-surface-dark text-accent-blue focus:ring-accent-blue cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-white">
                    #{team.rank}
                  </td>
                  <td className="py-3 px-6 font-semibold text-white">
                    {team.team_name}
                  </td>
                  <td className="py-3 px-4 text-center text-white">
                    {roundScore} pts
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-accent-hover">
                    {team.total_score} pts
                  </td>
                  <td className="py-3 px-6 text-right">
                    {isSelected ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-accent-blue/10 border border-accent-blue/30 text-accent-hover">
                        QUALIFIED FOR R{currentRoundNumber + 1}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/40 border border-red-800/40 text-red-300">
                        ELIMINATE
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-card border border-surface-border">
        <p className="text-xs text-typography-muted font-mono-code">
          Only confirmed qualifiers will be authorized in the database to fetch Round {currentRoundNumber + 1} content.
        </p>

        <div className="flex items-center gap-3 shrink-0">
          {savedFeedback && (
            <span className="text-xs font-mono-code text-green-400 font-bold animate-pulse">
              ✓ Qualifiers saved &amp; enforced!
            </span>
          )}
          <button
            type="button"
            disabled={disabled || confirming}
            onClick={handleFinalConfirm}
            className="px-6 py-2.5 rounded bg-accent-blue hover:bg-accent-hover text-white font-mono-code text-xs font-bold shadow-md shadow-accent-glow transition-all disabled:opacity-50"
          >
            {confirming ? 'Committing Qualification...' : 'Save & Enforce Qualifiers →'}
          </button>
        </div>
      </div>
    </div>
  );
}
