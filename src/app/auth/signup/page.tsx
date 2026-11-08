'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    teamName: string;
    code: string;
    email: string;
  } | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (password.trim().length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          captain: fullName.trim(),
          email: email.trim(),
          password: password.trim(),
          autoGeneratePassword: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to register team.');
      } else {
        setCreatedCreds(data.credentials);
      }
    } catch {
      setErrorMessage('Network error connecting to registration server.');
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
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-accent-blue/20 text-accent-hover border border-accent-blue/30 font-bold uppercase">
              Championship Registration
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono-code">
              REGISTER NEW TEAM
            </h1>
            <p className="text-xs text-typography-muted">
              Capacity: 15 teams max • 4 members per team • DFL04
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono-code">
              ⚠ {errorMessage}
            </div>
          )}

          {createdCreds ? (
            <div className="space-y-4 font-mono-code">
              <div className="p-4 rounded-xl bg-green-950/40 border border-green-600/50 space-y-2.5">
                <div className="flex items-center gap-2 text-green-300 text-sm font-bold">
                  <span>✓</span> Registration Successful!
                </div>
                <p className="text-xs text-typography-muted">
                  Your team is now registered. Save your credentials:
                </p>
                <div className="p-3 rounded-lg bg-surface-dark border border-surface-border space-y-1 text-xs">
                  <div>Team: <strong className="text-white">{createdCreds.teamName}</strong></div>
                  <div>Join Code: <strong className="text-accent-blue">{createdCreds.code}</strong></div>
                  <div>Login ID: <strong className="text-typography-muted">{createdCreds.email}</strong></div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="w-full neo-btn-primary py-3 text-xs uppercase font-mono-code tracking-wider font-bold"
              >
                Proceed to Sign In →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Captain Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alice Captain"
                  className="w-full neo-input"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Captain Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@institution.edu"
                  className="w-full neo-input"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="CipherAces"
                  className="w-full neo-input"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full neo-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full neo-btn-primary py-3 text-xs uppercase font-mono-code tracking-wider font-bold mt-2"
              >
                {loading ? 'Registering Team...' : 'Register Team Captain →'}
              </button>
            </form>
          )}

          <div className="text-center text-xs text-typography-muted pt-2 font-mono-code">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent-hover hover:underline">
              Sign In Instead →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
