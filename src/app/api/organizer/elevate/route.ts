import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { parseAndVerifyToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const sessionToken =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const sessionPayload = sessionToken ? parseAndVerifyToken(sessionToken) : null;
    if (!sessionPayload || sessionPayload.role !== 'organizer') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Organizer session required to elevate permissions.' },
        { status: 401 }
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const response = NextResponse.json({
      success: true,
      elevated: true,
      token,
      expiresAt,
    });

    response.cookies.set('cryptex_elevated_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Elevation error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during elevation.' },
      { status: 500 }
    );
  }
}
