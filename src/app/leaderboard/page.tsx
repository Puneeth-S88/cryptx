'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import type { TeamLeaderboardEntry } from '@/lib/crypto/tie-break';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'eliminated'>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [showTieBreakRules, setShowTieBreakRules] = useState(false);

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setIsFrozen(data.frozen || false);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredTeams = useMemo(() => {
    return leaderboard.filter((team) => {
      const matchesSearch = team.team_name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'active') return !team.is_eliminated;
      if (statusFilter === 'eliminated') return team.is_eliminated;
      return true;
    });
  }, [leaderboard, searchQuery, statusFilter]);

  // Top 3 Podium
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  const handleExportCSV = () => {
    if (leaderboard.length === 0) return;
    const headers = ['Rank', 'Team Name', 'Status', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'Total Score', 'Last Submission Time'];
    const rows = leaderboard.map((t) => [
      t.rank,
      `"${t.team_name.replace(/"/g, '""')}"`,
      t.is_eliminated ? `Eliminated (R${t.eliminated_after_round || 'N'})` : 'Active',
      t.per_round_scores?.[1]?.points ?? 0,
      t.per_round_scores?.[2]?.points ?? 0,
      t.per_round_scores?.[3]?.points ?? 0,
      t.per_round_scores?.[4]?.points ?? 0,
      t.per_round_scores?.[5]?.points ?? 0,
      t.per_round_scores?.[6]?.points ?? 0,
      t.per_round_scores?.[7]?.points ?? 0,
      t.per_round_scores?.[8]?.points ?? 0,
      t.total_score,
      t.last_submission_time || 'N/A',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CRYPTEX_2026_Leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* LEADERBOARD HEADER COMMAND BAR */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest font-bold">
                Real-Time Public Broadcast
              </span>
              {lastRefreshedAt && (
                <span className="text-[11px] font-mono-code text-typography-muted">
                  • Synced: {lastRefreshedAt}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1 font-mono-code">
              OFFICIAL LEADERBOARD
            </h1>
            <p className="text-xs text-typography-muted font-mono-code mt-1">
              Venue DFL04 • Authoritative Server Scoring • Live Tie-Break Engine Active
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isFrozen && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-300 font-mono-code text-xs font-bold animate-pulse">
                <span>❄</span> LEADERBOARD FROZEN FOR FINALE
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowTieBreakRules(!showTieBreakRules)}
              className="neo-btn px-3 py-2 text-xs font-mono-code flex items-center gap-1.5"
            >
              <span>⚖</span> Tie-Break Rules
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="neo-btn px-3.5 py-2 text-xs font-mono-code hover:text-white flex items-center gap-1.5"
            >
              <span>⬇</span> Export CSV
            </button>
            <Link
              href="/display"
              target="_blank"
              className="neo-btn-primary px-4 py-2 text-xs font-mono-code font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <span>📺</span> Big Screen ↗
            </Link>
          </div>
        </div>

        {/* TIE-BREAK RULES COLLAPSIBLE BANNER */}
        {showTieBreakRules && (
          <div className="p-5 rounded-xl bg-surface-card border border-accent-blue/40 font-mono-code text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border">
              <span className="font-bold text-accent-hover text-sm">
                CRYPTEX Deterministic Tie-Break Rules Hierarchy
              </span>
              <button
                type="button"
                onClick={() => setShowTieBreakRules(false)}
                className="text-typography-muted hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-typography-muted pt-1">
              <li><strong className="text-white">Rule 1 (Total Points):</strong> Highest cumulative points across all active rounds.</li>
              <li><strong className="text-white">Rule 2 (Final Round Marks):</strong> If total is tied, points scored in the most recent closed round.</li>
              <li><strong className="text-white">Rule 3 (Round Rollback):</strong> Successive round rollback down to Round 1 until tie is broken.</li>
              <li><strong className="text-white">Rule 4 (Submission Timestamp):</strong> Earliest final submission recorded on the authoritative server.</li>
            </ol>
          </div>
        )}

        {/* TOP 3 PODIUM SHOWCASE */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Rank 2 (Silver) */}
            {top2 && (
              <div className="neo-card p-6 border-zinc-400/30 flex flex-col justify-between order-2 md:order-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-400/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between font-mono-code text-xs mb-3">
                  <span className="px-3 py-1 rounded-full bg-zinc-700/30 text-zinc-300 font-bold border border-zinc-600/40">
                    🥈 2ND PLACE
                  </span>
                  <span className="text-zinc-400">#2</span>
                </div>
                <div className="space-y-1 mb-4">
                  <h3 className="text-2xl font-extrabold text-white font-mono-code truncate">
                    {top2.team_name}
                  </h3>
                  <span className="text-[11px] font-mono-code text-green-400 block">
                    {top2.is_eliminated ? `Eliminated R${top2.eliminated_after_round}` : 'Qualified & Active'}
                  </span>
                </div>
                <div className="pt-4 border-t border-surface-border flex items-baseline justify-between font-mono-code">
                  <span className="text-xs text-typography-muted">TOTAL MARKS</span>
                  <span className="text-3xl font-extrabold text-zinc-200">{top2.total_score} pts</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold - Centerpiece) */}
            {top1 && (
              <div className="neo-card p-6 border-yellow-500/50 bg-gradient-to-b from-yellow-950/20 via-surface-card to-surface-card flex flex-col justify-between order-1 md:order-2 shadow-2xl relative overflow-hidden md:-translate-y-2">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
                <div className="flex items-center justify-between font-mono-code text-xs mb-3">
                  <span className="px-3 py-1 rounded-full bg-yellow-950/70 text-yellow-300 font-extrabold border border-yellow-500/50 flex items-center gap-1.5 shadow-sm shadow-yellow-500/20">
                    <span>👑</span> 🥇 1ST PLACE CHAMPION
                  </span>
                  <span className="text-yellow-400 font-bold">#1</span>
                </div>
                <div className="space-y-1 mb-4">
                  <h3 className="text-3xl font-extrabold text-white font-mono-code truncate">
                    {top1.team_name}
                  </h3>
                  <span className="text-xs font-mono-code text-yellow-300 font-semibold block">
                    Highest Cumulative Score • Tournament Leader
                  </span>
                </div>
                <div className="pt-4 border-t border-yellow-500/20 flex items-baseline justify-between font-mono-code">
                  <span className="text-xs text-yellow-400/80 font-bold">CHAMPION SCORE</span>
                  <span className="text-4xl font-extrabold text-yellow-300">{top1.total_score} pts</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3 && (
              <div className="neo-card p-6 border-amber-700/30 flex flex-col justify-between order-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between font-mono-code text-xs mb-3">
                  <span className="px-3 py-1 rounded-full bg-amber-950/40 text-amber-300 font-bold border border-amber-700/40">
                    🥉 3RD PLACE
                  </span>
                  <span className="text-amber-500">#3</span>
                </div>
                <div className="space-y-1 mb-4">
                  <h3 className="text-2xl font-extrabold text-white font-mono-code truncate">
                    {top3.team_name}
                  </h3>
                  <span className="text-[11px] font-mono-code text-green-400 block">
                    {top3.is_eliminated ? `Eliminated R${top3.eliminated_after_round}` : 'Qualified & Active'}
                  </span>
                </div>
                <div className="pt-4 border-t border-surface-border flex items-baseline justify-between font-mono-code">
                  <span className="text-xs text-typography-muted">TOTAL MARKS</span>
                  <span className="text-3xl font-extrabold text-amber-300">{top3.total_score} pts</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEARCH & FILTER CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-surface-card border border-surface-border">
          <div className="w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team name..."
              className="neo-input w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-2 font-mono-code text-xs w-full sm:w-auto">
            <span className="text-typography-muted mr-1 hidden sm:inline">Filter:</span>
            {(['all', 'active', 'eliminated'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all ${
                  statusFilter === filter
                    ? 'bg-accent-blue text-white font-bold shadow-neo-blue-sm'
                    : 'bg-surface-dark border border-surface-border text-typography-muted hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* COMPREHENSIVE LEADERBOARD TABLE */}
        <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-dark text-xs font-mono-code text-typography-muted uppercase tracking-wider">
                  <th className="py-4 px-5 text-center w-20">Rank</th>
                  <th className="py-4 px-6 min-w-[200px]">Team Name</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-3 text-center">R1</th>
                  <th className="py-4 px-3 text-center">R2</th>
                  <th className="py-4 px-3 text-center">R3</th>
                  <th className="py-4 px-3 text-center">R4</th>
                  <th className="py-4 px-3 text-center">R5</th>
                  <th className="py-4 px-3 text-center">R6</th>
                  <th className="py-4 px-3 text-center">R7</th>
                  <th className="py-4 px-3 text-center">R8</th>
                  <th className="py-4 px-6 text-right min-w-[130px]">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border font-mono-code text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-typography-muted">
                      <div className="flex items-center justify-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-ping" />
                        <span>Synchronizing with authoritative server scoreboard...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-typography-muted">
                      No matching teams found.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                    <tr
                      key={team.team_id}
                      className={`hover:bg-surface-hover/40 transition-colors ${
                        team.rank === 1
                          ? 'bg-yellow-950/10'
                          : team.rank === 2
                          ? 'bg-zinc-800/10'
                          : team.rank === 3
                          ? 'bg-amber-950/10'
                          : ''
                      } ${team.is_eliminated ? 'opacity-60 bg-surface-dark/50' : ''}`}
                    >
                      {/* Rank Column */}
                      <td className="py-4 px-5 text-center font-bold text-white">
                        {team.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                            🥇 1
                          </span>
                        ) : team.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-400/20 text-zinc-300 border border-zinc-400/40">
                            🥈 2
                          </span>
                        ) : team.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-300 border border-amber-700/40">
                            🥉 3
                          </span>
                        ) : (
                          <span className="text-typography-muted font-normal">#{team.rank}</span>
                        )}
                      </td>

                      {/* Team Name */}
                      <td className="py-4 px-6 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-accent-blue" />
                          <span className="text-sm font-bold">{team.team_name}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {team.is_eliminated ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] bg-red-950/60 border border-red-800/40 text-red-300 uppercase font-bold">
                            Eliminated R{team.eliminated_after_round || 'N'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[10px] bg-green-950/60 border border-green-700/40 text-green-300 uppercase font-bold">
                            Active
                          </span>
                        )}
                      </td>

                      {/* R1 through R8 Marks */}
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => {
                        const scoreObj = team.per_round_scores?.[String(r)];
                        const val = scoreObj?.points;
                        const hasScore = val !== undefined && val !== null;
                        return (
                          <td key={r} className="py-4 px-3 text-center">
                            {hasScore ? (
                              <span className="px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-white text-[11px] font-semibold">
                                {val}
                              </span>
                            ) : (
                              <span className="text-typography-dim">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Score */}
                      <td className="py-4 px-6 text-right font-extrabold text-base text-accent-hover">
                        {team.total_score} <span className="text-xs text-typography-muted font-normal">pts</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
