'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { ControlRoomPanel } from '@/components/organizer/ControlRoomPanel';
import { QualificationTable } from '@/components/organizer/QualificationTable';
import { RoundBuilderDashboard } from '@/components/organizer/RoundBuilderDashboard';
import { QuestionBuilder, type QuestionDraft } from '@/components/organizer/QuestionBuilder';
import { SpecialRoundEditor, type SpecialRoundContentConfig } from '@/components/organizer/SpecialRoundEditor';
import type { TeamLeaderboardEntry } from '@/lib/crypto/tie-break';
import type { RoundType } from '@/lib/crypto/schemas';

interface TeamDetails {
  id: string;
  name: string;
  email: string;
  code: string;
  captain: string;
  password?: string;
  total_score: number;
  latest_round_score: number;
  per_round_scores: Record<string, { points: number }>;
  is_eliminated: boolean;
  eliminated_after_round?: number | null;
  last_submission_time?: string | null;
}

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'builder' | 'qualify' | 'teams' | 'audit'>('control');

  const [allRounds, setAllRounds] = useState<Array<{
    id: string;
    round_number: number;
    title: string;
    state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
    deadline: string | null;
    duration_seconds: number;
  }>>([]);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number>(1);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});

  // Active round in Control Room
  const [currentRound, setCurrentRound] = useState<{
    id: string;
    round_number: number;
    title: string;
    state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
    deadline: string | null;
    duration_seconds: number;
  }>({
    id: 'r1',
    round_number: 1,
    title: 'The Secret Code',
    state: 'open',
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    duration_seconds: 600,
  });

  // Builder selected sub-view
  const [builderSelectedRoundId, setBuilderSelectedRoundId] = useState<string | null>(null);
  const [builderQuestions, setBuilderQuestions] = useState<QuestionDraft[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Teams in event
  const [teams, setTeams] = useState<TeamDetails[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newCaptainName, setNewCaptainName] = useState('');
  const [newCaptainEmail, setNewCaptainEmail] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('');
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    teamName: string;
    code: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Team modification & deletion state for organizer
  const [editingTeam, setEditingTeam] = useState<TeamDetails | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editCaptainName, setEditCaptainName] = useState('');
  const [editCaptainEmail, setEditCaptainEmail] = useState('');
  const [editTeamCode, setEditTeamCode] = useState('');
  const [editTeamPassword, setEditTeamPassword] = useState('');
  const [savingEditTeam, setSavingEditTeam] = useState(false);
  const [editTeamError, setEditTeamError] = useState<string | null>(null);

  const [isFrozen, setIsFrozen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'urgent'>('urgent');
  const [announcementSent, setAnnouncementSent] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<{ id: string; message: string; priority: string } | null>(null);

  const getRandomInt = (min: number, max: number): number => {
    if (typeof window !== 'undefined' && window.crypto) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return min + (arr[0] % (max - min));
    }
    return Math.floor(min + Math.random() * (max - min));
  };

  const generatePasswordLocal = () => {
    const prefixes = [
      'Cipher',
      'Enigma',
      'Matrix',
      'Quantum',
      'Crypto',
      'Atbash',
      'Vigenere',
      'Polybius',
      'Stego',
      'Nexus',
      'Vortex',
      'Shadow',
    ];
    const suffixes = [
      'Key',
      'Shield',
      'Vault',
      'Blade',
      'Node',
      'Lock',
      'Rotor',
      'Byte',
      'Grid',
      'Vector',
    ];
    const p = prefixes[getRandomInt(0, prefixes.length)];
    const s = suffixes[getRandomInt(0, suffixes.length)];
    const n = getRandomInt(1000, 10000);
    return `${p}-${s}-${n}`;
  };

  const generateCodeLocal = (name: string) => {
    const prefix = name.trim().toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5) || 'TEAM';
    const num = getRandomInt(1000, 10000);
    return `${prefix}-${num}`;
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/organizer/teams');
      if (res.ok) {
        const data = await res.json();
        if (data.teams && Array.isArray(data.teams)) {
          setTeams(data.teams);
        }
      }
    } catch (err) {
      console.error('Failed to load teams', err);
    }
  };

  const fetchRounds = async () => {
    try {
      const res = await fetch('/api/rounds');
      if (res.ok) {
        const data = await res.json();
        if (data.rounds && Array.isArray(data.rounds)) {
          setAllRounds(data.rounds);
          if (data.submissionCounts) {
            setSubmissionCounts(data.submissionCounts);
          }
          const active = data.rounds.find((r: any) => r.round_number === selectedRoundNumber) || data.activeRound || data.rounds[0];
          if (active) {
            setCurrentRound((prev) => ({
              ...prev,
              id: active.id,
              round_number: active.round_number,
              title: active.title,
              state: active.state,
              deadline: active.deadline,
              duration_seconds: active.duration_seconds,
            }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load rounds', err);
    }
  };

  const fetchLeaderboardState = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (data.frozen !== undefined) {
          setIsFrozen(Boolean(data.frozen));
        }
      }
    } catch {
      // ignore
    }
  };

  const handleToggleFreeze = async () => {
    const nextFrozen = !isFrozen;
    setIsFrozen(nextFrozen);
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeze: nextFrozen }),
      });
      const data = await res.json();
      if (data.frozen !== undefined) {
        setIsFrozen(Boolean(data.frozen));
      }
    } catch (err) {
      console.error('Failed to toggle freeze:', err);
      setIsFrozen(!nextFrozen);
    }
  };

  useEffect(() => {
    async function verifyOrganizer() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.authenticated || data.user?.role !== 'organizer') {
          if (data.user?.role === 'participant') {
            router.replace('/play');
          } else {
            router.replace('/auth/login?redirect=/organizer');
          }
          return;
        }
        setIsAuthorized(true);
        fetchTeams();
        fetchRounds();
        fetchLeaderboardState();
        refreshBroadcast();
      } catch {
        router.replace('/auth/login?redirect=/organizer');
      }
    }

    verifyOrganizer();

    const interval = setInterval(() => {
      refreshBroadcast();
      fetchRounds();
      fetchLeaderboardState();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, selectedRoundNumber]);

  // Poll current broadcast
  const refreshBroadcast = async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const d = await res.json();
        setCurrentBroadcast(d.active || null);
      }
    } catch {
      // ignore
    }
  };

  // Direct action execution (elevation password gate removed for seamless organizer control)
  const requireElevation = (action: () => Promise<void>) => {
    action();
  };

  const handleStateChange = async (newState: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/rounds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: currentRound.id,
          state: newState,
          duration_seconds: currentRound.duration_seconds,
          addMinutes: extra?.addMinutes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.round) {
          setCurrentRound(data.round);
        }
        if (data.rounds) {
          setAllRounds(data.rounds);
        }
        refreshBroadcast();
      } else {
        // Fallback local update
        if (newState === 'extend_timer') {
          const addMins = (extra?.addMinutes as number) || 5;
          const currentDead = currentRound.deadline ? new Date(currentRound.deadline).getTime() : Date.now();
          setCurrentRound({
            ...currentRound,
            deadline: new Date(currentDead + addMins * 60 * 1000).toISOString(),
          });
        } else {
          setCurrentRound({
            ...currentRound,
            state: newState as any,
            deadline: newState === 'open' ? new Date(Date.now() + currentRound.duration_seconds * 1000).toISOString() : currentRound.deadline,
          });
        }
      }
    } catch {
      // Fallback local update
      if (newState === 'extend_timer') {
        const addMins = (extra?.addMinutes as number) || 5;
        const currentDead = currentRound.deadline ? new Date(currentRound.deadline).getTime() : Date.now();
        setCurrentRound({
          ...currentRound,
          deadline: new Date(currentDead + addMins * 60 * 1000).toISOString(),
        });
      } else {
        setCurrentRound({
          ...currentRound,
          state: newState as any,
          deadline: newState === 'open' ? new Date(Date.now() + currentRound.duration_seconds * 1000).toISOString() : currentRound.deadline,
        });
      }
    }
  };

  // Synchronize builder questions from server whenever builderSelectedRoundId changes
  useEffect(() => {
    if (!builderSelectedRoundId) return;
    async function loadRoundQuestions() {
      setLoadingQuestions(true);
      try {
        const res = await fetch(`/api/rounds/${builderSelectedRoundId}/questions`);
        if (res.ok) {
          const data = await res.json();
          if (data.questions && Array.isArray(data.questions)) {
            setBuilderQuestions(data.questions);
          }
        }
      } catch (err) {
        console.error('Failed to load questions', err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadRoundQuestions();
  }, [builderSelectedRoundId]);

  const handleSaveQuestions = async (newQuestions: QuestionDraft[]) => {
    if (!builderSelectedRoundId) return;
    const res = await fetch(`/api/rounds/${builderSelectedRoundId}/questions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: newQuestions }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save questions');
    }

    const data = await res.json();
    if (data.questions) {
      setBuilderQuestions(data.questions);
    }
  };

  const getSpecialRoundType = (roundId: string | null): RoundType => {
    switch (roundId) {
      case 'r3': return 'polybius';
      case 'r4': return 'scramble';
      case 'r5': return 'memory';
      case 'r6': return 'auction';
      case 'r7': return 'colour';
      case 'r8': return 'vigenere';
      default: return 'polybius';
    }
  };

  const getSpecialRoundInitialConfig = (roundId: string | null): SpecialRoundContentConfig => {
    switch (roundId) {
      case 'r3':
        return {
          round_type: 'polybius',
          ciphertext_pairs: '32-15-15-44 / 11-44 / 22-11-44-15',
          polybius_plaintext: 'MEET AT GATE',
        };
      case 'r4':
        return {
          round_type: 'scramble',
          scramble_words: [
            { id: 1, word: 'EEGENRIV', clue: 'Polyalphabetic cipher inventor', points: 30 },
            { id: 2, word: 'TEBAHPLA', clue: 'Set of letters', points: 30 },
            { id: 3, word: 'ELZZUP', clue: 'Brain teaser', points: 30 },
            { id: 4, word: 'LEVEL', clue: 'Stage or rank', points: 30 },
            { id: 5, word: 'TXET', clue: 'Written words', points: 30 },
          ],
        };
      case 'r5':
        return {
          round_type: 'memory',
          reveal_seconds: 60,
          memory_words: [
            { cipher_word: 'UQZT', plain_word: 'GATE', points: 40 },
            { cipher_word: 'XFRTK', plain_word: 'UNDER', points: 40 },
            { cipher_word: 'QEETLL', plain_word: 'ACCESS', points: 40 },
            { cipher_word: 'KTLTZ', plain_word: 'RESET', points: 40 },
            { cipher_word: 'RGGK', plain_word: 'DOOR', points: 40 },
          ],
        };
      case 'r6':
        return {
          round_type: 'auction',
          auction_ciphertext: 'PHHW DW GDZQ',
          auction_plaintext: 'MEET AT DAWN',
          auction_base_points: 200,
          auction_penalty_per_hint: 50,
          auction_hints: [
            'Hint 1: Shift by 3 backwards',
            'Hint 2: Caesar was fond of this cipher',
            'Hint 3: First word is MEET',
          ],
        };
      case 'r7':
        return {
          round_type: 'colour',
          colour_a: '#2563EB',
          colour_b: '#9CA3AF',
          colour_plaintext: 'CODE',
        };
      case 'r8':
        return {
          round_type: 'vigenere',
          vigenere_ciphertext: 'LXFOPVEFRNHR',
          vigenere_key: 'LEMON',
          vigenere_plaintext: 'ATTACKATDAWN',
          vigenere_plaintext_points: 150,
          vigenere_explanation_points: 150,
          vigenere_keywords: ['vigenere', 'lemon', 'repeat', 'shift', 'modular', 'polyalphabetic'],
        };
      default:
        return {
          round_type: 'polybius',
          ciphertext_pairs: '32-15-15-44 / 11-44 / 22-11-44-15',
          polybius_plaintext: 'MEET AT GATE',
        };
    }
  };

  const handleSaveSpecialRound = async (config: SpecialRoundContentConfig) => {
    if (!builderSelectedRoundId) return;
    const res = await fetch(`/api/rounds/${builderSelectedRoundId}/questions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundType: getSpecialRoundType(builderSelectedRoundId),
        config,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save special round configuration');
    }
  };

  const handleBroadcastNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: announcementText.trim(),
          priority: announcementPriority,
          author: 'Command Room (DFL04)',
        }),
      });

      if (res.ok) {
        setAnnouncementSent(true);
        setAnnouncementText('');
        refreshBroadcast();
        setTimeout(() => {
          setAnnouncementSent(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Failed to dispatch broadcast notice', err);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      await fetch('/api/announcements', { method: 'DELETE' });
      setCurrentBroadcast(null);
    } catch (err) {
      console.error('Failed to clear announcement', err);
    }
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setCreateTeamError('Team name is required.');
      return;
    }
    setCreatingTeam(true);
    setCreateTeamError(null);

    try {
      const finalPassword =
        autoGeneratePassword || !newTeamPassword.trim()
          ? newTeamPassword.trim() || generatePasswordLocal()
          : newTeamPassword.trim();
      const finalCode = newTeamCode.trim() || generateCodeLocal(newTeamName);

      const res = await fetch('/api/organizer/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          captain: newCaptainName.trim() || 'Team Captain',
          email: newCaptainEmail.trim() || `${finalCode.toLowerCase()}@cryptex.internal`,
          code: finalCode,
          password: finalPassword,
          autoGeneratePassword: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateTeamError(data.error || 'Failed to create team.');
      } else {
        const newTeamRec: TeamDetails = {
          id: data.team.id,
          name: data.team.name,
          email: data.team.email,
          code: data.team.code,
          captain: data.team.captain,
          password: data.team.password,
          total_score: 0,
          latest_round_score: 0,
          per_round_scores: {},
          is_eliminated: false,
          last_submission_time: null,
        };
        setTeams((prev) => [newTeamRec, ...prev]);
        setCreatedCreds(data.credentials);
        setShowAddTeamModal(false);
        setNewTeamName('');
        setNewCaptainName('');
        setNewCaptainEmail('');
        setNewTeamCode('');
        setNewTeamPassword('');
      }
    } catch {
      setCreateTeamError('Network error connecting to team registration API.');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleCopyCredentials = (creds: {
    teamName: string;
    code: string;
    email: string;
    password: string;
  }) => {
    const host = typeof window !== 'undefined' ? window.location.origin : 'https://cryptx-2026.vercel.app';
    const text = `========================================
CRYPTEX 2026 — TEAM CREDENTIALS HANDOVER
========================================
Team Name  : ${creds.teamName}
Join Code  : ${creds.code}
Login Email: ${creds.email}
Password   : ${creds.password}
Portal URL : ${host}/auth/login
----------------------------------------
Security Notice:
- Single-device login is strictly enforced.
- Logging in on a new device auto-disconnects any prior device.
- Keep your credentials confidential.
========================================`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 3000);
    }
  };

  const handleToggleElimination = async (teamId: string) => {
    try {
      const res = await fetch('/api/organizer/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, currentRoundNumber: currentRound.round_number }),
      });
      if (res.ok) {
        const data = await res.json();
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  is_eliminated: data.team.is_eliminated,
                  eliminated_after_round: data.team.eliminated_after_round,
                }
              : t
          )
        );
      }
    } catch {
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, is_eliminated: !t.is_eliminated } : t))
      );
    }
  };

  const handleEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setSavingEditTeam(true);
    setEditTeamError(null);
    try {
      const res = await fetch('/api/organizer/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          teamId: editingTeam.id,
          name: editTeamName.trim(),
          captain: editCaptainName.trim(),
          email: editCaptainEmail.trim(),
          code: editTeamCode.trim(),
          password: editTeamPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditTeamError(data.error || 'Failed to update team.');
      } else {
        setTeams((prev) =>
          prev.map((t) => (t.id === editingTeam.id ? { ...t, ...data.team } : t))
        );
        setEditingTeam(null);
      }
    } catch {
      setEditTeamError('Network error updating team.');
    } finally {
      setSavingEditTeam(false);
    }
  };

  const handleDeleteTeam = async (team: TeamDetails) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete team "${team.name}" (${team.code})? This will remove all their submissions and credentials.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/organizer/teams?teamId=${team.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeams((prev) => prev.filter((t) => t.id !== team.id && t.code !== team.code));
        await fetchTeams();
      } else {
        alert(data.error || 'Failed to delete team.');
      }
    } catch {
      alert('Network error deleting team.');
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans">
        <Navbar />
        <main className="max-w-md mx-auto my-auto px-4 py-28 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-card border border-accent-blue/40 shadow-neo-btn flex items-center justify-center mx-auto">
            <span className="w-4 h-4 rounded-full bg-accent-blue animate-ping" />
          </div>
          <h2 className="text-xl font-bold font-mono-code text-white">Verifying Authorization...</h2>
          <p className="text-xs text-typography-muted font-mono-code">Connecting to authoritative session manager.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col justify-between font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ORGANIZER TOP COMMAND BAR */}
        <div className="neo-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-inset border border-surface-border shadow-neo-inset flex items-center justify-center">
              <span className="font-mono-code font-bold text-accent-hover text-lg">ADM</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white font-mono-code">
                  CRYPTEX 2026 ORGANIZER CONSOLE
                </h1>
                <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-700/40 font-bold uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  FULL COMMAND ACCESS
                </span>
              </div>
              <p className="text-xs font-mono-code text-typography-muted mt-0.5">
                Official Command Room • DFL04 • Venue Coordinators: Prajwal B U & Puneeth S
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleFreeze}
              className={`neo-btn px-4 py-2 text-xs font-mono-code font-semibold transition-all ${
                isFrozen ? 'bg-amber-950/40 text-amber-300 border-amber-600/40' : 'text-typography-muted hover:text-white'
              }`}
            >
              {isFrozen ? '❄ Leaderboard Frozen' : 'Freeze Leaderboard'}
            </button>
            <Link
              href="/display"
              target="_blank"
              className="neo-btn-primary px-4 py-2 text-xs font-mono-code font-bold uppercase tracking-wider"
            >
              Projector Big Screen ↗
            </Link>
          </div>
        </div>

        {/* ORGANIZER NAVIGATION TABS */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-max p-1.5 rounded-xl neo-inset text-xs font-mono-code">
            {[
              { id: 'control', label: '1. Live Control Room' },
              { id: 'builder', label: '2. Round & Question Builder' },
              { id: 'qualify', label: '3. Qualification Checkpoint' },
              { id: 'teams', label: '4. Team Roster & Walk-ins' },
              { id: 'audit', label: '5. Immutable Audit Logs' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setBuilderSelectedRoundId(null);
                }}
                className={`px-4 py-2.5 rounded-lg font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent-blue text-white shadow-neo-blue-sm font-bold'
                    : 'text-typography-muted hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: LIVE CONTROL ROOM */}
        {activeTab === 'control' && (
          <div className="space-y-6">
            {/* Round Switcher Pill Bar */}
            {allRounds.length > 0 && (
              <div className="neo-card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-mono-code font-bold text-accent-hover uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                    Championship Round Switcher
                  </span>
                  <span className="text-[11px] font-mono-code text-typography-muted">
                    Click a round below to control, kickoff, pause, or extend:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {allRounds.map((r) => {
                    const isSelected = r.round_number === currentRound.round_number;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoundNumber(r.round_number);
                          setCurrentRound({
                            id: r.id,
                            round_number: r.round_number,
                            title: r.title,
                            state: r.state,
                            deadline: r.deadline,
                            duration_seconds: r.duration_seconds,
                          });
                        }}
                        className={`px-3 py-2 rounded-lg font-mono-code text-xs flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-accent-blue text-white shadow-neo-blue-sm font-bold border border-accent-hover scale-[1.02]'
                            : 'bg-surface-dark text-typography-muted hover:text-white border border-surface-border shadow-neo-btn'
                        }`}
                      >
                        <span className="font-bold">R{r.round_number}</span>
                        <span className="hidden md:inline">{r.title}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            r.state === 'open'
                              ? 'bg-green-500/20 text-green-300 border border-green-500/40 animate-pulse'
                              : r.state === 'paused'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              : r.state === 'closed'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {r.state}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ControlRoomPanel
              eventId="20261111-0000-0000-0000-000000002026"
              round={currentRound}
              stats={{
                totalTeams: teams.length,
                submissionsReceived:
                  submissionCounts[currentRound.id] ??
                  submissionCounts[`r${currentRound.round_number}`] ??
                  submissionCounts[String(currentRound.round_number)] ??
                  0,
              }}
              onStateChange={handleStateChange}
            />

            {/* Broadcast Notice to Display Screen & Arenas */}
            <div className="neo-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
                <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block font-bold">
                  Live Dispatch to /display Projector Screen & Arenas
                </span>
                <span className="text-[11px] font-mono-code text-typography-muted">
                  Broadcasts directly to auditorium projector and player devices
                </span>
              </div>

              {currentBroadcast && (
                <div className="p-3.5 rounded-lg bg-surface-dark border border-accent-blue/50 flex items-center justify-between font-mono-code text-xs">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="px-2 py-0.5 rounded bg-accent-blue text-white font-bold text-[10px] uppercase">
                      ACTIVE ON SCREEN
                    </span>
                    <span className="text-white truncate font-medium">
                      &ldquo;{currentBroadcast.message}&rdquo;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold shrink-0 ml-3 underline"
                  >
                    Clear Notice
                  </button>
                </div>
              )}

              <form onSubmit={handleBroadcastNotice} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 MINUTES REMAINING IN ROUND 1! Verify all answers before final submit."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className="neo-input flex-1 text-xs"
                />
                <select
                  value={announcementPriority}
                  onChange={(e) => setAnnouncementPriority(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
                >
                  <option value="urgent">🚨 Urgent (Pulsing)</option>
                  <option value="normal">📌 Normal Notice</option>
                </select>
                <button
                  type="submit"
                  className="neo-btn-primary px-6 py-2.5 text-xs font-mono-code font-bold uppercase tracking-wider"
                >
                  Push Notice →
                </button>
              </form>
              {announcementSent && (
                <span className="text-xs font-mono-code text-green-400 block animate-pulse">
                  ✓ Broadcast successfully pushed live to projector screen and arena headers.
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROUND & QUESTION BUILDER */}
        {activeTab === 'builder' && (
          <div className="space-y-6">
            {!builderSelectedRoundId ? (
              <RoundBuilderDashboard
                eventId="20261111-0000-0000-0000-000000002026"
                rounds={[
                  {
                    id: 'r1',
                    round_number: 1,
                    title: 'The Secret Code',
                    topic: 'MCQ & Classical Concepts',
                    round_type: 'standard',
                    duration_seconds: 600,
                    max_points: 100,
                    state: 'open',
                    order_index: 1,
                  },
                  {
                    id: 'r2',
                    round_number: 2,
                    title: 'Cipher Breakers',
                    topic: 'Caesar, Atbash, Binary',
                    round_type: 'standard',
                    duration_seconds: 600,
                    max_points: 150,
                    state: 'locked',
                    order_index: 2,
                  },
                  {
                    id: 'r3',
                    round_number: 3,
                    title: 'Code Grid',
                    topic: 'Polybius Coordinate Decryption',
                    round_type: 'polybius',
                    duration_seconds: 600,
                    max_points: 150,
                    state: 'locked',
                    order_index: 3,
                  },
                  {
                    id: 'r4',
                    round_number: 4,
                    title: 'Cipher Scramble',
                    topic: 'Cryptographic Anagrams',
                    round_type: 'scramble',
                    duration_seconds: 600,
                    max_points: 150,
                    state: 'locked',
                    order_index: 4,
                  },
                  {
                    id: 'r5',
                    round_number: 5,
                    title: 'Memory Cipher',
                    topic: 'Timed Key Memorization & Decoding',
                    round_type: 'memory',
                    duration_seconds: 600,
                    max_points: 200,
                    state: 'locked',
                    order_index: 5,
                  },
                  {
                    id: 'r6',
                    round_number: 6,
                    title: 'Cipher Auction',
                    topic: 'Rail Fence with Point Bidding',
                    round_type: 'auction',
                    duration_seconds: 600,
                    max_points: 200,
                    state: 'locked',
                    order_index: 6,
                  },
                  {
                    id: 'r7',
                    round_number: 7,
                    title: 'Colour Cipher',
                    topic: 'Baconian Steganography (Blue/Orange)',
                    round_type: 'colour',
                    duration_seconds: 600,
                    max_points: 200,
                    state: 'locked',
                    order_index: 7,
                  },
                  {
                    id: 'r8',
                    round_number: 8,
                    title: 'Master Cryptanalyst',
                    topic: 'Vigenere Polyalphabetic & Proof',
                    round_type: 'vigenere',
                    duration_seconds: 900,
                    max_points: 300,
                    state: 'locked',
                    order_index: 8,
                  },
                ]}
                onSelectRound={(id) => setBuilderSelectedRoundId(id)}
                onCreateRound={async () => {}}
                onDeleteRound={async () => {}}
                onDuplicateRound={async () => {}}
                onReorderRounds={async () => {}}
                requireElevation={requireElevation}
              />
            ) : (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => setBuilderSelectedRoundId(null)}
                  className="neo-btn px-4 py-2 text-xs font-mono-code text-typography-muted hover:text-white"
                >
                  ← Back to All Rounds
                </button>

                {builderSelectedRoundId === 'r1' || builderSelectedRoundId === 'r2' ? (
                  loadingQuestions ? (
                    <div className="neo-card p-12 text-center space-y-3 font-mono-code">
                      <span className="w-4 h-4 rounded-full bg-accent-blue inline-block animate-ping" />
                      <p className="text-xs text-typography-muted">Loading round questions from server...</p>
                    </div>
                  ) : (
                    <QuestionBuilder
                      key={builderSelectedRoundId}
                      roundId={builderSelectedRoundId}
                      initialQuestions={builderQuestions}
                      onSave={handleSaveQuestions}
                      isLockedOrScored={false}
                      requireElevation={requireElevation}
                    />
                  )
                ) : (
                  <SpecialRoundEditor
                    key={builderSelectedRoundId || 'special'}
                    roundType={getSpecialRoundType(builderSelectedRoundId)}
                    initialConfig={getSpecialRoundInitialConfig(builderSelectedRoundId)}
                    onSave={handleSaveSpecialRound}
                    isLockedOrScored={false}
                    requireElevation={requireElevation}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUALIFICATION CHECKPOINT */}
        {activeTab === 'qualify' && (
          <div className="space-y-6">
            <QualificationTable
              teams={teams.map((t, idx) => ({
                rank: idx + 1,
                team_id: t.id,
                team_name: t.name,
                total_score: t.total_score,
                latest_round_score: t.latest_round_score,
                per_round_scores: t.per_round_scores || {},
                is_eliminated: t.is_eliminated,
                eliminated_after_round: t.eliminated_after_round,
                last_submission_time: t.last_submission_time,
              }))}
              currentRoundNumber={currentRound.round_number}
              onConfirmQualifiers={async (selectedIds) => {
                try {
                  const res = await fetch('/api/organizer/teams', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'qualify',
                      currentRoundNumber: currentRound.round_number,
                      qualifierTeamIds: selectedIds,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.teams && Array.isArray(data.teams)) {
                      setTeams(data.teams);
                      return;
                    }
                  }
                  await fetchTeams();
                } catch (err) {
                  console.error('Failed to save qualifiers:', err);
                  await fetchTeams();
                }
              }}
            />
          </div>
        )}

        {/* TAB 4: TEAMS & WALK-IN REGISTRATION */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            {/* SUCCESS CREDENTIALS HANDOVER BANNER */}
            {createdCreds && (
              <div className="p-6 rounded-2xl bg-green-950/40 border border-green-600/60 shadow-neo-green space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-green-800/40">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-green-900/60 border border-green-600 flex items-center justify-center text-green-300 text-xl font-bold">
                      ✓
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-green-200 font-mono-code uppercase">
                        Team Registered & Credentials Issued
                      </h4>
                      <p className="text-xs text-green-400 font-mono-code">
                        Hand over these login credentials to the team captain right away.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(createdCreds)}
                      className="neo-btn-primary px-4 py-2 text-xs font-mono-code font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                      {copiedCreds ? '✓ Copied to Clipboard!' : '📋 Copy Credentials'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatedCreds(null)}
                      className="neo-btn px-3 py-2 text-xs text-typography-muted hover:text-white font-mono-code"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono-code text-xs">
                  <div className="p-3 rounded-lg bg-surface-dark border border-surface-border">
                    <span className="text-[10px] text-typography-muted uppercase block mb-1">Team Name</span>
                    <span className="font-bold text-white text-sm">{createdCreds.teamName}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-dark border border-surface-border">
                    <span className="text-[10px] text-typography-muted uppercase block mb-1">Join Code</span>
                    <span className="font-bold text-accent-blue text-sm">{createdCreds.code}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-dark border border-surface-border">
                    <span className="text-[10px] text-typography-muted uppercase block mb-1">Login ID / Email</span>
                    <span className="font-bold text-white text-xs truncate block">{createdCreds.email}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-dark border border-green-500/50">
                    <span className="text-[10px] text-green-400 uppercase block mb-1">Auto-Generated Password</span>
                    <span className="font-bold text-accent-hover text-sm tracking-wider">{createdCreds.password}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TEAM ROSTER CARD */}
            <div className="neo-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-4">
                <div>
                  <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
                    Team Approval & Walk-In Intake
                  </span>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white font-mono-code">Registered Teams Roster</h3>
                    <span className="text-xs font-mono-code px-2 py-0.5 rounded bg-surface-inset border border-surface-border text-typography-muted">
                      {teams.length} Teams
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTeamError(null);
                      setNewTeamPassword(generatePasswordLocal());
                      setNewTeamCode('');
                      setShowAddTeamModal(true);
                    }}
                    className="neo-btn-primary px-4 py-2.5 text-xs font-mono-code font-bold uppercase tracking-wider flex items-center gap-2 shadow-neo-blue"
                  >
                    <span>➕</span> Add Team & Generate Password
                  </button>
                </div>
              </div>

              {/* SEARCH FILTER */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  placeholder="🔍 Search teams by name, join code, captain..."
                  className="neo-input text-xs font-mono-code w-full max-w-md py-2"
                />
                {teamSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTeamSearchQuery('')}
                    className="text-xs font-mono-code text-typography-muted hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* TEAMS LIST */}
              <div className="space-y-3">
                {teams
                  .filter((t) => {
                    if (!teamSearchQuery.trim()) return true;
                    const q = teamSearchQuery.toLowerCase();
                    return (
                      t.name.toLowerCase().includes(q) ||
                      t.code.toLowerCase().includes(q) ||
                      t.captain.toLowerCase().includes(q) ||
                      t.email.toLowerCase().includes(q)
                    );
                  })
                  .map((team) => (
                    <div
                      key={team.id}
                      className="neo-inset p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono-code text-xs transition-all hover:border-surface-border"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{team.name}</span>
                          <span className="px-2 py-0.5 rounded bg-blue-950/50 text-blue-300 border border-blue-700/40 text-[11px] font-bold">
                            {team.code}
                          </span>
                        </div>

                        <span className="text-[11px] text-typography-muted">
                          Capt: <strong className="text-white">{team.captain}</strong>
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-dark border border-surface-border text-typography-muted">
                          Score: {team.total_score} pts
                        </span>

                        {team.is_eliminated ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-800/40 font-bold">
                            Eliminated (R{team.eliminated_after_round || 1})
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-green-950/40 text-green-300 border border-green-800/40 font-bold">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* PASSWORD RECOVERY FOR ORGANIZER */}
                        {team.password && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-dark border border-surface-border">
                            <span className="text-[10px] text-typography-muted">Pass:</span>
                            <span className="text-accent-hover font-mono font-bold text-[11px]">
                              {visiblePasswords[team.id] ? team.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisiblePasswords((prev) => ({
                                  ...prev,
                                  [team.id]: !prev[team.id],
                                }))
                              }
                              className="text-[10px] text-typography-muted hover:text-white px-1"
                              title="Toggle password visibility"
                            >
                              {visiblePasswords[team.id] ? 'Hide' : 'Show'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyCredentials({
                                  teamName: team.name,
                                  code: team.code,
                                  email: team.email,
                                  password: team.password!,
                                })
                              }
                              className="text-[10px] text-accent-blue hover:underline px-1"
                              title="Copy handover slip"
                            >
                              Copy
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeam(team);
                            setEditTeamName(team.name);
                            setEditCaptainName(team.captain);
                            setEditCaptainEmail(team.email);
                            setEditTeamCode(team.code);
                            setEditTeamPassword(team.password || '');
                            setEditTeamError(null);
                          }}
                          className="neo-btn px-2.5 py-1.5 text-xs font-semibold text-accent-blue hover:text-white"
                          title="Modify team details"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleElimination(team.id)}
                          className={`neo-btn px-3 py-1.5 text-xs font-semibold ${
                            team.is_eliminated
                              ? 'text-green-400 hover:text-green-300 border-green-800/40'
                              : 'text-typography-muted hover:text-red-400'
                          }`}
                        >
                          {team.is_eliminated ? 'Reinstate Team' : 'Eliminate Team'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(team)}
                          className="neo-btn px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/40 border-red-900/40"
                          title="Permanently delete team"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* EDIT TEAM MODAL */}
            {editingTeam && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-lg neo-card p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-inset border border-surface-border flex items-center justify-center text-accent-hover font-bold font-mono-code">
                        ✏️
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white font-mono-code uppercase">
                          Modify Team Details
                        </h4>
                        <p className="text-xs text-typography-muted font-mono-code">
                          Editing {editingTeam.name} ({editingTeam.code})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingTeam(null)}
                      className="text-typography-muted hover:text-white text-lg font-mono-code"
                    >
                      ✕
                    </button>
                  </div>

                  {editTeamError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono-code">
                      {editTeamError}
                    </div>
                  )}

                  <form onSubmit={handleEditTeamSubmit} className="space-y-4 font-mono-code text-xs">
                    <div>
                      <label className="block text-typography-muted uppercase mb-1">
                        Team Name <span className="text-accent-blue">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        className="neo-input w-full py-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">
                          Captain Name
                        </label>
                        <input
                          type="text"
                          required
                          value={editCaptainName}
                          onChange={(e) => setEditCaptainName(e.target.value)}
                          className="neo-input w-full py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">
                          Captain Email
                        </label>
                        <input
                          type="email"
                          required
                          value={editCaptainEmail}
                          onChange={(e) => setEditCaptainEmail(e.target.value)}
                          className="neo-input w-full py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">
                          Join Code
                        </label>
                        <input
                          type="text"
                          required
                          value={editTeamCode}
                          onChange={(e) => setEditTeamCode(e.target.value.toUpperCase())}
                          className="neo-input w-full py-2 tracking-widest text-accent-blue font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          required
                          value={editTeamPassword}
                          onChange={(e) => setEditTeamPassword(e.target.value)}
                          className="neo-input w-full py-2 font-mono text-accent-hover font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                      <button
                        type="button"
                        onClick={() => setEditingTeam(null)}
                        className="neo-btn px-4 py-2 text-xs text-typography-muted hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEditTeam}
                        className="neo-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                      >
                        {savingEditTeam ? 'Saving Changes...' : 'Save Team Changes →'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ADD TEAM MODAL */}
            {showAddTeamModal && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-lg neo-card p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-inset border border-surface-border flex items-center justify-center text-accent-hover font-bold font-mono-code">
                        +
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white font-mono-code">
                          Register New Team & Generate Password
                        </h4>
                        <p className="text-[11px] text-typography-muted font-mono-code">
                          Onboard walk-in or new teams for CryptX 2026.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddTeamModal(false)}
                      className="text-typography-muted hover:text-white font-mono-code text-sm px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>

                  {createTeamError && (
                    <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs font-mono-code">
                      ⚠ {createTeamError}
                    </div>
                  )}

                  <form onSubmit={handleCreateTeamSubmit} className="space-y-4 font-mono-code text-xs">
                    <div>
                      <label className="block text-typography-muted uppercase mb-1">
                        Team Name <span className="text-accent-blue">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newTeamName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTeamName(val);
                          if (!newTeamCode || newTeamCode.endsWith('-0000')) {
                            setNewTeamCode(generateCodeLocal(val));
                          }
                        }}
                        placeholder="e.g. CyberSentinels"
                        className="neo-input w-full py-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">Captain Name</label>
                        <input
                          type="text"
                          value={newCaptainName}
                          onChange={(e) => setNewCaptainName(e.target.value)}
                          placeholder="e.g. Prajwal B U"
                          className="neo-input w-full py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-typography-muted uppercase mb-1">Captain Email</label>
                        <input
                          type="email"
                          value={newCaptainEmail}
                          onChange={(e) => setNewCaptainEmail(e.target.value)}
                          placeholder="e.g. captain@college.edu"
                          className="neo-input w-full py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-typography-muted uppercase">Team Join Code</label>
                        <button
                          type="button"
                          onClick={() => setNewTeamCode(generateCodeLocal(newTeamName || 'TEAM'))}
                          className="text-[11px] text-accent-hover hover:underline"
                        >
                          🎲 Suggest Code
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newTeamCode}
                        onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
                        placeholder="e.g. CYBER-4821"
                        className="neo-input w-full py-2 uppercase font-bold text-accent-blue tracking-wider"
                      />
                    </div>

                    {/* PASSWORD FIELD WITH AUTO-GENERATE BUTTON */}
                    <div className="p-3.5 rounded-xl neo-inset space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-typography-muted uppercase font-bold text-[11px]">
                          Team Access Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewTeamPassword(generatePasswordLocal());
                            setAutoGeneratePassword(false);
                          }}
                          className="text-[11px] px-2.5 py-1 rounded bg-surface-dark border border-surface-border text-accent-hover hover:border-accent-blue font-bold flex items-center gap-1.5 transition-all"
                        >
                          <span>🎲</span> Auto-Generate Secure Password
                        </button>
                      </div>

                      <input
                        type="text"
                        value={newTeamPassword}
                        onChange={(e) => {
                          setNewTeamPassword(e.target.value);
                          setAutoGeneratePassword(false);
                        }}
                        placeholder="Click auto-generate or type custom password"
                        className="neo-input w-full py-2 font-mono text-accent-hover font-bold tracking-wider"
                      />

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="autoGenCheck"
                          checked={autoGeneratePassword}
                          onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                          className="rounded bg-surface-dark border-surface-border text-accent-blue"
                        />
                        <label htmlFor="autoGenCheck" className="text-[11px] text-typography-dim">
                          Auto-generate password automatically upon submission if left blank
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                      <button
                        type="button"
                        onClick={() => setShowAddTeamModal(false)}
                        className="neo-btn px-4 py-2 text-xs text-typography-muted hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingTeam}
                        className="neo-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                      >
                        {creatingTeam ? 'Registering...' : 'Register Team & Issue Credentials →'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: IMMUTABLE AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="neo-card p-6 space-y-4">
            <div>
              <span className="text-xs font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
                Zero-Trust Compliance
              </span>
              <h3 className="text-xl font-bold text-white font-mono-code">Append-Only Audit Stream</h3>
            </div>

            <div className="space-y-2 font-mono-code text-xs max-h-[500px] overflow-y-auto pr-1">
              {[
                { time: '14:28:10', action: 'ORGANIZER_PASSWORD_GATE_SUCCESS', details: 'Session elevated (10 min)' },
                { time: '14:28:45', action: 'ROUND_STATE_TRANSITION', details: 'Round 1 transitioned from LOCKED to OPEN' },
                { time: '14:32:00', action: 'TIMER_EXTENSION_APPLIED', details: 'Round 1 extended by +5 minutes' },
                { time: '14:35:12', action: 'QUALIFIERS_CONFIRMED', details: 'Top 4 teams confirmed for Round 2' },
              ].map((log, idx) => (
                <div key={idx} className="neo-inset p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-typography-dim text-[11px]">{log.time}</span>
                    <span className="text-accent-hover font-bold">{log.action}</span>
                  </div>
                  <span className="text-typography-muted text-[11px]">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
