import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAllTeams } from '@/lib/teams';
import { rankTeamsWithTieBreak, type TeamLeaderboardEntry } from '@/lib/crypto/tie-break';
import { parseAndVerifyToken } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { toggleLeaderboardFreezeInSupabase, EVENT_ID } from '@/lib/supabase/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      // 1. Fetch default event ID & freeze status
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('id, is_leaderboard_frozen')
        .eq('slug', 'cryptex-2026')
        .single();

      if (event) {
        // 2. Call authoritative get_event_leaderboard RPC
        const { data: rpcData, error } = await supabaseAdmin.rpc('get_event_leaderboard', {
          p_event_id: event.id,
        });

        if (!error && rpcData && Array.isArray(rpcData.leaderboard) && rpcData.leaderboard.length > 0) {
          return NextResponse.json(rpcData);
        }
      }
    }

    // Dynamic live team standings with deterministic tie-break calculation
    const teams = getAllTeams();
    const entries: TeamLeaderboardEntry[] = teams.map((t, idx) => ({
      rank: idx + 1,
      team_id: t.id,
      team_name: t.name,
      total_score: t.total_score,
      latest_round_score: t.latest_round_score,
      per_round_scores: t.per_round_scores || {},
      is_eliminated: t.is_eliminated,
      eliminated_after_round: t.eliminated_after_round,
      last_submission_time: t.last_submission_time,
    }));

    return NextResponse.json({
      leaderboard: rankTeamsWithTieBreak(entries, 8),
      frozen: false,
    });
  } catch (err) {
    console.error('Failed to get leaderboard:', err);
    const teams = getAllTeams();
    const entries: TeamLeaderboardEntry[] = teams.map((t, idx) => ({
      rank: idx + 1,
      team_id: t.id,
      team_name: t.name,
      total_score: t.total_score,
      latest_round_score: t.latest_round_score,
      per_round_scores: t.per_round_scores || {},
      is_eliminated: t.is_eliminated,
      eliminated_after_round: t.eliminated_after_round,
      last_submission_time: t.last_submission_time,
    }));
    return NextResponse.json({
      leaderboard: rankTeamsWithTieBreak(entries, 8),
      frozen: false,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const payload = parseAndVerifyToken(token);
    if (!payload || payload.role !== 'organizer') {
      return NextResponse.json({ error: 'Forbidden: Organizer privilege required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const freeze = Boolean(body.freeze);

    await toggleLeaderboardFreezeInSupabase(freeze);

    await createAuditLog({
      action: freeze ? 'LEADERBOARD_FROZEN' : 'LEADERBOARD_UNFROZEN',
      entityType: 'event',
      entityId: EVENT_ID,
      details: {
        organizer: payload.name,
        frozen: freeze,
      },
    });

    return NextResponse.json({
      success: true,
      frozen: freeze,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to toggle leaderboard freeze.' },
      { status: 500 }
    );
  }
}
