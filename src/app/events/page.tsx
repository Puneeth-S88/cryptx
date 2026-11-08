'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  date_start: string;
  date_end: string;
  venue: string;
  registeredTeams: number;
  maxTeams: number;
  status: 'registration_open' | 'live' | 'paused' | 'ended';
  fee: number;
  coordinators: {
    faculty: string[];
    students: string[];
  };
}

interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: 'Captain' | 'Member';
  joinedAt?: string;
}

const officialEvent: EventItem = {
  id: '20261111-0000-0000-0000-000000002026',
  slug: 'cryptex-2026',
  title: 'CRYPTEX 2026',
  tagline: 'The Ultimate Cryptography Championship',
  date_start: '11 November 2026, 2:00 PM IST',
  date_end: '11 November 2026, 4:00 PM IST',
  venue: 'DFL04',
  registeredTeams: 12,
  maxTeams: 15,
  status: 'live',
  fee: 200,
  coordinators: {
    faculty: ['Dr. Vijay Kumar AV', 'Ms. Soumya'],
    students: ['Prajwal B U', 'Puneeth S'],
  },
};

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'team'>('events');
  const [session, setSession] = useState<{
    authenticated: boolean;
    role?: 'participant' | 'organizer';
    accountId?: string;
    teamId?: string;
    accountName?: string;
    email?: string;
  } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Live team info
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [actionLoading, setActionLoading] = useState(false);

  // Check auth session
  useEffect(() => {
    async function loadAuth() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setSession({
              authenticated: true,
              role: data.user.role,
              accountId: data.user.accountId,
              teamId: data.user.teamId,
              accountName: data.user.accountName,
              email: data.user.email,
            });
            // Fetch live members only if logged in as a participant team
            if (data.user.role === 'participant') {
              fetchTeamMembers(data.user.teamId || data.user.accountId);
            }
            return;
          }
        }
        setSession({ authenticated: false });
      } catch {
        setSession({ authenticated: false });
      } finally {
        setLoadingSession(false);
      }
    }
    loadAuth();
  }, []);

  const fetchTeamMembers = async (targetTeamId?: string) => {
    try {
      const url = targetTeamId ? `/api/team/members?teamId=${targetTeamId}` : '/api/team/members';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTeamName(data.teamName || '');
          setJoinCode(data.joinCode || '');
          if (Array.isArray(data.members)) {
            setMembers(data.members);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      setStatusMessage('Please enter both name and email.');
      setStatusType('error');
      return;
    }
    if (members.length >= 4) {
      setStatusMessage('Maximum team size is 4 members.');
      setStatusType('error');
      return;
    }
    if (isLocked) {
      setStatusMessage('Cannot add members: Roster is locked.');
      setStatusType('error');
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/team/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage(data.error || 'Failed to add team member.');
        setStatusType('error');
      } else {
        if (Array.isArray(data.members)) {
          setMembers(data.members);
        }
        setNewMemberEmail('');
        setNewMemberName('');
        setStatusMessage('Teammate added successfully.');
        setStatusType('success');
      }
    } catch {
      setStatusMessage('Network error adding teammate.');
      setStatusType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (isLocked) {
      setStatusMessage('Roster is locked.');
      setStatusType('error');
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/team/members?memberId=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage(data.error || 'Failed to remove member.');
        setStatusType('error');
      } else {
        if (Array.isArray(data.members)) {
          setMembers(data.members);
        }
        setStatusMessage('Member removed from roster.');
        setStatusType('success');
      }
    } catch {
      setStatusMessage('Network error removing teammate.');
      setStatusType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const isTeamLoggedIn = Boolean(session?.authenticated && session?.role === 'participant');
  const isOrganizer = Boolean(session?.authenticated && session?.role === 'organizer');

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-surface-border gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-pulse" />
              <span className="text-xs font-mono-code text-accent-hover uppercase tracking-widest font-bold">
                COMPETITION REGISTRATION & TEAM MANAGEMENT
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white">Event Hub</h1>
          </div>

          <div className="flex items-center gap-2 p-1 rounded-lg neo-inset text-xs font-mono-code">
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`px-4 py-2 rounded-md font-semibold transition-all ${
                activeTab === 'events'
                  ? 'bg-accent-blue text-white shadow-neo-blue-sm'
                  : 'text-typography-muted hover:text-white'
              }`}
            >
              Active Events (1)
            </button>
            {isTeamLoggedIn && (
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`px-4 py-2 rounded-md font-semibold transition-all ${
                  activeTab === 'team'
                    ? 'bg-accent-blue text-white shadow-neo-blue-sm'
                    : 'text-typography-muted hover:text-white'
                }`}
              >
                My Team Roster {teamName ? `(${teamName})` : ''}
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono-code ${
              statusType === 'success'
                ? 'bg-green-950/40 border-green-700/50 text-green-300'
                : 'bg-red-950/40 border-red-700/50 text-red-300'
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* TAB 1: ACTIVE EVENT CARD */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="neo-card p-8 relative overflow-hidden space-y-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-md text-[10px] font-mono-code font-bold uppercase tracking-wider bg-green-950/60 text-green-300 border border-green-700/40">
                      LIVE IN PROGRESS
                    </span>
                    <span className="text-xs font-mono-code text-typography-muted">
                      VENUE: {officialEvent.venue}
                    </span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-white font-mono-code">
                    {officialEvent.title}
                  </h2>
                  <p className="text-sm text-typography-muted">{officialEvent.tagline}</p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <div className="neo-inset px-4 py-2 text-right">
                    <span className="text-[10px] font-mono-code text-typography-dim uppercase block">
                      REGISTERED CAPACITY
                    </span>
                    <span className="font-mono-code text-lg font-bold text-accent-hover">
                      {officialEvent.registeredTeams} / {officialEvent.maxTeams} Teams
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-code text-green-400">
                    3 Slots Remaining Before Waitlist
                  </span>
                </div>
              </div>

              {/* Event Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-surface-border">
                <div className="neo-inset p-3.5">
                  <span className="text-[10px] font-mono-code text-typography-dim block mb-1">DATE & TIME</span>
                  <span className="font-mono-code text-xs text-white block font-semibold">{officialEvent.date_start}</span>
                  <span className="font-mono-code text-[11px] text-typography-muted">{officialEvent.date_end}</span>
                </div>

                <div className="neo-inset p-3.5">
                  <span className="text-[10px] font-mono-code text-typography-dim block mb-1">TEAM SIZE</span>
                  <span className="font-mono-code text-xs text-white block font-semibold">1 to 4 Members</span>
                  <span className="font-mono-code text-[11px] text-typography-muted">Strictly Enforced in DB</span>
                </div>

                <div className="neo-inset p-3.5">
                  <span className="text-[10px] font-mono-code text-typography-dim block mb-1">ENTRY FEE</span>
                  <span className="font-mono-code text-xs text-white block font-semibold">Rs 200 per team</span>
                  <span className="font-mono-code text-[11px] text-typography-muted">Display Only (No payments)</span>
                </div>

                <div className="neo-inset p-3.5">
                  <span className="text-[10px] font-mono-code text-typography-dim block mb-1">COORDINATORS</span>
                  <span className="font-mono-code text-xs text-white block font-semibold">Prajwal & Puneeth</span>
                  <span className="font-mono-code text-[11px] text-typography-muted">Dr. Vijay Kumar AV & Ms. Soumya</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-surface-border">
                <div className="flex items-center gap-3">
                  {isTeamLoggedIn ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('team')}
                      className="neo-btn px-4 py-2.5 text-xs font-mono-code font-semibold"
                    >
                      Manage Team Roster ({teamName || session?.accountName || 'Your Team'})
                    </button>
                  ) : isOrganizer ? (
                    <Link
                      href="/organizer"
                      className="neo-btn px-4 py-2.5 text-xs font-mono-code font-semibold text-accent-hover hover:border-accent-blue"
                    >
                      Open Organizer Console ↗
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/auth/signup"
                        className="neo-btn px-4 py-2.5 text-xs font-mono-code font-semibold hover:border-accent-blue"
                      >
                        Register New Team
                      </Link>
                      <Link
                        href="/auth/login"
                        className="px-4 py-2.5 rounded-lg border border-surface-border text-typography-muted hover:text-white text-xs font-mono-code transition-colors"
                      >
                        Player Sign In
                      </Link>
                    </div>
                  )}
                </div>

                <Link
                  href="/play"
                  className="neo-btn-primary px-8 py-3 text-xs font-mono-code font-bold uppercase tracking-wider"
                >
                  Enter Live Competition Arena →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEAM MANAGEMENT & ROSTER */}
        {activeTab === 'team' && (
          <>
            {!isTeamLoggedIn && !loadingSession ? (
              <div className="neo-card p-12 text-center max-w-xl mx-auto space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-surface-inset border border-surface-border flex items-center justify-center mx-auto text-2xl">
                  🔒
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-mono-code text-white">
                    Team Sign In Required
                  </h3>
                  <p className="text-xs text-typography-muted font-mono-code max-w-md mx-auto">
                    Team rosters are confidential and only accessible to verified competitors. Please sign in with your team credentials to view and manage your members.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link
                    href="/auth/login"
                    className="neo-btn-primary px-6 py-2.5 text-xs font-mono-code font-bold uppercase tracking-wider"
                  >
                    Sign In to Team →
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="neo-btn px-6 py-2.5 text-xs font-mono-code font-semibold"
                  >
                    Register Team
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Team Info Card */}
                <div className="lg:col-span-7 neo-card p-6 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-surface-border">
                    <div>
                      <span className="text-[10px] font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
                        VERIFIED TEAM PROFILE
                      </span>
                      <h2 className="text-2xl font-bold text-white font-mono-code">{teamName || session?.accountName}</h2>
                    </div>

                    <div className="neo-inset px-4 py-2 text-right">
                      <span className="text-[10px] font-mono-code text-typography-dim uppercase block">
                        JOIN CODE
                      </span>
                      <span className="font-mono-code text-base font-bold text-accent-hover tracking-widest">
                        {joinCode}
                      </span>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono-code text-typography-muted uppercase">
                        Roster ({members.length} / 4 Members)
                      </span>
                      <span className="text-[10px] font-mono-code text-accent-blue">
                        {4 - members.length} slot{4 - members.length === 1 ? '' : 's'} available
                      </span>
                    </div>

                    <div className="space-y-2">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg neo-inset flex items-center justify-between text-xs font-mono-code"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                m.role === 'Captain' ? 'bg-accent-blue' : 'bg-green-400'
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white block">{m.name}</span>
                                {m.role === 'Captain' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-700/50 uppercase font-bold">
                                    Captain
                                  </span>
                                )}
                              </div>
                              <span className="text-typography-dim text-[11px]">{m.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-dark border border-surface-border text-typography-muted uppercase">
                              {m.role}
                            </span>
                            {m.role !== 'Captain' && !isLocked && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRemoveMember(m.id)}
                                className="text-red-400 hover:text-red-300 px-2 font-bold"
                                title="Remove member"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Member Form */}
                  {!isLocked && members.length < 4 && (
                    <form onSubmit={handleAddMember} className="pt-4 border-t border-surface-border space-y-3">
                      <span className="text-xs font-mono-code text-typography-muted uppercase block font-bold">
                        Add Teammate to Roster
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Teammate Full Name"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className="neo-input text-xs"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Teammate Email Address"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          className="neo-input text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="neo-btn-primary px-5 py-2.5 text-xs font-mono-code uppercase font-bold tracking-wider"
                      >
                        {actionLoading ? 'Adding...' : '+ Add Teammate to Roster'}
                      </button>
                    </form>
                  )}

                  {members.length >= 4 && (
                    <div className="p-3 rounded-lg bg-surface-dark border border-surface-border text-center text-xs font-mono-code text-typography-muted">
                      ✓ Maximum team capacity reached (4/4 members).
                    </div>
                  )}
                </div>

                {/* Quick Actions & Live Launch */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="neo-card p-6 space-y-4">
                    <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block font-bold">
                      Live Competition Status
                    </span>
                    <div className="neo-inset p-4 space-y-2">
                      <div className="flex items-center justify-between font-mono-code text-xs">
                        <span className="text-typography-muted">ROSTER STATUS:</span>
                        <span className="text-green-400 font-bold">
                          {members.length >= 1 ? 'READY FOR COMPETITION' : 'INCOMPLETE'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono-code text-xs">
                        <span className="text-typography-muted">TEAM MEMBERS:</span>
                        <span className="text-white font-bold">{members.length} of 4</span>
                      </div>
                    </div>

                    <Link
                      href="/play"
                      className="w-full neo-btn-primary py-3.5 text-xs font-mono-code font-bold uppercase tracking-wider text-center block"
                    >
                      Enter Active Play Arena →
                    </Link>
                  </div>

                  <div className="neo-card p-6 space-y-3 text-xs text-typography-muted font-mono-code">
                    <span className="text-white font-bold block">Need Help at Venue?</span>
                    <p>Visit student coordinators Prajwal B U and Puneeth S at the DFL04 stage podium for manual check-in or join-code resets.</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
