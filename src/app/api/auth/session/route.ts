import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';

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

    return NextResponse.json({
      authenticated: true,
      user: result.session,
    });
  } catch (err: any) {
    console.error('Session verification error:', err);
    return NextResponse.json(
      { authenticated: false, error: 'Failed to verify session.' },
      { status: 500 }
    );
  }
}
