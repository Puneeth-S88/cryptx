'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface UserSession {
  accountId: string;
  accountName: string;
  role: 'participant' | 'organizer';
  teamId?: string;
  email?: string;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';

  const [session, setSession] = useState<UserSession | null>(null);
  const [activeNotice, setActiveNotice] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check session on load
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setSession(data.user);
          }
        } else {
          setSession(null);
        }
      } catch {
        // network / offline
      }
    }

    // Check active announcement
    async function checkNotice() {
      try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
          const data = await res.json();
          if (data.active?.message) {
            setActiveNotice(data.active.message);
          } else {
            setActiveNotice(null);
          }
        }
      } catch {
        // ignore
      }
    }

    checkAuth();
    checkNotice();

    const interval = setInterval(() => {
      checkNotice();
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null);
      router.push('/auth/login');
      router.refresh();
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Real-time Global Notice Ticker Banner */}
      {activeNotice && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 border-b border-accent-blue/40 px-4 py-2 text-xs font-mono-code text-white flex items-center justify-between shadow-lg">
          <div className="max-w-7xl mx-auto w-full flex items-center gap-3 overflow-hidden">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600 font-bold uppercase tracking-widest text-[10px] shrink-0 animate-pulse">
              🚨 NOTICE
            </span>
            <div className="truncate flex-1 font-semibold text-blue-100">
              {activeNotice}
            </div>
            {!isPlayPage && (
              <Link
                href="/display"
                target="_blank"
                className="text-[10px] underline text-blue-300 hover:text-white shrink-0 ml-2"
              >
                View on Projector ↗
              </Link>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-surface-border bg-surface-dark/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={isPlayPage ? '/play' : '/'} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-surface-card border border-surface-border shadow-neo-btn flex items-center justify-center group-hover:border-accent-blue transition-colors">
              <span className="font-mono-code font-bold text-accent-hover text-sm">CX</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono-code font-bold text-lg tracking-wider text-white">CRYPTEX</span>
                <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded bg-accent-blue/20 text-accent-hover border border-accent-blue/30 font-bold">2026</span>
              </div>
              <span className="text-[9px] text-typography-muted tracking-widest uppercase font-mono-code">
                {isPlayPage ? 'Proctored Championship Arena' : 'Live Cryptography Championship'}
              </span>
            </div>
          </Link>

          {/* Navigation Tabs - Hidden when in Play Arena to prevent cheating / accidental exit */}
          {!isPlayPage ? (
            <nav className="hidden lg:flex items-center gap-2 text-xs font-mono-code">
              <Link
                href="/events"
                className="px-3.5 py-2 rounded-lg bg-surface-card border border-surface-border/70 text-typography-muted hover:text-white hover:border-surface-border shadow-neo-btn transition-all"
              >
                Events & Teams
              </Link>
              <Link
                href="/play"
                className="px-3.5 py-2 rounded-lg bg-surface-card border border-surface-border/70 text-typography-muted hover:text-white hover:border-surface-border shadow-neo-btn transition-all flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                Play Arena
              </Link>
              <Link
                href="/leaderboard"
                className="px-3.5 py-2 rounded-lg bg-surface-card border border-surface-border/70 text-typography-muted hover:text-white hover:border-surface-border shadow-neo-btn transition-all"
              >
                Leaderboard
              </Link>
              <Link
                href="/display"
                target="_blank"
                className="px-3.5 py-2 rounded-lg bg-surface-card border border-surface-border/70 text-typography-muted hover:text-white hover:border-surface-border shadow-neo-btn transition-all"
              >
                Big Screen ↗
              </Link>
              {session?.role === 'organizer' && (
                <Link
                  href="/organizer"
                  className="px-3.5 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/40 text-accent-hover hover:bg-accent-blue/20 shadow-neo-btn transition-all flex items-center gap-1"
                >
                  <span>⚙</span>
                  <span>Organizer Console</span>
                </Link>
              )}
            </nav>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs font-mono-code">
              <span className="px-3 py-1.5 rounded-lg bg-surface-inset border border-accent-blue/40 text-accent-hover flex items-center gap-2 font-bold shadow-neo-inset">
                <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                SECURE PROCTORED SESSION
              </span>
            </div>
          )}

          {/* Action Controls & Session State */}
          <div className="hidden sm:flex items-center gap-3 font-mono-code">
            {session ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-surface-card border border-accent-blue/40 flex items-center gap-2 text-xs text-white">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-bold text-accent-hover">{session.accountName}</span>
                  <span className="text-[10px] text-typography-muted uppercase">({session.role})</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:border-red-500/50 hover:text-red-400 text-typography-muted transition-colors"
                >
                  {isPlayPage ? 'Exit & Sign Out' : 'Sign Out'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signup"
                  className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg border border-surface-border bg-surface-card text-typography-muted hover:text-white hover:border-surface-border transition-all shadow-sm"
                >
                  Register Team
                </Link>
                <Link
                  href="/auth/login"
                  className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg border border-accent-blue/50 bg-surface-card text-accent-hover hover:bg-accent-blue hover:text-white transition-all shadow-sm"
                >
                  Player Sign In
                </Link>
              </div>
            )}

            {!isPlayPage && (
              <Link
                href="/play"
                className="text-xs uppercase tracking-wider neo-btn-primary px-4 py-2 font-medium"
              >
                Enter Arena →
              </Link>
            )}
          </div>

          {/* Mobile hamburger toggle (only when not on /play) */}
          {!isPlayPage ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg bg-surface-card border border-surface-border text-typography-muted hover:text-white font-mono-code text-xs"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="sm:hidden text-xs uppercase px-2.5 py-1.5 rounded bg-surface-card border border-red-800/60 text-red-400 font-mono-code font-bold"
            >
              Sign Out
            </button>
          )}
        </div>

        {/* Mobile dropdown (never shows on /play) */}
        {!isPlayPage && mobileMenuOpen && (
          <div className="sm:hidden border-t border-surface-border bg-surface-dark px-4 py-4 space-y-3 font-mono-code text-xs">
            <Link
              href="/events"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-typography-muted hover:text-white"
            >
              Events & Teams
            </Link>
            <Link
              href="/play"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-accent-hover font-bold"
            >
              ▶ Play Arena
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-typography-muted hover:text-white"
            >
              Official Leaderboard
            </Link>
            <Link
              href="/display"
              target="_blank"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-typography-muted hover:text-white"
            >
              Big Screen Projector ↗
            </Link>
            {session?.role === 'organizer' && (
              <Link
                href="/organizer"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-accent-hover font-bold"
              >
                ⚙ Organizer Console
              </Link>
            )}
            <div className="pt-2 border-t border-surface-border">
              {session ? (
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{session.accountName}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-red-400 font-bold"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-center py-2 rounded border border-surface-border bg-surface-card text-typography-muted hover:text-white font-bold"
                  >
                    Register Team
                  </Link>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-center py-2 rounded bg-accent-blue text-white font-bold"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
