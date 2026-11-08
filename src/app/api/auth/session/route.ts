import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { fetchTeamsWithScoresFromSupabase } from '@/lib/supabase/sync';
import { getAllTeams } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No active session found.' },
        { status: 401 }
      );
    }

    const result = validateSession(token);

    if (result.superseded) {
      const response = NextResponse.json(
        {
          authenticated: false,
          superseded: true,
          error:
            'Another device has logged into this account. For competition integrity, only one active device is permitted. You have been logged out.',
        },
        { status: 401 }
      );
      response.cookies.delete('cryptex_session');
      return response;
    }

    if (!result.valid || !result.session) {
      const response = NextResponse.json(
        { authenticated: false, error: result.error || 'Invalid session.' },
        { status: 401 }
      );
      response.cookies.delete('cryptex_session');
      return response;
    }

    let teamStats = null;
    if (result.session.role === 'participant') {
      try {
        const teamIdentifier = result.session.teamId || result.session.accountId;
        const dbTeams = await fetchTeamsWithScoresFromSupabase();
        const teamsList = dbTeams && dbTeams.length > 0 ? dbTeams : getAllTeams();

        const sorted = [...teamsList].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        const cleanId = String(teamIdentifier || '').toLowerCase();
        const cleanName = String(result.session.accountName || '').toLowerCase();

        const matchIdx = sorted.findIndex(
          (t) =>
            String(t.id).toLowerCase() === cleanId ||
            String(t.code || '').toLowerCase() === cleanId ||
            String(t.name).toLowerCase() === cleanName
        );

        if (matchIdx !== -1) {
          const match = sorted[matchIdx];
          teamStats = {
            rank: matchIdx + 1,
            totalScore: match.total_score || 0,
            latestRoundScore: match.latest_round_score || 0,
            perRoundScores: match.per_round_scores || {},
            isEliminated: Boolean(match.is_eliminated),
            eliminatedAfterRound: match.eliminated_after_round || null,
          };
        }
      } catch (err) {
        console.error('Error attaching teamStats to session:', err);
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: result.session,
      teamStats,
    });
  } catch (err: any) {
    console.error('Session verification error:', err);
    return NextResponse.json(
      { authenticated: false, error: 'Failed to verify session.' },
      { status: 500 }
    );
  }
}
