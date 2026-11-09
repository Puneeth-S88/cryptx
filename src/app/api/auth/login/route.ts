import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAuditLog } from '@/lib/audit';
import { findTeamByIdentifier } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Browser Device';

    // Rate limiting: 10 attempts per minute
    const rl = checkRateLimit({
      key: `login_attempt_${ip}`,
      limit: 15,
      windowMs: 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${Math.ceil(rl.resetInMs / 1000)}s.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { emailOrCode, password, role = 'participant' } = body;

    const identifier = String(emailOrCode || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!identifier || !cleanPass) {
      return NextResponse.json(
        { success: false, error: 'Email/Access Code and Password are required.' },
        { status: 400 }
      );
    }

    // --- 1. ORGANIZER LOGIN ---
    if (role === 'organizer') {
      let isOrganizerPass = false;

      // 1. Authenticate against environment variable hash if configured
      if (process.env.ORGANIZER_PASSWORD_HASH) {
        isOrganizerPass = await bcrypt.compare(cleanPass, process.env.ORGANIZER_PASSWORD_HASH).catch(() => false);
      }

      // 2. Authenticate against Supabase Auth if connected
      const isMockUrl =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

      if (!isOrganizerPass && !isMockUrl) {
        try {
          const { supabaseAdmin } = await import('@/lib/supabase/admin');
          const organizerEmail = identifier.includes('@') ? identifier : 'organizer@cryptex.internal';
          const { data: authSignIn, error: authSignInErr } = await supabaseAdmin.auth.signInWithPassword({
            email: organizerEmail,
            password: cleanPass,
          });
          if (!authSignInErr && authSignIn?.user) {
            isOrganizerPass = true;
          }
        } catch {
          // ignore
        }
      }

      if (!isOrganizerPass) {
        return NextResponse.json(
          { success: false, error: 'Invalid Organizer credentials.' },
          { status: 401 }
        );
      }

      const coordinatorSlug = identifier.replace(/[^a-z0-9]/gi, '_').slice(0, 15) || 'admin';
      const organizerId = `org_${coordinatorSlug}_${crypto.randomBytes(4).toString('hex')}`;

      const { token, session } = createSession(
        {
          id: organizerId,
          name: 'Command Room Organizer',
          role: 'organizer',
          email: identifier.includes('@') ? identifier : 'organizer@cryptex.internal',
        },
        { ipAddress: ip, deviceInfo: userAgent }
      );

      await createAuditLog({
        action: 'ORGANIZER_LOGIN_SUCCESS',
        entityType: 'auth',
        entityId: session.accountId,
        details: { ip, device: userAgent },
      });

      const response = NextResponse.json({
        success: true,
        user: session,
        token,
      });

      response.cookies.set('cryptex_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    // --- 2. PARTICIPANT / TEAM LOGIN ---
    let team = findTeamByIdentifier(identifier);

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase/admin');
        const clean = identifier.trim().replace(/,/g, '');
        const { data: dbTeam } = await supabaseAdmin
          .from('teams')
          .select('*')
          .or(`join_code.ilike.${clean},captain_email.ilike.${clean},name.ilike.${clean}`)
          .maybeSingle();

        if (dbTeam) {
          team = {
            id: dbTeam.id,
            name: dbTeam.name,
            email: dbTeam.captain_email || `${dbTeam.join_code.toLowerCase()}@cryptex.internal`,
            code: dbTeam.join_code,
            captain: dbTeam.captain_name || 'Team Captain',
            password: team?.password || dbTeam.password_hash || 'Competitor@2026',
            total_score: team?.total_score || 0,
            latest_round_score: team?.latest_round_score || 0,
            per_round_scores: team?.per_round_scores || {},
            is_eliminated: dbTeam.is_eliminated || false,
            eliminated_after_round: dbTeam.eliminated_after_round || null,
            createdAt: dbTeam.created_at,
            members: team?.members || [],
          };
        }
      } catch (dbLookupErr) {
        console.error('Supabase team lookup error:', dbLookupErr);
      }
    }

    if (team) {
      const isBcrypt = team.password.startsWith('$2a$') || team.password.startsWith('$2b$');
      let isValidPass =
        cleanPass === team.password ||
        (isBcrypt ? await bcrypt.compare(cleanPass, team.password) : false);

      // Fallback check against Supabase Auth if needed
      if (!isValidPass && !isMockUrl && team.email) {
        try {
          const { supabaseAdmin } = await import('@/lib/supabase/admin');
          const { data: authSignIn, error: authSignInErr } = await supabaseAdmin.auth.signInWithPassword({
            email: team.email,
            password: cleanPass,
          });
          if (!authSignInErr && authSignIn?.user) {
            isValidPass = true;
          }
        } catch {
          // ignore
        }
      }

      if (!isValidPass) {
        return NextResponse.json(
          { success: false, error: 'Incorrect team password.' },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Team not found. Please verify your Team Code or Email.' },
        { status: 404 }
      );
    }

    const resolvedTeam = team;

    // Enforce SINGLE-DEVICE LOGIN: creates a new session and supersedes any other device
    const { token, session } = createSession(
      {
        id: resolvedTeam.id,
        teamId: resolvedTeam.id,
        name: resolvedTeam.name,
        role: 'participant',
        email: resolvedTeam.email,
      },
      { ipAddress: ip, deviceInfo: userAgent }
    );

    await createAuditLog({
      action: 'TEAM_LOGIN_SUCCESS_SINGLE_DEVICE',
      entityType: 'auth',
      entityId: resolvedTeam.id,
      details: {
        team: resolvedTeam.name,
        ip,
        device: userAgent,
        note: 'Prior device session superseded.',
      },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        ...session,
        name: session.accountName,
        is_qualified: !Boolean(resolvedTeam.is_eliminated),
        eliminated_after_round: resolvedTeam.eliminated_after_round ?? null,
      },
      token,
      notice: 'Signed in. Any previous device connected to this team has been automatically logged out.',
    });

    response.cookies.set('cryptex_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, error: 'Login service encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
