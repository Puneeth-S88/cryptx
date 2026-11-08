'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

interface ProctoredSecurityGuardProps {
  children: React.ReactNode;
  teamName?: string;
  onBreach?: (reason: string) => void;
}

export function ProctoredSecurityGuard({
  children,
  teamName = 'Competitor Team',
  onBreach,
}: ProctoredSecurityGuardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const [isBreached, setIsBreached] = useState(false);
  const [breachReason, setBreachReason] = useState<string | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Mutable refs to prevent stale closure access in window event listeners
  const hasEnteredRef = useRef(false);
  const isBreachedRef = useRef(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setWarningToast(message);
    toastTimerRef.current = setTimeout(() => {
      setWarningToast(null);
    }, 3500);
  }, []);

  const triggerBreach = useCallback(
    (reason: string) => {
      if (isBreachedRef.current) return;
      isBreachedRef.current = true;
      setIsBreached(true);
      setBreachReason(reason);

      // Invalidate server session immediately
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon('/api/auth/logout');
        } else {
          fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {
        // network failure fallback
      }

      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (onBreach) {
        onBreach(reason);
      }
    },
    [onBreach]
  );

  // Request fullscreen with browser compatibility fallbacks
  const handleEnterFullscreen = async () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      setIsFullscreen(true);
      setHasEnteredFullscreen(true);
      hasEnteredRef.current = true;
    } catch (err: any) {
      console.error('Fullscreen request error:', err);
      showToast('⚠️ Fullscreen permission denied. Please allow fullscreen in browser settings.');
    }
  };

  useEffect(() => {
    setMounted(true);

    const checkCurrentFullscreen = () => {
      return !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
    };

    // 1. Right Click Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showToast('⚠️ Right click is disabled in the testing arena.');
    };

    // 2. Copy & Cut Prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showToast('⚠️ Copying test content is strictly prohibited.');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showToast('⚠️ Cut operation is disabled.');
    };

    // 3. Paste Prevention (must type answers directly)
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showToast('⚠️ Pasting is disabled. All answers must be typed directly.');
    };

    // 4. Keyboard Shortcuts & DevTools Block
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerBreach('Developer Tools shortcut (F12) detected.');
        return;
      }

      // Ctrl+Shift+I / J / C (DevTools on Windows/Linux)
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerBreach('Developer Tools shortcut detected.');
        return;
      }

      // Cmd+Opt+I / J / C (DevTools on macOS)
      if (e.metaKey && e.altKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerBreach('Developer Tools shortcut detected.');
        return;
      }

      // Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        showToast('⚠️ View Source is disabled.');
        return;
      }

      // Ctrl+S / Cmd+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+P / Cmd+P (Print Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        showToast('⚠️ Printing test content is prohibited.');
        return;
      }

      // Ctrl+C / Cmd+C (Copy)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        showToast('⚠️ Copy shortcut is disabled.');
        return;
      }

      // Ctrl+V / Cmd+V (Paste)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        showToast('⚠️ Paste shortcut is disabled. Answers must be typed directly.');
        return;
      }
    };

    // 5. Fullscreen Change Monitor (Logout if exit fullscreen)
    const handleFullscreenChange = () => {
      const isFull = checkCurrentFullscreen();
      setIsFullscreen(isFull);

      // If user had entered fullscreen and now exited, trigger breach logout!
      if (!isFull && hasEnteredRef.current && !isBreachedRef.current) {
        triggerBreach('Exited fullscreen mode during active competition.');
      }
    };

    // 6. Tab Switch / Window Minimize Monitor
    const handleVisibilityChange = () => {
      if (document.hidden && hasEnteredRef.current && !isBreachedRef.current) {
        triggerBreach('Tab switch or browser minimization detected.');
      }
    };

    // 7. Window Blur Monitor (Lost focus to another app or window)
    const handleWindowBlur = () => {
      if (hasEnteredRef.current && !isBreachedRef.current) {
        triggerBreach('Application lost focus (switched to another window or desktop).');
      }
    };

    // 8. DevTools Dock / Window Dimension Heuristic Check
    const devToolsCheckInterval = setInterval(() => {
      if (hasEnteredRef.current && !isBreachedRef.current) {
        const isFull = checkCurrentFullscreen();
        if (isFull) {
          const widthDelta = window.outerWidth - window.innerWidth;
          const heightDelta = window.outerHeight - window.innerHeight;
          // When DevTools is docked inside a fullscreen browser window, inner dims shrink > 160px
          if (widthDelta > 160 || heightDelta > 160) {
            triggerBreach('Developer Tools console dock detected.');
          }
        }
      }
    }, 1200);

    // Attach listeners strictly to this window while mounted on /play
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('cut', handleCut, true);
    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    // Check if browser was already in fullscreen upon mounting
    if (checkCurrentFullscreen()) {
      setIsFullscreen(true);
      setHasEnteredFullscreen(true);
      hasEnteredRef.current = true;
    }

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('cut', handleCut, true);
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(devToolsCheckInterval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [triggerBreach, showToast]);

  if (!mounted) {
    return <div className="min-h-screen bg-surface-dark" />;
  }

  // SCREEN 1: BREACH TERMINATION LOCKOUT SCREEN
  if (isBreached) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-xl p-4 sm:p-6 select-none font-sans">
        <div className="max-w-lg w-full neo-card p-8 border-red-700/80 bg-surface-card/95 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse" />

          <div className="w-20 h-20 rounded-2xl bg-red-950/80 border-2 border-red-600/70 text-red-400 mx-auto flex items-center justify-center text-4xl shadow-neo-btn animate-bounce">
            🚫
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono-code font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-red-950/80 text-red-300 border border-red-700/60 inline-block">
              Anti-Cheat Security Enforcement
            </span>
            <h2 className="text-2xl font-extrabold text-white font-mono-code tracking-tight">
              SESSION TERMINATED
            </h2>
            <p className="text-xs text-typography-muted font-mono-code leading-relaxed">
              Your test session has been revoked and locked due to a proctored environment violation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-dark/90 border border-red-800/50 text-left space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono-code text-typography-dim">
              <span>Security Event:</span>
              <span className="text-red-400 font-bold uppercase">Proctoring Breach</span>
            </div>
            <div className="text-xs font-mono-code text-red-200 font-medium bg-red-950/40 p-2.5 rounded border border-red-900/50">
              Reason: {breachReason || 'Proctored test rules violation detected.'}
            </div>
            <div className="text-[11px] font-mono-code text-typography-muted">
              Team: <span className="text-white font-semibold">{teamName}</span> • Session Status: <span className="text-red-400">Invalidated</span>
            </div>
          </div>

          <div className="text-left text-xs font-mono-code text-typography-muted space-y-1.5">
            <p>• Competition rules mandate an unbroken, secure fullscreen test session.</p>
            <p>• All background submissions from this session have been locked.</p>
            <p>• To request review or re-authentication, speak to the event coordinators at the Organizer Console.</p>
          </div>

          <div className="pt-2">
            <Link
              href="/auth/login"
              className="neo-btn-primary block w-full py-3.5 text-xs font-mono-code font-bold uppercase tracking-wider text-center text-white bg-red-600 hover:bg-red-500 border-red-400 transition-all shadow-lg shadow-red-950/50"
            >
              Return to Competition Sign In →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 2: MANDATORY FULLSCREEN GATE (Test hidden until entered)
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-surface-dark/98 backdrop-blur-lg p-4 sm:p-6 select-none font-sans">
        <div className="max-w-lg w-full neo-card p-8 border-accent-blue/50 bg-surface-card/95 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-blue via-accent-hover to-accent-blue animate-pulse" />

          <div className="w-20 h-20 rounded-2xl bg-surface-inset border border-accent-blue/40 shadow-neo-inset mx-auto flex items-center justify-center text-accent-hover text-3xl">
            🔒
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-blue animate-ping" />
              <span className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-accent-hover">
                Proctored Test Environment
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white font-mono-code tracking-wide">
              FULLSCREEN REQUIRED
            </h2>
            <p className="text-xs text-typography-muted font-mono-code leading-relaxed">
              To guarantee competition fairness and anti-cheat compliance, CRYPTEX 2026 must be taken in uninterrupted fullscreen mode.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-dark/80 border border-surface-border text-left space-y-2.5 font-mono-code text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
              <span className="text-typography-muted">Active Team:</span>
              <span className="text-white font-bold">{teamName}</span>
            </div>
            <div className="space-y-2 text-[11px] text-typography-dim">
              <div className="flex items-center gap-2 text-white">
                <span className="text-green-400 font-bold">✓</span>
                <span>Mandatory Fullscreen (Questions revealed once entered)</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <span className="text-green-400 font-bold">✓</span>
                <span>Right-Click & Copy-Paste strictly disabled</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <span className="text-green-400 font-bold">✓</span>
                <span>Developer tools & prohibited shortcuts blocked</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-300">
                <span className="text-yellow-400 font-bold">⚠️</span>
                <span>Exiting fullscreen or switching tabs will terminate session</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnterFullscreen}
            className="w-full neo-btn-primary py-4 text-xs font-mono-code font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all shadow-neo-blue"
          >
            <span className="text-base">⛶</span>
            <span>Enter Fullscreen Mode to Begin</span>
          </button>

          <p className="text-[10px] font-mono-code text-typography-dim">
            Clicking the button will expand your browser into secure full-screen mode and reveal the championship rounds.
          </p>
        </div>
      </div>
    );
  }

  // SCREEN 3: ACTIVE PROCTORED TEST ENVIRONMENT
  return (
    <div className="relative w-full select-none">
      {/* Top Proctored Banner Bar */}
      <div className="w-full bg-surface-card/90 border-b border-accent-blue/30 backdrop-blur-md px-4 py-2 flex items-center justify-between font-mono-code text-xs z-40">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="font-bold text-accent-hover tracking-wider text-[11px]">
            PROCTORED TEST ENVIRONMENT ACTIVE
          </span>
          <span className="hidden sm:inline text-typography-dim text-[10px]">
            • Fullscreen Locked • Anti-Cheat Monitored
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-typography-muted">
            Team: <strong className="text-white">{teamName}</strong>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-accent-blue/20 text-accent-hover border border-accent-blue/30 font-bold">
            SECURE
          </span>
        </div>
      </div>

      {/* Floating Warning Toast Notification */}
      {warningToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[110] max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="p-3.5 rounded-xl bg-red-950/95 border-2 border-red-600 text-white font-mono-code text-xs flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚠️</span>
              <span className="font-medium text-red-200">{warningToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setWarningToast(null)}
              className="text-typography-muted hover:text-white px-2 py-0.5 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Children Arena Content */}
      <div className="w-full select-none">{children}</div>
    </div>
  );
}
