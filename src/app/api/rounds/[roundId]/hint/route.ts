import { NextRequest, NextResponse } from 'next/server';
import { recordHintUsage } from '@/lib/supabase/sync';
import { validateSession } from '@/lib/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { roundId: string } }
) {
  try {
    const sessionToken =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { valid, session } = validateSession(sessionToken);
    if (!valid || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid session.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const hintIndex = Number(body.hintIndex) || 1;
    const roundId = params.roundId;

    const hintTexts: Record<number, string> = {
      1: 'Hint 1: This is a Rail Fence (zigzag) cipher with 2 rails.',
      2: 'Hint 2: Top rail holds M E D E T; Bottom rail holds E A W T A N.',
    };

    await recordHintUsage({
      teamIdOrCode: session.teamId || session.accountId,
      roundIdOrNumber: roundId,
      hintIndex,
      hintText: hintTexts[hintIndex] || `Hint ${hintIndex}`,
      penaltyApplied: 50,
    });

    return NextResponse.json({ success: true, hintIndex });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to record hint' }, { status: 500 });
  }
}
