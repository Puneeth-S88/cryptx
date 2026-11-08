'use client';

import { useEffect, useState } from 'react';

interface ServerCountdownProps {
  deadline: string | null;
  state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
  onExpire?: () => void;
}

export function ServerCountdown({ deadline, state, onExpire }: ServerCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean }>({
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!deadline || state !== 'open') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const target = new Date(deadline).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
        clearInterval(interval);
        onExpire?.();
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft({ minutes, seconds, isExpired: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, state, onExpire]);

  if (state === 'locked') {
    return (
      <div className="flex items-center gap-2 font-mono-code text-xs px-3 py-1.5 rounded bg-surface-card border border-surface-border text-typography-muted">
        <span className="w-2 h-2 rounded-full bg-zinc-600" />
        AWAITING ORGANIZER
      </div>
    );
  }

  if (state === 'paused') {
    return (
      <div className="flex items-center gap-2 font-mono-code text-xs px-3 py-1.5 rounded bg-surface-card border border-amber-800/40 text-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        ROUND PAUSED BY ORGANIZER
      </div>
    );
  }

  if (state === 'closed' || state === 'scored' || timeLeft.isExpired) {
    return (
      <div className="flex items-center gap-2 font-mono-code text-xs px-3 py-1.5 rounded bg-surface-card border border-surface-border text-typography-muted">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        ROUND CLOSED
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 font-mono-code text-sm px-4 py-2 rounded bg-surface-card border border-accent-blue/40 shadow-sm shadow-accent-glow">
      <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
      <span className="text-typography-muted text-xs">TIME REMAINING:</span>
      <span className="font-bold text-white tracking-widest text-base">
        {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
