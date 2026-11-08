'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'participant' | 'organizer'>('participant');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrCode: identifier.trim(),
          password: password.trim(),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Authentication failed. Please verify credentials.');
      } else {
        setSuccessNotice(data.notice || 'Authentication successful! Redirecting to arena...');
        setTimeout(() => {
          if (role === 'organizer') {
            router.push('/organizer');
          } else {
            router.push('/play');
          }
          router.refresh();
        }, 600);
      }
    } catch {
      setErrorMessage('Network error connecting to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md neo-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-surface-inset border border-surface-border shadow-neo-inset flex items-center justify-center mx-auto mb-3">
              <span className="font-mono-code font-bold text-accent-hover text-lg">CX</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono-code">
              COMPETITION SIGN IN
            </h1>
            <p className="text-xs text-typography-muted">
              Official access portal for participants & event coordinators.
            </p>
          </div>

          {/* SINGLE-DEVICE SECURITY NOTICE */}
          <div className="p-3.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-blue-200 text-xs font-mono-code flex items-start gap-2.5">
            <span className="text-accent-hover text-sm shrink-0">ℹ</span>
            <span className="leading-relaxed">
              <strong>Single-Device Enforcement:</strong> Signing in from a new device will automatically disconnect and log out any previous device using this account.
            </span>
          </div>

          {/* Role Toggle Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg neo-inset text-xs font-mono-code">
            <button
              type="button"
              onClick={() => {
                setRole('participant');
                setIdentifier('');
                setPassword('');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-md font-semibold transition-all ${
                role === 'participant'
                  ? 'bg-accent-blue text-white shadow-neo-blue-sm font-bold'
                  : 'text-typography-muted hover:text-white'
              }`}
            >
              Participant / Team
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('organizer');
                setIdentifier('');
                setPassword('');
                setErrorMessage(null);
              }}
              className={`py-2 rounded-md font-semibold transition-all ${
                role === 'organizer'
                  ? 'bg-accent-blue text-white shadow-neo-blue-sm font-bold'
                  : 'text-typography-muted hover:text-white'
              }`}
            >
              Organizer / Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1.5">
                {role === 'organizer' ? 'Organizer Email' : 'Team Email or Join Code'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  role === 'organizer' ? 'e.g. organizer@cryptex.internal' : 'e.g. ACES-9942 or team@institution.edu'
                }
                className="w-full neo-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono-code text-typography-muted uppercase">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-accent-hover font-mono-code hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full neo-input"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-mono-code">
                {errorMessage}
              </div>
            )}

            {successNotice && (
              <div className="p-3 rounded-lg bg-green-950/60 border border-green-800/60 text-green-300 text-xs font-mono-code">
                ✓ {successNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full neo-btn-primary py-3 text-xs font-mono-code font-bold uppercase tracking-wider"
            >
              {loading ? 'Authenticating & Verifying Session...' : `Sign In as ${role === 'organizer' ? 'Organizer' : 'Team'} →`}
            </button>
          </form>

          <div className="text-center text-xs text-typography-muted font-mono-code pt-2 border-t border-surface-border">
            New Team? Contact Venue Officials at DFL04 or{' '}
            <Link href="/events" className="text-accent-hover hover:underline">
              View Event Details
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
