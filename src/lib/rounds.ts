/**
 * In-Memory Round Management Store with write-through to Supabase
 * Handles live round lifecycle: locked -> open -> paused -> closed -> scored.
 * Coordinates timer synchronization across organizer console, play arena, and big screen projector.
 */

export interface RoundItem {
  id: string;
  round_number: number;
  title: string;
  topic: string;
  round_type: 'standard' | 'polybius' | 'scramble' | 'memory' | 'auction' | 'colour' | 'vigenere';
  state: 'locked' | 'open' | 'paused' | 'closed' | 'scored';
  duration_seconds: number;
  max_points: number;
  deadline: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  is_qualified?: boolean;
}

const initialRounds: RoundItem[] = [
  {
    id: 'r1',
    round_number: 1,
    title: 'The Secret Code',
    topic: 'MCQ & Classical Cryptographic Fundamentals',
    round_type: 'standard',
    state: 'open',
    duration_seconds: 600,
    max_points: 100,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    opened_at: new Date().toISOString(),
    is_qualified: true,
  },
  {
    id: 'r2',
    round_number: 2,
    title: 'Cipher Breakers',
    topic: 'Caesar shift, Atbash, Binary conversions',
    round_type: 'standard',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r3',
    round_number: 3,
    title: 'Code Grid',
    topic: 'Polybius Coordinate Decryption (5x5 click matrix)',
    round_type: 'polybius',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r4',
    round_number: 4,
    title: 'Cipher Scramble',
    topic: 'Cryptographic Anagrams with Clues',
    round_type: 'scramble',
    state: 'locked',
    duration_seconds: 600,
    max_points: 150,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r5',
    round_number: 5,
    title: 'Memory Cipher',
    topic: 'Timed Key Memorization & Anti-Replay Decode',
    round_type: 'memory',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r6',
    round_number: 6,
    title: 'Cipher Auction',
    topic: 'Rail Fence Cipher with Point Bidding & Hint Deductions',
    round_type: 'auction',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r7',
    round_number: 7,
    title: 'Colour Cipher',
    topic: 'Baconian Binary Visual Steganography',
    round_type: 'colour',
    state: 'locked',
    duration_seconds: 600,
    max_points: 200,
    deadline: null,
    is_qualified: true,
  },
  {
    id: 'r8',
    round_number: 8,
    title: 'Master Cryptanalyst',
    topic: 'Vigenere Polyalphabetic Decryption & Jury Review',
    round_type: 'vigenere',
    state: 'locked',
    duration_seconds: 900,
    max_points: 300,
    deadline: null,
    is_qualified: true,
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __cryptex_rounds: RoundItem[] | undefined;
}

export function resetRoundsStore(): void {
  globalThis.__cryptex_rounds = JSON.parse(JSON.stringify(initialRounds));
}

if (!globalThis.__cryptex_rounds) {
  resetRoundsStore();
}

export function getAllRounds(): RoundItem[] {
  if (!globalThis.__cryptex_rounds) {
    resetRoundsStore();
  }
  return globalThis.__cryptex_rounds!;
}

export async function getAllRoundsAsync(): Promise<RoundItem[]> {
  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl) {
    try {
      const { supabaseAdmin } = await import('./supabase/admin');
      const { data: dbRounds, error } = await supabaseAdmin
        .from('event_rounds')
        .select('*')
        .order('round_number', { ascending: true });

      if (!error && dbRounds && dbRounds.length > 0) {
        const mapped: RoundItem[] = dbRounds.map((r: any) => ({
          id: `r${r.round_number}`,
          round_number: r.round_number,
          title: r.title,
          topic: r.topic || '',
          round_type: (r.round_type || (r.puzzle_type === 'mcq' ? 'standard' : r.puzzle_type)) as any,
          state: r.state,
          duration_seconds: r.duration_seconds || 600,
          max_points: r.max_points || 100,
          deadline: r.deadline,
          opened_at: r.opened_at,
          closed_at: r.closed_at,
          is_qualified: true,
        }));
        globalThis.__cryptex_rounds = mapped;
        return mapped;
      }
    } catch (err) {
      console.error('Supabase getAllRoundsAsync error:', err);
    }
  }

  return getAllRounds();
}

export function getRoundById(id: string): RoundItem | undefined {
  const list = getAllRounds();
  return list.find((r) => r.id === id || String(r.round_number) === id);
}

export async function getRoundByIdAsync(id: string): Promise<RoundItem | undefined> {
  const list = await getAllRoundsAsync();
  return list.find((r) => r.id === id || String(r.round_number) === id || (r as any).uuid === id);
}

export function getActiveRound(): RoundItem {
  const list = getAllRounds();
  // Return the currently open round or the paused round, otherwise the first round
  return list.find((r) => r.state === 'open') || list.find((r) => r.state === 'paused') || list[0];
}

export async function updateRoundState(
  roundId: string,
  newState: 'locked' | 'open' | 'paused' | 'closed' | 'scored' | 'extend_timer',
  extra?: { addMinutes?: number; duration_seconds?: number }
): Promise<RoundItem | null> {
  const list = getAllRounds();
  const target = list.find((r) => r.id === roundId || String(r.round_number) === roundId);
  if (!target) return null;

  const now = new Date();

  if (newState === 'extend_timer') {
    const mins = extra?.addMinutes || 5;
    const currentMs = target.deadline ? new Date(target.deadline).getTime() : now.getTime();
    target.deadline = new Date(currentMs + mins * 60 * 1000).toISOString();
  } else if (newState === 'open') {
    // If opening this round, close or lock other open rounds so only 1 active round is open
    list.forEach((r) => {
      if (r.id !== target.id && r.state === 'open') {
        r.state = 'closed';
        r.closed_at = now.toISOString();
      }
    });

    const duration = extra?.duration_seconds || target.duration_seconds || 600;
    target.state = 'open';
    target.duration_seconds = duration;
    target.opened_at = now.toISOString();
    target.deadline = new Date(now.getTime() + duration * 1000).toISOString();
  } else if (newState === 'paused') {
    target.state = 'paused';
  } else if (newState === 'closed') {
    target.state = 'closed';
    target.closed_at = now.toISOString();
  } else if (newState === 'scored') {
    target.state = 'scored';
  } else if (newState === 'locked') {
    target.state = 'locked';
    target.deadline = null;
  }

  // Supabase write-through if active database is configured
  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl && newState === 'scored') {
    import('./supabase/sync').then(({ syncRoundQualifications }) => {
      import('./teams').then(({ getAllTeams }) => {
        const all = getAllTeams();
        const activeQualifiers = all.map((t, idx) => ({
          teamId: t.code || t.id,
          isQualified: !t.is_eliminated,
          rank: idx + 1,
        }));
        syncRoundQualifications(target.round_number, activeQualifiers).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
  }

  if (!isMockUrl) {
    try {
      const { supabaseAdmin } = await import('./supabase/admin');
      await supabaseAdmin
        .from('event_rounds')
        .update({
          state: target.state,
          deadline: target.deadline,
          opened_at: target.opened_at,
          closed_at: target.closed_at,
        })
        .eq('round_number', target.round_number);
    } catch (dbErr) {
      console.error('Supabase event_rounds update error:', dbErr);
    }
  }

  return target;
}
