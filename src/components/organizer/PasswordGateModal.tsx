'use client';

import { useState } from 'react';

interface PasswordGateModalProps {
  isOpen: boolean;
  onSuccess: (token: string, expiresAt: string) => void;
  onClose: () => void;
  eventId: string;
}

export function PasswordGateModal({
  isOpen,
  onSuccess,
  onClose,
  eventId,
}: PasswordGateModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/organizer/elevate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please try again.');
      } else {
        onSuccess(data.token, data.expiresAt);
        setPassword('');
        onClose();
      }
    } catch {
      setError('Network communication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-surface-card border border-surface-border p-6 shadow-2xl space-y-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest">
              Double-Gated Security
            </span>
            <span className="w-2 h-2 rounded-full bg-accent-blue animate-ping" />
          </div>
          <h3 className="text-xl font-bold text-white">Organizer Control Password</h3>
          <p className="text-xs text-typography-muted leading-relaxed">
            Sensitive actions require elevated session authorization. Set by Super Admin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase tracking-wider mb-2">
              Round Control Password
            </label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono-code">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded font-mono-code text-xs text-typography-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded bg-accent-blue hover:bg-accent-hover text-white font-mono-code text-xs font-semibold shadow-sm shadow-accent-glow transition-all"
            >
              {loading ? 'Verifying...' : 'Elevate Controls (10m) →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
