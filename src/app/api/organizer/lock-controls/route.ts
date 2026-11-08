import { NextRequest, NextResponse } from 'next/server';
import { lockOrganizerControls } from '@/lib/crypto/password-gate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventId = body.eventId || '20261111-0000-0000-0000-000000002026';

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMock) {
      await lockOrganizerControls(eventId, 'organizer-admin-id');
    }

    const response = NextResponse.json({
      success: true,
      message: 'Organizer controls manually locked.',
    });

    response.cookies.delete('cryptex_elevated_session');

    return response;
  } catch (err: any) {
    console.error('Lock controls error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to lock organizer controls.' },
      { status: 500 }
    );
  }
}
