import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  registerNewTeam,
  generateAutoPassword,
  generateTeamJoinCode,
  getAllTeams,
  TeamRecord,
} from '@/lib/teams';
import { createAuditLog } from '@/lib/audit';

export interface RegisterTeamParams {
  name: string;
  captain?: string;
  email?: string;
  password?: string;
  code?: string;
  autoGeneratePassword?: boolean;
}

export interface RegisterTeamResult {
  success: boolean;
  team?: TeamRecord;
  credentials?: {
    teamName: string;
    code: string;
    email: string;
    password: string;
  };
  error?: string;
}

/**
 * Centrally registers a new competition team and captain account.
 * Properly provisions:
 * 1. Supabase Auth user (auth.users)
 * 2. Public profile (public.profiles)
 * 3. Public team record (public.teams) with captain_id & bcrypt-hashed password
 * 4. Team membership record (public.team_members)
 * 5. In-memory teams store synchronization
 */
export async function registerTeamAccount(params: RegisterTeamParams): Promise<RegisterTeamResult> {
  const name = params.name?.trim();
  if (!name) {
    return { success: false, error: 'Team name is required.' };
  }

  const captain = params.captain?.trim() || 'Team Captain';
  const assignedPassword =
    params.autoGeneratePassword || !params.password || !params.password.trim()
      ? generateAutoPassword()
      : params.password.trim();

  const assignedCode =
    !params.code || !params.code.trim()
      ? generateTeamJoinCode(name)
      : params.code.trim().toUpperCase();

  const email =
    params.email?.trim() || `${assignedCode.toLowerCase()}@cryptex.internal`;

  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  let captainUserId: string | null = null;
  let insertedTeamRecord: any = null;
  let createdAuthUserLocally = false;

  if (!isMockUrl) {
    try {
      // 1. Check if team name already exists in Supabase
      const { data: existingTeam } = await supabaseAdmin
        .from('teams')
        .select('id, name')
        .ilike('name', name)
        .maybeSingle();

      if (existingTeam) {
        return {
          success: false,
          error: `Team name "${name}" is already taken. Please choose a different name.`,
        };
      }

      // 2. Check if join code already exists in Supabase
      const { data: existingCode } = await supabaseAdmin
        .from('teams')
        .select('id, join_code')
        .eq('join_code', assignedCode)
        .maybeSingle();

      if (existingCode) {
        return {
          success: false,
          error: `Join code "${assignedCode}" already exists. Please choose a different code or re-submit.`,
        };
      }

      // 3. Provision or link Supabase Auth user (auth.users)
      try {
        const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: assignedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: captain,
            team_name: name,
            team_code: assignedCode,
          },
        });

        if (authResult?.user) {
          captainUserId = authResult.user.id;
          createdAuthUserLocally = true;
        } else if (authError) {
          // If the email already exists in auth, look up the existing user
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = usersList?.users?.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );
          if (existingUser) {
            captainUserId = existingUser.id;
            // Update their password and metadata to the newly requested credentials
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: assignedPassword,
              user_metadata: {
                full_name: captain,
                team_name: name,
                team_code: assignedCode,
              },
            });
          } else {
            console.warn('Supabase auth.admin.createUser note:', authError.message);
          }
        }
      } catch (authErr) {
        console.warn('Supabase auth provisioning non-fatal error:', authErr);
      }

      // 4. Ensure profile exists in public.profiles
      if (captainUserId) {
        await supabaseAdmin.from('profiles').upsert(
          {
            id: captainUserId,
            email,
            full_name: captain,
            role: 'participant',
          },
          { onConflict: 'id' }
        );
      }

      // 5. Bcrypt-hash password for storage in public.teams
      const passwordHash = await bcrypt.hash(assignedPassword, 10);

      // 6. Insert team record into public.teams
      const { data: insertedTeam, error: insertErr } = await supabaseAdmin
        .from('teams')
        .insert({
          event_id: '20261111-0000-0000-0000-000000002026',
          name,
          join_code: assignedCode,
          captain_id: captainUserId || null,
          captain_name: captain,
          captain_email: email,
          password_hash: passwordHash,
          status: 'approved',
          is_eliminated: false,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Supabase team insert error:', insertErr);

        // Rollback created auth user if we just created it
        if (createdAuthUserLocally && captainUserId) {
          await supabaseAdmin.auth.admin.deleteUser(captainUserId).catch(() => {});
        }

        if (insertErr.code === '23505') {
          if (insertErr.message?.includes('uq_event_team_name')) {
            return {
              success: false,
              error: `Team name "${name}" is already taken. Please choose another name.`,
            };
          }
          if (insertErr.message?.includes('uq_event_join_code')) {
            return {
              success: false,
              error: `Join code "${assignedCode}" already exists. Please retry.`,
            };
          }
        }

        return {
          success: false,
          error: insertErr.message || 'Database error occurred while saving team.',
        };
      }

      insertedTeamRecord = insertedTeam;

      // 7. Insert captain as initial team member in public.team_members
      if (captainUserId && insertedTeam?.id) {
        await supabaseAdmin.from('team_members').upsert(
          {
            team_id: insertedTeam.id,
            user_id: captainUserId,
            role: 'captain',
          },
          { onConflict: 'team_id,user_id' }
        );
      }
    } catch (dbErr: any) {
      console.error('Database connection error during registration:', dbErr);
      return {
        success: false,
        error: dbErr.message || 'Error communicating with database.',
      };
    }
  }

  // 8. Register in in-memory store for instant zero-latency queries
  const newTeam = registerNewTeam({
    name,
    captain,
    email,
    password: assignedPassword,
    code: assignedCode,
  });

  if (insertedTeamRecord) {
    newTeam.id = insertedTeamRecord.id;
  }

  // 9. Audit log entry
  await createAuditLog({
    action: 'TEAM_REGISTERED',
    entityType: 'team',
    entityId: newTeam.id,
    details: {
      team_name: newTeam.name,
      code: newTeam.code,
      captain: newTeam.captain,
      email: newTeam.email,
      supabase_synced: !isMockUrl,
    },
  });

  return {
    success: true,
    team: newTeam,
    credentials: {
      teamName: newTeam.name,
      code: newTeam.code,
      email: newTeam.email,
      password: assignedPassword,
    },
  };
}
