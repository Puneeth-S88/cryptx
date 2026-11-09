import { NextRequest, NextResponse } from 'next/server';
import { getAllRounds, getAllRoundsAsync, getActiveRound, updateRoundState } from '@/lib/rounds';
import { parseAndVerifyToken } from '@/lib/session';
import { postAnnouncement } from '@/lib/broadcast';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rounds = await getAllRoundsAsync();
  const activeRound =
    rounds.find((r) => r.state === 'open') ||
    rounds.find((r) => r.state === 'paused') ||
    rounds[0];

  const submissionCounts: Record<string, number> = {};

  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl) {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { data: subData, error } = await supabaseAdmin
        .from('submissions')
        .select('round_id');

      if (!error && subData) {
        for (const s of subData) {
          const rid = s.round_id;
          submissionCounts[rid] = (submissionCounts[rid] || 0) + 1;
        }

        const { STATIC_ROUND_UUIDS } = await import('@/lib/supabase/sync');
        for (const [roundNum, uuid] of Object.entries(STATIC_ROUND_UUIDS)) {
          if (submissionCounts[uuid]) {
            submissionCounts[`r${roundNum}`] = (submissionCounts[`r${roundNum}`] || 0) + submissionCounts[uuid];
          }
        }
      }
    } catch (err) {
      console.error('Failed to query submissions count:', err);
    }
  }

  return NextResponse.json({
    success: true,
    rounds,
    activeRound,
    submissionCounts,
  });
}

export async function PATCH(request: NextRequest) {
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
    const { roundId, state, duration_seconds, addMinutes } = body;

    if (!roundId || !state) {
      return NextResponse.json(
        { success: false, error: 'roundId and state are required.' },
        { status: 400 }
      );
    }

    const updated = await updateRoundState(roundId, state, {
      duration_seconds,
      addMinutes,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Round not found.' },
        { status: 404 }
      );
    }

    // Automatically broadcast status notice when a round is opened or closed
    if (state === 'open') {
      postAnnouncement(
        `ROUND ${updated.round_number}: "${updated.title}" IS NOW OPEN! Timer started (${Math.round(updated.duration_seconds / 60)} mins).`,
        'urgent',
        `Organizer (${payload.name})`
      );
    } else if (state === 'closed') {
      postAnnouncement(
        `ROUND ${updated.round_number}: "${updated.title}" HAS CLOSED. Submissions locked.`,
        'normal',
        `Organizer (${payload.name})`
      );
    }

    await createAuditLog({
      action: 'ROUND_STATE_CHANGED',
      entityType: 'round',
      entityId: updated.id,
      details: {
        roundNumber: updated.round_number,
        title: updated.title,
        newState: state,
        organizer: payload.name,
      },
    });

    return NextResponse.json({
      success: true,
      round: updated,
      rounds: getAllRounds(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update round state.' },
      { status: 500 }
    );
  }
}
