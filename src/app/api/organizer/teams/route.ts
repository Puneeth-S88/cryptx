import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTeams,
  registerNewTeam,
  generateAutoPassword,
  generateTeamJoinCode,
  toggleTeamElimination,
  updateTeam,
  deleteTeam,
  findTeamByIdentifier,
} from '@/lib/teams';
import { createAuditLog } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseAndVerifyToken } from '@/lib/session';
import { registerTeamAccount } from '@/lib/registration';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl) {
    try {
      const { data: dbTeams, error } = await supabaseAdmin
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && dbTeams && dbTeams.length > 0) {
        const formattedTeams = dbTeams.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.captain_email || `${t.join_code.toLowerCase()}@cryptex.internal`,
          code: t.join_code,
          captain: t.captain_name || 'Team Captain',
          password: t.password_hash || '',
          total_score: 0,
          latest_round_score: 0,
          per_round_scores: {},
          is_eliminated: t.is_eliminated || false,
          eliminated_after_round: t.eliminated_after_round || null,
          createdAt: t.created_at,
          members: [
            {
              id: `m_${t.id}_1`,
              name: t.captain_name || 'Captain',
              email: t.captain_email || '',
              role: 'Captain',
              joinedAt: t.created_at,
            },
          ],
        }));
        return NextResponse.json({
          success: true,
          teams: formattedTeams,
        });
      }
    } catch (err) {
      console.error('Supabase get teams error:', err);
    }
  }

  const teams = getAllTeams();
  return NextResponse.json({
    success: true,
    teams,
  });
}

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
        { success: false, error: result.error || 'Failed to create team.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      team: result.team,
      credentials: result.credentials,
    });
  } catch (err: any) {
    console.error('Failed to create team:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create team.' },
      { status: 500 }
    );
  }
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
    const { teamId, currentRoundNumber = 1, action, name, captain, email, code, password, is_eliminated } = body;

    // Bulk qualifier confirmation across all teams
    if (action === 'qualify' || Array.isArray(body.qualifierTeamIds)) {
      const qualifierIds: string[] = Array.isArray(body.qualifierTeamIds) ? body.qualifierTeamIds : [];
      const all = getAllTeams();
      for (const t of all) {
        const isQualified = qualifierIds.includes(t.id) || qualifierIds.includes(t.code);
        updateTeam(t.id, {
          is_eliminated: !isQualified,
          eliminated_after_round: !isQualified ? currentRoundNumber : null,
        });
      }

      const isMockUrl =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

      if (!isMockUrl) {
        try {
          for (const t of all) {
            const isQualified = qualifierIds.includes(t.id) || qualifierIds.includes(t.code);
            await supabaseAdmin
              .from('teams')
              .update({
                is_eliminated: !isQualified,
                eliminated_after_round: !isQualified ? currentRoundNumber : null,
              })
              .eq('join_code', t.code);
          }
        } catch (dbErr) {
          console.error('Supabase qualifiers update error:', dbErr);
        }
      }

      await createAuditLog({
        action: 'ORGANIZER_QUALIFIERS_ENFORCED',
        entityType: 'event',
        entityId: '20261111-0000-0000-0000-000000002026',
        details: {
          round: currentRoundNumber,
          qualifier_count: qualifierIds.length,
          qualifier_ids: qualifierIds,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Qualifiers updated and enforced successfully.',
        teams: getAllTeams(),
      });
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId is required.' },
        { status: 400 }
      );
    }

    let updated;
    if (action === 'modify' || name !== undefined || captain !== undefined || email !== undefined || code !== undefined || password !== undefined || is_eliminated !== undefined) {
      updated = updateTeam(teamId, {
        name,
        captain,
        email,
        code,
        password,
        is_eliminated,
        eliminated_after_round: body.eliminated_after_round !== undefined ? body.eliminated_after_round : (is_eliminated ? currentRoundNumber : null),
      });

      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Team not found.' },
          { status: 404 }
        );
      }

      await createAuditLog({
        action: 'ORGANIZER_MODIFIED_TEAM',
        entityType: 'team',
        entityId: updated.id,
        details: {
          team_name: updated.name,
          code: updated.code,
          captain: updated.captain,
          email: updated.email,
        },
      });
    } else {
      updated = toggleTeamElimination(teamId, currentRoundNumber);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Team not found.' },
          { status: 404 }
        );
      }

      await createAuditLog({
        action: updated.is_eliminated ? 'ORGANIZER_ELIMINATED_TEAM' : 'ORGANIZER_REINSTATED_TEAM',
        entityType: 'team',
        entityId: updated.id,
        details: {
          team_name: updated.name,
          code: updated.code,
          round: currentRoundNumber,
        },
      });
    }

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        await supabaseAdmin
          .from('teams')
          .update({
            name: updated.name,
            captain_name: updated.captain,
            captain_email: updated.email,
            join_code: updated.code,
            is_eliminated: updated.is_eliminated,
            eliminated_after_round: updated.eliminated_after_round,
          })
          .eq('join_code', updated.code);
      } catch (dbErr) {
        console.error('Supabase team update error:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      team: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
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

    let teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) {
      const body = await request.json().catch(() => ({}));
      teamId = body.teamId;
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId is required to delete a team.' },
        { status: 400 }
      );
    }

    const team = findTeamByIdentifier(teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found.' },
        { status: 404 }
      );
    }

    const deleted = deleteTeam(teamId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete team.' },
        { status: 500 }
      );
    }

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    if (!isMockUrl) {
      try {
        if (team.email) {
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = usersData?.users?.find(
            (u) => u.email?.toLowerCase() === team.email.toLowerCase()
          );
          if (authUser) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
          }
        }
        await supabaseAdmin
          .from('teams')
          .delete()
          .eq('join_code', team.code);
      } catch (dbErr) {
        console.error('Supabase team delete error:', dbErr);
      }
    }

    await createAuditLog({
      action: 'ORGANIZER_DELETED_TEAM',
      entityType: 'team',
      entityId: team.id,
      details: {
        team_name: team.name,
        code: team.code,
        captain: team.captain,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Team '${team.name}' deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
