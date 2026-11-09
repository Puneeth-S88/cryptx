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
  let totalTeams = 0;

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
            submissionCounts[String(roundNum)] = submissionCounts[`r${roundNum}`];
          }
        }
      }

      // Map dynamic event_rounds UUIDs
      const { data: dbRounds } = await supabaseAdmin
        .from('event_rounds')
        .select('id, round_number');
      if (dbRounds) {
        for (const r of dbRounds) {
          const count = submissionCounts[r.id] || 0;
          if (count > 0) {
            submissionCounts[`r${r.round_number}`] = count;
            submissionCounts[String(r.round_number)] = count;
          }
        }
      }

      // Query total active teams
      const { count: teamCount } = await supabaseAdmin
        .from('teams')
        .select('id', { count: 'exact', head: true });
      if (typeof teamCount === 'number') {
        totalTeams = teamCount;
      }
    } catch (err) {
      console.error('Failed to query submissions count:', err);
    }
  }

  // Merge with in-memory counter if present
  if ((globalThis as any).__cryptex_submission_counts) {
    for (const [k, v] of Object.entries((globalThis as any).__cryptex_submission_counts as Record<string, number>)) {
      submissionCounts[k] = Math.max(submissionCounts[k] || 0, v);
    }
  }

  const activeRoundSubmissions = activeRound
    ? (submissionCounts[activeRound.id] ?? submissionCounts[`r${activeRound.round_number}`] ?? submissionCounts[String(activeRound.round_number)] ?? 0)
    : 0;

  return NextResponse.json({
    success: true,
    rounds,
    activeRound,
    submissionCounts,
    stats: {
      totalTeams,
      submissionsReceived: activeRoundSubmissions,
    },
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

    // Handle reorder
    if (body.action === 'reorder' && Array.isArray(body.orderedIds)) {
      const list = getAllRounds();
      const idMap = new Map(list.map((r) => [r.id, r]));
      const reordered: typeof list = [];
      body.orderedIds.forEach((id: string, idx: number) => {
        const item = idMap.get(id);
        if (item) {
          (item as any).order_index = idx + 1;
          reordered.push(item);
        }
      });
      list.forEach((r) => {
        if (!reordered.includes(r)) {
          reordered.push(r);
        }
      });
      globalThis.__cryptex_rounds = reordered;
      return NextResponse.json({ success: true, rounds: reordered });
    }

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
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ success: false, error: 'Round title is required.' }, { status: 400 });
    }

    const { createRoundAsync } = await import('@/lib/rounds');
    const newRound = await createRoundAsync({
      round_number: body.round_number,
      title: body.title,
      topic: body.topic,
      round_type: body.round_type,
      duration_seconds: body.duration_seconds,
      max_points: body.max_points,
      state: body.state || 'locked',
      order_index: body.order_index,
      qualification_note: body.qualification_note,
    });

    await createAuditLog({
      action: 'ORGANIZER_ROUND_CREATED',
      entityType: 'round',
      entityId: newRound.id,
      details: { title: newRound.title, type: newRound.round_type, number: newRound.round_number },
    });

    return NextResponse.json({ success: true, round: newRound });
  } catch (err: any) {
    console.error('Create round error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create round.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const roundId = request.nextUrl.searchParams.get('roundId');
    if (!roundId) {
      return NextResponse.json({ success: false, error: 'roundId is required.' }, { status: 400 });
    }

    const { deleteRoundAsync } = await import('@/lib/rounds');
    const deleted = await deleteRoundAsync(roundId);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Round not found.' }, { status: 404 });
    }

    await createAuditLog({
      action: 'ORGANIZER_ROUND_DELETED',
      entityType: 'round',
      entityId: roundId,
      details: { roundId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete round error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete round.' },
      { status: 500 }
    );
  }
}
