'use client';

import { useEffect, useState, useRef } from 'react';
import type { TeamLeaderboardEntry } from '@/lib/crypto/tie-break';

interface AnnouncementItem {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  createdAt: string;
  active: boolean;
  author: string;
}

export default function BigScreenDisplayPage() {
  const [panelIndex, setPanelIndex] = useState(0); // 0: Leaderboard, 1: Active Round, 2: Announcements
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementItem | null>(null);
  const [announcementsList, setAnnouncementsList] = useState<AnnouncementItem[]>([]);
  const lastNoticeIdRef = useRef<string | null>(null);

  const [activeRound, setActiveRound] = useState<{
    round_number: number;
    title: string;
    state: string;
    deadline: string | null;
  }>({
    round_number: 1,
    title: 'The Secret Code',
    state: 'open',
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  // Poll active round and timer every 4 seconds
  useEffect(() => {
    async function loadActiveRound() {
      try {
        const res = await fetch('/api/rounds');
        if (res.ok) {
          const data = await res.json();
          if (data.activeRound) {
            setActiveRound({
              round_number: data.activeRound.round_number,
              title: data.activeRound.title,
              state: data.activeRound.state,
              deadline: data.activeRound.deadline,
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadActiveRound();
    const interval = setInterval(loadActiveRound, 4000);
    return () => clearInterval(interval);
  }, []);

  // Rotate panels every 15 seconds for projector screen view
  useEffect(() => {
    const timer = setInterval(() => {
      setPanelIndex((prev) => (prev + 1) % 3);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Poll leaderboard every 6 seconds
  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setIsFrozen(data.frozen || false);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 6000);
    return () => clearInterval(interval);
  }, []);

  // Poll announcements every 3 seconds
  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
          const data = await res.json();
          setActiveAnnouncement(data.active || null);
          setAnnouncementsList(data.announcements || []);

          // If a brand new announcement is pushed, immediately switch to panel 2 (Notices)
          if (data.active && data.active.id !== lastNoticeIdRef.current) {
            lastNoticeIdRef.current = data.active.id;
            setPanelIndex(2);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6 sm:p-8 flex flex-col justify-between font-sans select-none overflow-hidden relative">
      {/* PERSISTENT REAL-TIME TICKER BANNER ACROSS ALL SCREENS */}
      {activeAnnouncement && (
        <div
          className={`mb-6 p-4 rounded-xl font-mono-code flex items-center justify-between shadow-2xl transition-all ${
            activeAnnouncement.priority === 'urgent'
              ? 'bg-gradient-to-r from-red-950/90 via-red-900 to-red-950 border-2 border-red-500 animate-pulse'
              : 'bg-gradient-to-r from-blue-950/90 via-blue-900 to-indigo-950 border border-accent-blue/80'
          }`}
        >
          <div className="flex items-center gap-4 overflow-hidden">
            <span
              className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0 ${
                activeAnnouncement.priority === 'urgent'
                  ? 'bg-red-600 text-white animate-bounce'
                  : 'bg-accent-blue text-white'
              }`}
            >
              🚨 {activeAnnouncement.priority === 'urgent' ? 'URGENT BROADCAST' : 'LIVE NOTICE'}
            </span>
            <span className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
              {activeAnnouncement.message}
            </span>
          </div>
          <span className="text-xs text-typography-muted shrink-0 ml-4 hidden md:inline">
            From: {activeAnnouncement.author}
          </span>
        </div>
      )}

      {/* HEADER BANNER */}
      <header className="flex items-center justify-between border-b border-surface-border pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center shadow-lg">
            <span className="font-mono-code font-bold text-accent-blue text-2xl">CX</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono-code font-extrabold text-3xl sm:text-4xl tracking-wider text-white">
                CRYPTEX 2026
              </h1>
              <span className="px-3 py-1 rounded bg-accent-blue text-xs font-mono-code font-bold uppercase tracking-wider text-white">
                LIVE PROJECTOR STREAM
              </span>
              {isFrozen && (
                <span className="px-3 py-1 rounded bg-amber-600 text-xs font-mono-code font-bold uppercase tracking-wider text-white animate-pulse">
                  LEADERBOARD FROZEN
                </span>
              )}
            </div>
            <p className="text-sm font-mono-code text-typography-muted mt-1">
              VENUE: DFL04 • 11 NOVEMBER 2026 • 2:00 PM - 4:00 PM IST
            </p>
          </div>
        </div>

        {/* PANEL SWITCH INDICATORS */}
        <div className="flex items-center gap-3">
          {['LEADERBOARD', 'ROUND STATUS', 'NOTICES & BULLETINS'].map((label, idx) => (
            <button
              key={label}
              onClick={() => setPanelIndex(idx)}
              className={`px-5 py-2.5 rounded-lg text-xs font-mono-code transition-all ${
                panelIndex === idx
                  ? 'bg-accent-blue text-white shadow-lg shadow-accent-glow font-bold scale-105'
                  : 'bg-surface-card text-typography-muted border border-surface-border hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ROTATING CONTENT STAGE */}
      <main className="flex-1 my-6 flex flex-col justify-center">
        {/* PANEL 0: LEADERBOARD SHOWCASE */}
        {panelIndex === 0 && (
          <div className="space-y-4 max-w-6xl mx-auto w-full">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border/50 font-mono-code">
              <h2 className="text-2xl font-bold text-accent-hover tracking-wider flex items-center gap-2">
                <span>🏆</span> OFFICIAL TOURNAMENT STANDINGS
              </h2>
              <span className="text-xs text-typography-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                AUTO-SYNCHRONIZING WITH SERVER
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {leaderboard.slice(0, 7).map((team) => (
                <div
                  key={team.team_id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    team.rank === 1
                      ? 'border-yellow-500 bg-gradient-to-r from-yellow-950/40 via-surface-card to-surface-card shadow-lg shadow-yellow-500/10'
                      : team.rank === 2
                      ? 'border-zinc-400/60 bg-gradient-to-r from-zinc-800/40 to-surface-card'
                      : team.rank === 3
                      ? 'border-amber-700/60 bg-gradient-to-r from-amber-950/40 to-surface-card'
                      : 'border-surface-border bg-surface-card'
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <span className="font-mono-code font-extrabold text-3xl w-14 text-center text-white">
                      {team.rank === 1 ? '🥇 1' : team.rank === 2 ? '🥈 2' : team.rank === 3 ? '🥉 3' : `#${team.rank}`}
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold text-white font-mono-code">{team.team_name}</h3>
                      <p className="text-xs font-mono-code text-typography-muted mt-0.5">
                        {team.is_eliminated
                          ? `Eliminated after Round ${team.eliminated_after_round}`
                          : 'Qualified • Championship Contender'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 font-mono-code">
                    <div className="text-right">
                      <span className="text-xs text-typography-muted block uppercase tracking-wider">TOTAL SCORE</span>
                      <span className="text-4xl font-extrabold text-accent-hover">{team.total_score}</span>
                    </div>
                  </div>
                </div>
              ))}

              {leaderboard.length === 0 && (
                <div className="p-16 text-center text-typography-muted font-mono-code text-lg">
                  Competition awaiting Round 1 kickoff. Teams will display here immediately upon scoring.
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 1: CURRENT LIVE STAGE */}
        {panelIndex === 1 && (
          <div className="p-12 rounded-2xl bg-surface-card border border-surface-border text-center space-y-6 max-w-4xl mx-auto w-full shadow-2xl">
            <span className="font-mono-code text-sm text-accent-blue uppercase tracking-widest block font-bold">
              CURRENT LIVE STAGE
            </span>
            <h2 className="text-6xl font-extrabold text-white font-mono-code">
              Round {activeRound.round_number}: {activeRound.title}
            </h2>
            <div className="flex items-center justify-center gap-4 pt-4 font-mono-code">
              <span className="px-6 py-3 rounded-xl bg-green-950/60 border border-green-700/60 text-green-300 font-bold text-xl uppercase tracking-wider flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                STATUS: {activeRound.state.toUpperCase()}
              </span>
            </div>
            <p className="text-typography-muted text-base max-w-lg mx-auto font-mono-code">
              All teams must confirm answers before the round timer reaches 00:00. Single final submission strictly enforced.
            </p>
          </div>
        )}

        {/* PANEL 2: DYNAMIC BROADCAST NOTICES & BULLETINS */}
        {panelIndex === 2 && (
          <div className="p-8 sm:p-12 rounded-2xl bg-surface-card border border-surface-border space-y-8 max-w-4xl mx-auto w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-accent-blue animate-ping" />
                <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest font-bold">
                  OFFICIAL COMMAND ROOM BROADCAST STREAM
                </span>
              </div>
              <span className="text-xs font-mono-code text-typography-muted">VENUE DFL04</span>
            </div>

            {/* Featured Active Announcement */}
            {activeAnnouncement ? (
              <div
                className={`p-8 rounded-xl font-mono-code text-center space-y-4 shadow-xl border ${
                  activeAnnouncement.priority === 'urgent'
                    ? 'bg-red-950/40 border-red-600/70'
                    : 'bg-blue-950/40 border-accent-blue/70'
                }`}
              >
                <span
                  className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${
                    activeAnnouncement.priority === 'urgent'
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-accent-blue text-white'
                  }`}
                >
                  {activeAnnouncement.priority === 'urgent' ? '🚨 URGENT ACTION REQUIRED' : '📌 ACTIVE NOTICE'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                  &ldquo;{activeAnnouncement.message}&rdquo;
                </h2>
                <div className="flex items-center justify-center gap-4 text-xs text-typography-muted pt-2">
                  <span>Authorized by: {activeAnnouncement.author}</span>
                  <span>•</span>
                  <span>Dispatched: {new Date(activeAnnouncement.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-surface-dark border border-surface-border text-center text-typography-muted font-mono-code">
                No active announcements currently broadcasted.
              </div>
            )}

            {/* Recent Notices Log */}
            <div className="space-y-3 font-mono-code text-xs">
              <span className="text-typography-muted uppercase tracking-wider block font-bold">
                Recent Broadcast Bulletins:
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {announcementsList.map((notice) => (
                  <div
                    key={notice.id}
                    className="p-3.5 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-accent-hover font-bold">•</span>
                      <span className="text-white font-medium">{notice.message}</span>
                    </div>
                    <span className="text-typography-dim text-[11px] shrink-0 ml-4">
                      {new Date(notice.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="pt-6 border-t border-surface-border flex items-center justify-between text-xs font-mono-code text-typography-muted">
        <div>CRYPTEX 2026 ORGANIZER CONTROLLED • AUTO-ROTATING (15s)</div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
          <span>PROJECTOR SAFE READ-ONLY CHANNEL</span>
        </div>
      </footer>
    </div>
  );
}
