import { NextRequest, NextResponse } from 'next/server';
import { terminateSession, parseAndVerifyToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (token) {
      const payload = parseAndVerifyToken(token);
      if (payload?.accountId) {
        terminateSession(payload.accountId);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully.',
    });

    response.cookies.delete('cryptex_session');
    response.cookies.delete('cryptex_elevated_session');

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
