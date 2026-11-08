import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { verifyAndElevateOrganizer } from '@/lib/crypto/password-gate';
import { checkRateLimit } from '@/lib/ratelimit';
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

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 1. Rate Limit: 10 attempts per minute per IP
    const rl = checkRateLimit({
      key: `elevate_limit_${ip}`,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Try again in ${Math.ceil(rl.resetInMs / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { eventId, password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Round Control Password is required.' },
        { status: 400 }
      );
    }

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMock) {
      // Production database verification via private.organizer_control_secrets
      const result = await verifyAndElevateOrganizer(
        eventId || '20261111-0000-0000-0000-000000002026',
        sessionPayload.accountId || 'organizer-admin-id',
        password,
        ip,
        userAgent
      );

      if (result.success && result.token) {
        const response = NextResponse.json(result);
        response.cookies.set('cryptex_elevated_session', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10 * 60,
          path: '/',
        });
        return response;
      }

      const statusCode = result.isLockedOut ? 423 : 401;
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid Round Control Password.' },
        { status: statusCode }
      );
    }

    // Local / Offline / Mock testing verification
    const controlHash = process.env.ORGANIZER_CONTROL_HASH || process.env.ORGANIZER_PASSWORD_HASH;
    if (!controlHash) {
      return NextResponse.json(
        { success: false, error: 'Round control password configuration missing.' },
        { status: 500 }
      );
    }

    const matchesControl = await bcrypt.compare(password, controlHash).catch(() => false);
    if (!matchesControl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Round Control Password. Please enter the official key.',
        },
        { status: 401 }
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const response = NextResponse.json({
      success: true,
      token,
      expiresAt,
    });

    response.cookies.set('cryptex_elevated_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60,
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
