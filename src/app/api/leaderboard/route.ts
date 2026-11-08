import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAllTeams } from '@/lib/teams';
import { rankTeamsWithTieBreak, type TeamLeaderboardEntry } from '@/lib/crypto/tie-break';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      // 1. Fetch default event ID
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
