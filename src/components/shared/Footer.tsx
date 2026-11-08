import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-surface-border bg-surface-card py-12 text-sm text-typography-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-surface-dark border border-surface-border flex items-center justify-center">
              <span className="font-mono-code font-bold text-accent-blue text-xs">CX</span>
            </div>
            <span className="font-mono-code font-bold text-white">CRYPTEX 2026</span>
          </div>
          <p className="text-xs text-typography-muted leading-relaxed">
            Live organizer-controlled cryptography championship. DFL04 — 11 November 2026.
          </p>
        </div>

        <div>
          <h4 className="font-mono-code text-xs text-white uppercase tracking-wider mb-3">Live Access</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/leaderboard" className="hover:text-white transition-colors">Public Live Leaderboard</Link></li>
            <li><Link href="/display" className="hover:text-white transition-colors">Big Screen Projector View</Link></li>
            <li><Link href="/auth/signup" className="hover:text-white transition-colors">Team Registration</Link></li>
            <li><Link href="/events" className="hover:text-white transition-colors">Events & Teams</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono-code text-xs text-white uppercase tracking-wider mb-3">Officials</h4>
          <ul className="space-y-1 text-xs">
            <li><span className="text-typography-muted">Faculty:</span> Dr. Vijay Kumar AV & Ms. Soumya</li>
            <li><span className="text-typography-muted">Student Leads:</span> Prajwal B U & Puneeth S</li>
            <li><span className="text-typography-muted">Venue:</span> DFL04 (15 Teams Max)</li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono-code text-xs text-white uppercase tracking-wider mb-3">Organizers</h4>
          <p className="text-xs text-typography-muted mb-3">
            Sensitive actions protected by cryptographic Round Control Password gate.
          </p>
          <Link
            href="/organizer"
            className="inline-block text-xs font-mono-code px-3 py-1.5 rounded border border-surface-border bg-surface-dark hover:border-accent-blue text-white transition-colors"
          >
            Organizer Console →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-surface-border/50 flex flex-col md:flex-row items-center justify-between text-xs text-typography-muted gap-4">
        <p>© 2026 CRYPTEX Championship. Zero-trust architecture & server-enforced qualification.</p>
        <div className="flex items-center gap-4 font-mono-code">
          <span>SERVER TIME: 2026-11-11</span>
          <span className="text-accent-blue">STRICT CONSTRAINTS ACTIVE</span>
        </div>
      </div>
    </footer>
  );
}
