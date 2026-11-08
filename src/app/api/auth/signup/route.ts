import { NextRequest, NextResponse } from 'next/server';
import { registerTeamAccount } from '@/lib/registration';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, captain, email, password, code, autoGeneratePassword } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Team name is required.' },
        { status: 400 }
      );
    }

    const result = await registerTeamAccount({
      name: name.trim(),
      captain: captain?.trim(),
      email: email?.trim(),
      password: password?.trim(),
      code: code?.trim(),
      autoGeneratePassword: Boolean(autoGeneratePassword),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to register team.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        team: result.team,
        credentials: result.credentials,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
