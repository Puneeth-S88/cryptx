'use client';

import { useState } from 'react';
import { ServerCountdown } from '@/components/shared/ServerCountdown';

interface ControlRoomPanelProps {
  eventId: string;
  round: {
    id: string;
    round_number: number;
    title: string;
    state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
    deadline: string | null;
    duration_seconds: number;
  };
  stats: {
    totalTeams: number;
    submissionsReceived: number;
  };
  onStateChange: (newState: string, extra?: Record<string, unknown>) => Promise<void>;
}

export function ControlRoomPanel({
  eventId: _eventId,
  round,
  stats,
  onStateChange,
}: ControlRoomPanelProps) {
  const [loading, setLoading] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState(5);

  const executeStateTransition = async (newState: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    try {
      await onStateChange(newState, extra);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Organizer Status Banner */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-card border border-surface-border">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <span className="font-mono-code text-xs text-white font-bold block">
              ORGANIZER CONTROLS ACTIVE
            </span>
            <span className="text-[11px] text-typography-muted">
              Live round transitions, timer adjustments, and scoring controls ready.
            </span>
          </div>
        </div>
      </div>

      {/* Main Control Console Card */}
      <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div>
            <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest block mb-1">
              Active Control Room
            </span>
            <h2 className="text-2xl font-bold text-white">
              Round {round.round_number}: {round.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono-code text-typography-muted">CURRENT STATE:</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono-code font-bold uppercase bg-surface-dark border border-surface-border text-white">
                {round.state}
              </span>
            </div>
          </div>

          <ServerCountdown deadline={round.deadline} state={round.state} />
        </div>

        {/* Live Submissions Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono-code text-xs">
          <div className="p-4 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-between">
            <span className="text-typography-muted">SUBMISSIONS RECEIVED</span>
            <span className="text-xl font-bold text-accent-hover">
              {stats.submissionsReceived} / {stats.totalTeams}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-between">
            <span className="text-typography-muted">ROUND DURATION</span>
            <span className="text-base font-bold text-white">
              {Math.round(round.duration_seconds / 60)} Minutes
            </span>
          </div>
        </div>

        {/* Live Action Buttons (Password Gated) */}
        <div className="space-y-4 pt-4 border-t border-surface-border">
          <span className="font-mono-code text-xs text-typography-muted uppercase tracking-wider block">
            State Transitions
          </span>

          <div className="flex flex-wrap items-center gap-3">
            {round.state === 'locked' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => executeStateTransition('open')}
                className="px-5 py-2.5 rounded bg-accent-blue hover:bg-accent-hover text-white font-mono-code text-xs font-bold shadow-sm shadow-accent-glow transition-all"
              >
                ▶ Open Round & Start Timer
              </button>
            )}

            {round.state === 'open' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeStateTransition('paused')}
                  className="px-4 py-2.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono-code text-xs font-bold transition-all"
                >
                  ⏸ Pause Round
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeStateTransition('closed')}
                  className="px-4 py-2.5 rounded bg-surface-dark hover:bg-surface-border border border-surface-border text-red-400 font-mono-code text-xs font-bold transition-all"
                >
                  ⏹ Close Submissions
                </button>
              </>
            )}

            {round.state === 'paused' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => executeStateTransition('open')}
                className="px-5 py-2.5 rounded bg-green-600 hover:bg-green-500 text-white font-mono-code text-xs font-bold transition-all"
              >
                ▶ Resume Round
              </button>
            )}

            {round.state === 'closed' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => executeStateTransition('scored')}
                className="px-5 py-2.5 rounded bg-accent-blue hover:bg-accent-hover text-white font-mono-code text-xs font-bold shadow-sm shadow-accent-glow transition-all"
              >
                ✓ Finalize Scores & Announce Qualifiers
              </button>
            )}
          </div>
        </div>

        {/* Timer Extension Tool */}
        {round.state === 'open' && (
          <div className="flex items-center gap-3 pt-4 border-t border-surface-border/50 font-mono-code text-xs">
            <span className="text-typography-muted">EXTEND DEADLINE:</span>
            <select
              value={extensionMinutes}
              onChange={(e) => setExtensionMinutes(Number(e.target.value))}
              className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-white text-xs"
            >
              <option value={2}>+2 Minutes</option>
              <option value={5}>+5 Minutes</option>
              <option value={10}>+10 Minutes</option>
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                executeStateTransition('extend_timer', { addMinutes: extensionMinutes })
              }
              className="px-3 py-1.5 rounded bg-surface-dark hover:bg-surface-border border border-surface-border text-white transition-colors"
            >
              Apply Extension (Audited)
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
