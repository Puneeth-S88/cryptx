import { NextRequest, NextResponse } from 'next/server';
import { parseAndVerifyToken } from '@/lib/session';
import { findTeamByIdentifier, addTeamMember, removeTeamMember } from '@/lib/teams';
import { createAuditLog } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getSessionPayload(request: NextRequest) {
  const token =
    request.cookies.get('cryptex_session')?.value ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) return null;
  return parseAndVerifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const payload = getSessionPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    let targetTeamId = payload.role === 'participant' ? (payload.teamId || payload.accountId) : request.nextUrl.searchParams.get('teamId');

    if (!targetTeamId) {
      return NextResponse.json({ error: 'teamId parameter required.' }, { status: 400 });
    }

    const team = findTeamByIdentifier(targetTeamId);
    if (!team) {
      return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      teamId: team.id,
      teamName: team.name,
      joinCode: team.code,
      members: team.members || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getSessionPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, email, teamId } = body;

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Member full name and email are required.' },
        { status: 400 }
      );
    }

    const targetTeamId = payload.role === 'participant' ? (payload.teamId || payload.accountId) : (teamId || payload.teamId || payload.accountId);

    if (!targetTeamId) {
      return NextResponse.json(
        { success: false, error: 'Target team ID required.' },
        { status: 400 }
      );
    }

    const result = addTeamMember(targetTeamId, {
      name: name.trim(),
      email: email.trim(),
      role: 'Member',
    });

    if (!result.success || !result.team) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to add team member.' },
        { status: 400 }
      );
    }

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        let memberUserId: string | null = null;
        const cleanMemberEmail = email.trim().toLowerCase();
        const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
        let existingUser = usersList?.users?.find(
          (u) => u.email?.toLowerCase() === cleanMemberEmail
        );

        if (!existingUser) {
          const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
            email: cleanMemberEmail,
            password: 'Competitor@2026',
            email_confirm: true,
            user_metadata: {
              full_name: name.trim(),
              team_name: result.team.name,
            },
          });
          if (newAuthUser?.user) {
            existingUser = newAuthUser.user;
          }
        }

        if (existingUser) {
          memberUserId = existingUser.id;
          await supabaseAdmin.from('profiles').upsert(
            {
              id: memberUserId,
              email: cleanMemberEmail,
              full_name: name.trim(),
              role: 'participant',
            },
            { onConflict: 'id' }
          );
        }

        if (memberUserId) {
          await supabaseAdmin.from('team_members').upsert(
            {
              team_id: result.team.id,
              user_id: memberUserId,
              role: 'member',
            },
            { onConflict: 'team_id,user_id' }
          );
        }
      } catch (dbErr) {
        console.error('Supabase team_member insert error:', dbErr);
      }
    }

    await createAuditLog({
      action: 'TEAM_MEMBER_ADDED',
      entityType: 'team',
      entityId: result.team.id,
      details: {
        team_name: result.team.name,
        member_name: name.trim(),
        member_email: email.trim(),
        total_members: result.team.members.length,
      },
    });

    return NextResponse.json({
      success: true,
      team: result.team,
      members: result.team.members,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = getSessionPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    let memberId = request.nextUrl.searchParams.get('memberId');
    let teamId = request.nextUrl.searchParams.get('teamId');

    if (!memberId) {
      const body = await request.json().catch(() => ({}));
      memberId = body.memberId;
      teamId = teamId || body.teamId;
    }

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'memberId is required.' },
        { status: 400 }
      );
    }

    const targetTeamId = payload.role === 'participant' ? (payload.teamId || payload.accountId) : (teamId || payload.teamId || payload.accountId);

    if (!targetTeamId) {
      return NextResponse.json(
        { success: false, error: 'Target team ID required.' },
        { status: 400 }
      );
    }

    const result = removeTeamMember(targetTeamId, memberId);
    if (!result.success || !result.team) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to remove member.' },
        { status: 400 }
      );
    }

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('email', memberId)
          .maybeSingle();

        if (prof?.id) {
          await supabaseAdmin
            .from('team_members')
            .delete()
            .eq('team_id', result.team.id)
            .eq('user_id', prof.id);
        }
      } catch (dbErr) {
        console.error('Supabase team_member delete error:', dbErr);
      }
    }

    await createAuditLog({
      action: 'TEAM_MEMBER_REMOVED',
      entityType: 'team',
      entityId: result.team.id,
      details: {
        team_name: result.team.name,
        member_id: memberId,
        remaining_members: result.team.members.length,
      },
    });

    return NextResponse.json({
      success: true,
      team: result.team,
      members: result.team.members,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
