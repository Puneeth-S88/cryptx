/**
 * Supabase Synchronization & Quota Safeguard Service
 * Provides cached lookups, bidirectional syncing for Questions, Points/Scores, and Teams
 * Ensures zero-quota exhaustion with smart short-term memory caching.
 */

import { supabaseAdmin } from './admin';
import type { QuestionDraft } from '@/components/organizer/QuestionBuilder';

export const EVENT_ID = '20261111-0000-0000-0000-000000002026';
export const EVENT_SLUG = 'cryptex-2026';

// Known seed UUID mappings for static fallbacks
export const STATIC_ROUND_UUIDS: Record<number, string> = {
  1: 'e8309b3d-b112-42df-bc5b-efa9982c8282',
  2: '322c0614-ec2f-4b74-aaf5-873e111ae6a1',
  3: 'b0fbe1d1-3d5c-418a-bb1c-df07015ab79a',
  4: '4c58f47a-2b69-46cf-b737-a8646d414091',
  5: '6382be04-b2e3-40cd-9198-8734ee91cdd9',
  6: '10ec16f6-9afb-44de-903f-92b6c9da6f24',
  7: 'a66ffe9d-aa6f-42e8-b93e-1178692f2125',
  8: '2de9dbf0-31a9-42eb-8ec3-8d0fae2e1b82',
};

export const STATIC_TEAM_UUIDS: Record<string, string> = {
  t1: '20261111-0000-0000-0000-000000000001',
  t2: '20261111-0000-0000-0000-000000000002',
  t3: '20261111-0000-0000-0000-000000000003',
  t4: '20261111-0000-0000-0000-000000000004',
  t5: '20261111-0000-0000-0000-000000000005',
};

// Authoritative standard secret keys for scoring
const DEFAULT_ROUND_ANSWERS: Record<string, Record<number, { correct_option_index: number; accepted_answers: string[] }>> = {
  r1: {
    1: { correct_option_index: 1, accepted_answers: [] },
    2: { correct_option_index: 0, accepted_answers: [] },
    3: { correct_option_index: 2, accepted_answers: [] },
    4: { correct_option_index: 1, accepted_answers: [] },
    5: { correct_option_index: 0, accepted_answers: ['KEY', 'THE KEY'] },
  },
  r2: {
    1: { correct_option_index: 0, accepted_answers: ['CAT', 'C A T'] },
    2: { correct_option_index: 1, accepted_answers: ['THE', 'T H E'] },
    3: { correct_option_index: 0, accepted_answers: ['HI', 'H I'] },
  },
};

// In-memory cache with timestamps to drastically reduce Supabase read volume
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __cryptex_supabase_cache: {
    rounds?: CacheEntry<Array<{ id: string; round_number: number; title: string; state: string }>>;
    teams?: CacheEntry<any[]>;
    questions?: Record<string, CacheEntry<QuestionDraft[]>>;
    leaderboard?: CacheEntry<any>;
  } | undefined;
}

if (!globalThis.__cryptex_supabase_cache) {
  globalThis.__cryptex_supabase_cache = {};
}

function isMockSupabase(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co')
  );
}

/**
 * Resolves any round identification string ('r1', '1', 1, or UUID)
 * to its authoritative round number and Supabase round UUID.
 */
export async function resolveRoundInfo(roundIdOrNumber: string | number): Promise<{
  roundNumber: number;
  roundUuid: string;
  roundKey: string;
}> {
  const clean = String(roundIdOrNumber).trim().toLowerCase();
  let roundNumber = 1;

  if (clean.startsWith('r')) {
    roundNumber = parseInt(clean.slice(1), 10) || 1;
  } else if (/^\d+$/.test(clean)) {
    roundNumber = parseInt(clean, 10) || 1;
  }

  // Check static seed mapping
  if (STATIC_ROUND_UUIDS[roundNumber]) {
    return {
      roundNumber,
      roundUuid: STATIC_ROUND_UUIDS[roundNumber],
      roundKey: `r${roundNumber}`,
    };
  }

  // If already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(clean)) {
    const cached = globalThis.__cryptex_supabase_cache?.rounds?.data;
    const match = cached?.find((r) => r.id.toLowerCase() === clean);
    if (match) {
      return {
        roundNumber: match.round_number,
        roundUuid: match.id,
        roundKey: `r${match.round_number}`,
      };
    }
    return {
      roundNumber: 1,
      roundUuid: clean,
      roundKey: 'r1',
    };
  }

  return {
    roundNumber,
    roundUuid: STATIC_ROUND_UUIDS[roundNumber] || clean,
    roundKey: `r${roundNumber}`,
  };
}

/**
 * Resolves a team identifier ('t1', join code, or UUID) to a valid Supabase Team UUID and profile info.
 */
export async function resolveTeamInfo(teamIdentifier: string): Promise<{
  teamUuid: string;
  captainId: string;
  teamName: string;
} | null> {
  const clean = String(teamIdentifier).trim().toLowerCase();

  // 1. Check alias / static map ('t1' -> UUID)
  if (STATIC_TEAM_UUIDS[clean]) {
    return {
      teamUuid: STATIC_TEAM_UUIDS[clean],
      captainId: '1a227ae6-24e1-4849-8dff-ddda99f968aa',
      teamName: 'CipherAces',
    };
  }

  if (isMockSupabase()) {
    return {
      teamUuid: clean,
      captainId: 'mock-captain-id',
      teamName: 'Mock Team',
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(clean);

  // 2. Query Supabase teams table
  try {
    const query = supabaseAdmin.from('teams').select('id, name, captain_id, join_code');
    const { data: dbTeam } = isUuid
      ? await query.eq('id', clean).maybeSingle()
      : await query.or(`join_code.ilike.${clean},name.ilike.${clean}`).maybeSingle();

    if (dbTeam) {
      return {
        teamUuid: dbTeam.id,
        captainId: dbTeam.captain_id || '50009f39-01ae-485e-8b30-6fb3cf05ca09',
        teamName: dbTeam.name,
      };
    }
  } catch (err) {
    console.error('Error resolving team in Supabase:', err);
  }

  if (isUuid) {
    return {
      teamUuid: clean,
      captainId: '50009f39-01ae-485e-8b30-6fb3cf05ca09',
      teamName: 'Team',
    };
  }

  return null;
}

/**
 * Writes an evaluated score to Supabase `scores` table and records the attempt in `submissions`.
 * Guarantees zero unhandled crashes and protects Supabase schema constraints.
 */
export async function recordSubmissionAndScore(params: {
  teamIdOrCode: string;
  roundIdOrNumber: string | number;
  score: number;
  breakdown?: Record<string, any>;
  submissionPayload?: any;
}): Promise<boolean> {
  if (isMockSupabase()) {
    return true;
  }

  try {
    const roundInfo = await resolveRoundInfo(params.roundIdOrNumber);
    const teamInfo = await resolveTeamInfo(params.teamIdOrCode);

    if (!teamInfo) {
      console.warn(`Could not resolve team "${params.teamIdOrCode}" for Supabase scoring.`);
      return false;
    }

    const now = new Date().toISOString();

    // 1. Update/Upsert authoritative `public.scores` table
    const { error: scoreErr } = await supabaseAdmin.from('scores').upsert(
      {
        event_id: EVENT_ID,
        team_id: teamInfo.teamUuid,
        round_id: roundInfo.roundUuid,
        round_number: roundInfo.roundNumber,
        points: params.score,
        final_points: params.score,
        final_submitted_at: now,
        updated_at: now,
      },
      { onConflict: 'event_id,team_id,round_id' }
    );

    if (scoreErr) {
      console.error('Supabase scores upsert error:', scoreErr);
    }

    // 2. Insert into `public.submissions` audit table
    const { error: subErr } = await supabaseAdmin.from('submissions').insert({
      round_id: roundInfo.roundUuid,
      team_id: teamInfo.teamUuid,
      submitted_by: teamInfo.captainId,
      submission_payload: params.submissionPayload || {},
      score_awarded: params.score,
      scoring_breakdown: params.breakdown || {},
      is_evaluated: true,
      submitted_at: now,
    });

    if (subErr) {
      console.error('Supabase submission insert error:', subErr);
    }

    // Invalidate cached leaderboard and teams to reflect fresh scores
    if (globalThis.__cryptex_supabase_cache) {
      delete globalThis.__cryptex_supabase_cache.leaderboard;
      delete globalThis.__cryptex_supabase_cache.teams;
    }

    return !scoreErr;
  } catch (err) {
    console.error('Error saving submission and score to Supabase:', err);
    return false;
  }
}

/**
 * Fetches questions for a given round from Supabase with smart 10-second caching.
 * Accurately merges question definitions with answer keys for evaluation.
 */
export async function fetchRoundQuestionsFromSupabase(
  roundIdOrNumber: string | number
): Promise<QuestionDraft[] | null> {
  if (isMockSupabase()) return null;

  const roundInfo = await resolveRoundInfo(roundIdOrNumber);
  const cacheKey = roundInfo.roundKey;
  const now = Date.now();

  // Check in-memory cache (10s TTL)
  const cached = globalThis.__cryptex_supabase_cache?.questions?.[cacheKey];
  if (cached && now - cached.timestamp < 10000) {
    return cached.data;
  }

  try {
    // Check `public.puzzles` content first (preserves full organizer options and solution drafts)
    const { data: puzzle } = await supabaseAdmin
      .from('puzzles')
      .select('content')
      .eq('round_id', roundInfo.roundUuid)
      .maybeSingle();

    const puzzleQuestions: any[] = puzzle?.content?.questions || [];

    // Query `public.questions` table
    const { data: dbQuestions, error: qErr } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('round_id', roundInfo.roundUuid)
      .order('order_index', { ascending: true });

    if (!qErr && dbQuestions && dbQuestions.length > 0) {
      const defaultRoundSecrets = DEFAULT_ROUND_ANSWERS[roundInfo.roundKey] || {};

      const formatted: QuestionDraft[] = dbQuestions.map((q: any, idx: number) => {
        const orderIdx = q.order_index ?? idx + 1;
        const matchingPuzzleQ = puzzleQuestions.find(
          (pq) => pq.id === q.id || pq.order_index === orderIdx || pq.id === orderIdx
        );
        const secretFallback = defaultRoundSecrets[orderIdx];

        const correctOptIdx =
          matchingPuzzleQ?.correct_option_index !== undefined
            ? Number(matchingPuzzleQ.correct_option_index)
            : secretFallback?.correct_option_index ?? 0;

        const acceptedAnswers =
          Array.isArray(matchingPuzzleQ?.accepted_answers) && matchingPuzzleQ.accepted_answers.length > 0
            ? matchingPuzzleQ.accepted_answers
            : secretFallback?.accepted_answers || (q.question_type === 'text' ? ['KEY', 'THE KEY'] : []);

        return {
          id: q.id || `q_${roundInfo.roundKey}_${orderIdx}`,
          order_index: orderIdx,
          question_type: q.question_type || 'mcq',
          question_text: q.question_text || '',
          monospace_code: q.monospace_code || undefined,
          image_url: q.image_url || undefined,
          options: Array.isArray(q.options) && q.options.length > 0
            ? q.options
            : matchingPuzzleQ?.options || [],
          points: q.points || 20,
          correct_option_index: correctOptIdx,
          accepted_answers: acceptedAnswers,
          text_settings: q.text_settings || {
            ignore_case: true,
            ignore_punct_space: true,
            accept_multiple_answers: true,
          },
        };
      });

      if (!globalThis.__cryptex_supabase_cache!.questions) {
        globalThis.__cryptex_supabase_cache!.questions = {};
      }
      globalThis.__cryptex_supabase_cache!.questions[cacheKey] = {
        data: formatted,
        timestamp: now,
      };

      return formatted;
    }

    // Fallback: If `questions` table was empty but `puzzles.content.questions` exists
    if (puzzleQuestions.length > 0) {
      const defaultRoundSecrets = DEFAULT_ROUND_ANSWERS[roundInfo.roundKey] || {};

      const formatted: QuestionDraft[] = puzzleQuestions.map((q: any, idx: number) => {
        const orderIdx = q.order_index ?? idx + 1;
        const secretFallback = defaultRoundSecrets[orderIdx];

        return {
          id: q.id ? String(q.id) : `q_${roundInfo.roundKey}_${orderIdx}`,
          order_index: orderIdx,
          question_type: q.type === 'text_input' || q.question_type === 'text' ? 'text' : 'mcq',
          question_text: q.question || q.question_text || '',
          monospace_code: q.monospace_code || undefined,
          image_url: q.image_url || undefined,
          options: Array.isArray(q.options) ? q.options : [],
          points: q.points || 20,
          correct_option_index: q.correct_option_index !== undefined ? Number(q.correct_option_index) : secretFallback?.correct_option_index ?? 0,
          accepted_answers: Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0
            ? q.accepted_answers
            : secretFallback?.accepted_answers || (q.type === 'text_input' ? ['KEY', 'THE KEY'] : []),
          text_settings: q.text_settings || {
            ignore_case: true,
            ignore_punct_space: true,
            accept_multiple_answers: true,
          },
        };
      });

      if (!globalThis.__cryptex_supabase_cache!.questions) {
        globalThis.__cryptex_supabase_cache!.questions = {};
      }
      globalThis.__cryptex_supabase_cache!.questions[cacheKey] = {
        data: formatted,
        timestamp: now,
      };

      return formatted;
    }
  } catch (err) {
    console.error('Error fetching round questions from Supabase:', err);
  }

  return null;
}

/**
 * Saves organizer-edited questions into Supabase (`public.puzzles` and `public.questions`).
 * Automatically updates `event_rounds.max_points`.
 */
export async function saveRoundQuestionsToSupabase(
  roundIdOrNumber: string | number,
  questions: QuestionDraft[]
): Promise<boolean> {
  if (isMockSupabase()) return true;

  try {
    const roundInfo = await resolveRoundInfo(roundIdOrNumber);
    const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

    // 1. Upsert into `public.puzzles` (stores full options + solutions safely)
    const { error: puzzleErr } = await supabaseAdmin.from('puzzles').upsert(
      {
        round_id: roundInfo.roundUuid,
        title: `Round ${roundInfo.roundNumber} Questions`,
        instructions: `Answer the questions for Round ${roundInfo.roundNumber}.`,
        content: { questions },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'round_id' }
    );

    if (puzzleErr) {
      console.error('Error saving questions to puzzles table:', puzzleErr);
    }

    // 2. Sync to `public.questions` table
    await supabaseAdmin.from('questions').delete().eq('round_id', roundInfo.roundUuid);

    const rowsToInsert = questions.map((q, idx) => ({
      round_id: roundInfo.roundUuid,
      order_index: q.order_index ?? idx + 1,
      question_type: q.question_type,
      question_text: q.question_text,
      monospace_code: q.monospace_code || null,
      image_url: q.image_url || null,
      options: q.options || [],
      points: Number(q.points) || 10,
      text_settings: q.text_settings || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('questions').insert(rowsToInsert);
      if (insErr) {
        console.error('Error inserting into questions table:', insErr);
      }
    }

    // 3. Update `event_rounds.max_points`
    if (totalPoints > 0) {
      await supabaseAdmin
        .from('event_rounds')
        .update({ max_points: totalPoints })
        .eq('id', roundInfo.roundUuid);
    }

    // Invalidate questions cache
    if (globalThis.__cryptex_supabase_cache?.questions) {
      delete globalThis.__cryptex_supabase_cache.questions[roundInfo.roundKey];
    }

    return true;
  } catch (err) {
    console.error('Error saving questions to Supabase:', err);
    return false;
  }
}

/**
 * Fetches all teams with their live scores calculated directly from Supabase `scores` table.
 * Caches results for 5 seconds to prevent rate-limit exhaustion.
 */
export async function fetchTeamsWithScoresFromSupabase(): Promise<any[] | null> {
  if (isMockSupabase()) return null;

  const now = Date.now();
  const cached = globalThis.__cryptex_supabase_cache?.teams;
  if (cached && now - cached.timestamp < 5000) {
    return cached.data;
  }

  try {
    // 1. Fetch teams
    const { data: dbTeams, error: tErr } = await supabaseAdmin
      .from('teams')
      .select('*')
      .order('created_at', { ascending: true });

    if (tErr || !dbTeams || dbTeams.length === 0) return null;

    // 2. Fetch all scores for the event
    const { data: dbScores } = await supabaseAdmin
      .from('scores')
      .select('team_id, round_number, points, final_points, final_submitted_at');

    const scoreMap: Record<string, { total: number; latest: number; perRound: Record<string, { points: number }>; lastSub: string | null }> = {};

    if (dbScores && Array.isArray(dbScores)) {
      for (const s of dbScores) {
        if (!scoreMap[s.team_id]) {
          scoreMap[s.team_id] = { total: 0, latest: 0, perRound: {}, lastSub: null };
        }
        const pts = s.final_points ?? s.points ?? 0;
        scoreMap[s.team_id].perRound[String(s.round_number)] = { points: pts };
        scoreMap[s.team_id].total += pts;
        scoreMap[s.team_id].latest = pts;
        if (s.final_submitted_at) {
          scoreMap[s.team_id].lastSub = s.final_submitted_at;
        }
      }
    }

    const formatted = dbTeams.map((t: any) => {
      const s = scoreMap[t.id] || { total: 0, latest: 0, perRound: {}, lastSub: null };
      return {
        id: t.id,
        name: t.name,
        email: t.captain_email || `${t.join_code.toLowerCase()}@cryptex.internal`,
        code: t.join_code,
        captain: t.captain_name || 'Team Captain',
        password: t.password_hash || '',
        total_score: s.total,
        latest_round_score: s.latest,
        per_round_scores: s.perRound,
        is_eliminated: t.is_eliminated || false,
        eliminated_after_round: t.eliminated_after_round || null,
        last_submission_time: s.lastSub,
        createdAt: t.created_at,
        members: [
          {
            id: `m_${t.id}_1`,
            name: t.captain_name || 'Captain',
            email: t.captain_email || '',
            role: 'Captain',
            joinedAt: t.created_at,
          },
        ],
      };
    });

    globalThis.__cryptex_supabase_cache!.teams = {
      data: formatted,
      timestamp: now,
    };

    return formatted;
  } catch (err) {
    console.error('Error fetching teams with scores from Supabase:', err);
    return null;
  }
}

/**
 * Permanently deletes a team and its associated records from Supabase.
 */
export async function deleteTeamFromSupabase(teamIdOrCode: string): Promise<{ success: boolean; teamName?: string; error?: string }> {
  if (isMockSupabase()) return { success: true };

  try {
    const clean = String(teamIdOrCode).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(clean);

    // 1. Locate team in Supabase
    const query = supabaseAdmin.from('teams').select('id, name, captain_email, join_code');
    const { data: dbTeam } = isUuid
      ? await query.eq('id', clean).maybeSingle()
      : await query.or(`join_code.ilike.${clean},name.ilike.${clean}`).maybeSingle();

    if (!dbTeam) {
      return { success: false, error: 'Team not found in database.' };
    }

    // 2. If Auth account exists, delete from auth.users
    if (dbTeam.captain_email) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === dbTeam.captain_email.toLowerCase()
        );
        if (authUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        }
      } catch (authErr) {
        console.warn('Auth user delete notice:', authErr);
      }
    }

    // 3. Delete from public.teams (cascades to scores, submissions, qualifications, members)
    const { error: delErr } = await supabaseAdmin.from('teams').delete().eq('id', dbTeam.id);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    // Invalidate caches
    if (globalThis.__cryptex_supabase_cache) {
      delete globalThis.__cryptex_supabase_cache.teams;
      delete globalThis.__cryptex_supabase_cache.leaderboard;
    }

    return { success: true, teamName: dbTeam.name };
  } catch (err: any) {
    return { success: false, error: err.message || 'Database error while deleting team.' };
  }
}

/**
 * Updates a team record in Supabase (name, code, elimination, etc.)
 */
export async function updateTeamInSupabase(
  teamIdOrCode: string,
  updates: {
    name?: string;
    captain?: string;
    email?: string;
    code?: string;
    password?: string;
    is_eliminated?: boolean;
    eliminated_after_round?: number | null;
  }
): Promise<{ success: boolean; team?: any; error?: string }> {
  if (isMockSupabase()) return { success: true };

  try {
    const clean = String(teamIdOrCode).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(clean);

    const query = supabaseAdmin.from('teams').select('*');
    const { data: dbTeam } = isUuid
      ? await query.eq('id', clean).maybeSingle()
      : await query.or(`join_code.ilike.${clean},name.ilike.${clean}`).maybeSingle();

    if (!dbTeam) {
      return { success: false, error: 'Team not found in database.' };
    }

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.captain !== undefined) payload.captain_name = updates.captain.trim();
    if (updates.email !== undefined) payload.captain_email = updates.email.trim();
    if (updates.code !== undefined) payload.join_code = updates.code.trim().toUpperCase();
    if (updates.is_eliminated !== undefined) payload.is_eliminated = updates.is_eliminated;
    if (updates.eliminated_after_round !== undefined) payload.eliminated_after_round = updates.eliminated_after_round;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('teams')
      .update(payload)
      .eq('id', dbTeam.id)
      .select()
      .single();

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // Invalidate caches
    if (globalThis.__cryptex_supabase_cache) {
      delete globalThis.__cryptex_supabase_cache.teams;
      delete globalThis.__cryptex_supabase_cache.leaderboard;
    }

    return { success: true, team: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Database error while updating team.' };
  }
}

/**
 * Toggles the official frozen state of the leaderboard and snapshots current standings.
 */
export async function toggleLeaderboardFreezeInSupabase(freeze: boolean): Promise<boolean> {
  if (isMockSupabase()) return true;

  try {
    // 1. Update events table
    await supabaseAdmin
      .from('events')
      .update({ is_leaderboard_frozen: freeze, updated_at: new Date().toISOString() })
      .eq('id', EVENT_ID);

    // 2. If freezing, capture current live snapshot
    if (freeze) {
      const { data: rpcData } = await supabaseAdmin.rpc('get_event_leaderboard', {
        p_event_id: EVENT_ID,
      });

      if (rpcData && Array.isArray(rpcData.leaderboard)) {
        await supabaseAdmin.from('leaderboard_frozen_snapshot').insert({
          event_id: EVENT_ID,
          snapshot_data: rpcData.leaderboard,
          frozen_at: new Date().toISOString(),
        });
      }
    }

    // Invalidate cache
    if (globalThis.__cryptex_supabase_cache) {
      delete globalThis.__cryptex_supabase_cache.leaderboard;
    }

    return true;
  } catch (err) {
    console.error('Error toggling leaderboard freeze in Supabase:', err);
    return false;
  }
}
