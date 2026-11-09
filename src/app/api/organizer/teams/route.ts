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
import {
  fetchTeamsWithScoresFromSupabase,
  deleteTeamFromSupabase,
  updateTeamInSupabase,
} from '@/lib/supabase/sync';

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
      const dbTeams = await fetchTeamsWithScoresFromSupabase();
      if (dbTeams && dbTeams.length > 0) {
        return NextResponse.json({
          success: true,
          teams: dbTeams,
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
      let all = getAllTeams();

      const isMockUrl =
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

      if (!isMockUrl) {
        try {
          const dbTeams = await fetchTeamsWithScoresFromSupabase();
          if (dbTeams && dbTeams.length > 0) {
            all = dbTeams;
          }
        } catch (dbErr) {
          console.error('Failed to load DB teams for qualifiers:', dbErr);
        }
      }

      for (const t of all) {
        const isQualified = qualifierIds.includes(t.id) || qualifierIds.includes(t.code);
        updateTeam(t.id, {
          is_eliminated: !isQualified,
          eliminated_after_round: !isQualified ? currentRoundNumber : null,
        });
      }

      if (!isMockUrl) {
        try {
          const { syncRoundQualifications } = await import('@/lib/supabase/sync');
          const qualificationList = all.map((t, idx) => ({
            teamId: t.code || t.id,
            isQualified: qualifierIds.includes(t.id) || qualifierIds.includes(t.code),
            rank: idx + 1,
          }));
          await syncRoundQualifications(currentRoundNumber, qualificationList);

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

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    let updated;
    if (action === 'modify' || name !== undefined || captain !== undefined || email !== undefined || code !== undefined || password !== undefined || is_eliminated !== undefined) {
      if (!isMockUrl) {
        const dbResult = await updateTeamInSupabase(teamId, {
          name,
          captain,
          email,
          code,
          password,
          is_eliminated,
          eliminated_after_round: body.eliminated_after_round !== undefined ? body.eliminated_after_round : (is_eliminated ? currentRoundNumber : null),
        });
        if (dbResult.success && dbResult.team) {
          updated = {
            id: dbResult.team.id,
            name: dbResult.team.name,
            captain: dbResult.team.captain_name || captain || '',
            email: dbResult.team.captain_email || email || '',
            code: dbResult.team.join_code,
            password: password || '',
            total_score: 0,
            latest_round_score: 0,
            per_round_scores: {},
            is_eliminated: dbResult.team.is_eliminated,
            eliminated_after_round: dbResult.team.eliminated_after_round,
            createdAt: dbResult.team.created_at,
            members: [],
          };
        }
      }

      const memUpdated = updateTeam(teamId, {
        name,
        captain,
        email,
        code,
        password,
        is_eliminated,
        eliminated_after_round: body.eliminated_after_round !== undefined ? body.eliminated_after_round : (is_eliminated ? currentRoundNumber : null),
      });

      if (memUpdated) updated = memUpdated;

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
      if (!isMockUrl) {
        const { data: dbTeam } = await supabaseAdmin.from('teams').select('is_eliminated').or(`id.eq.${teamId},join_code.eq.${teamId}`).maybeSingle();
        if (dbTeam) {
          const nextState = !dbTeam.is_eliminated;
          await updateTeamInSupabase(teamId, {
            is_eliminated: nextState,
            eliminated_after_round: nextState ? currentRoundNumber : null,
          });
          updated = {
            id: teamId,
            name: 'Team',
            captain: 'Captain',
            email: '',
            code: '',
            password: '',
            total_score: 0,
            latest_round_score: 0,
            per_round_scores: {},
            is_eliminated: nextState,
            eliminated_after_round: nextState ? currentRoundNumber : null,
            createdAt: new Date().toISOString(),
            members: [],
          };
        }
      }

      const memUpdated = toggleTeamElimination(teamId, currentRoundNumber);
      if (memUpdated) updated = memUpdated;

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

    const isMockUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

    let teamName = '';

    // 1. Delete from Supabase if connected
    if (!isMockUrl) {
      const dbResult = await deleteTeamFromSupabase(teamId);
      if (dbResult.success && dbResult.teamName) {
        teamName = dbResult.teamName;
      } else {
        const mem = findTeamByIdentifier(teamId);
        if (mem && mem.code && mem.code !== teamId) {
          const retry = await deleteTeamFromSupabase(mem.code);
          if (retry.success && retry.teamName) {
            teamName = retry.teamName;
          }
        }
      }
    }

    // 2. Also remove from local in-memory store if present
    const memTeam = findTeamByIdentifier(teamId);
    if (memTeam) {
      deleteTeam(teamId);
      if (!teamName) teamName = memTeam.name;
    }

    if (!teamName && isMockUrl && !memTeam) {
      return NextResponse.json(
        { success: false, error: 'Team not found.' },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: 'ORGANIZER_DELETED_TEAM',
      entityType: 'team',
      entityId: teamId,
      details: {
        team_name: teamName || teamId,
        organizer: payload.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Team '${teamName || teamId}' deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
