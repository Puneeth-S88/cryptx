// Sync existing teams in Supabase with Supabase Auth, Profiles, and Team Members
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Minimal WebSocket stub for Node < 22 if needed
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sync() {
  console.log('Connecting to Supabase at:', supabaseUrl);

  // 1. Ensure organizer account exists in auth.users
  const organizerEmail = 'organizer@cryptex.internal';
  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('Failed to list auth users:', listErr);
    process.exit(1);
  }

  const existingUsers = usersData?.users || [];
  let organizerUser = existingUsers.find((u) => u.email?.toLowerCase() === organizerEmail.toLowerCase());

  if (!organizerUser) {
    const { data: createdOrg, error: orgErr } = await supabaseAdmin.auth.admin.createUser({
      email: organizerEmail,
      password: 'CryptX@2026!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Command Room Organizer',
        role: 'organizer',
      },
    });
    if (orgErr) {
      console.warn('Organizer auth user creation notice:', orgErr.message);
    } else {
      organizerUser = createdOrg.user;
      console.log('✓ Created Organizer Auth User:', organizerEmail);
    }
  } else {
    console.log('✓ Organizer Auth User exists:', organizerEmail);
  }

  if (organizerUser) {
    await supabaseAdmin.from('profiles').upsert({
      id: organizerUser.id,
      email: organizerEmail,
      full_name: 'Command Room Organizer',
      role: 'organizer',
    }, { onConflict: 'id' });
  }

  // 2. Query all teams
  const { data: teams, error: teamsErr } = await supabaseAdmin
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });

  if (teamsErr) {
    console.error('Failed to load teams from Supabase:', teamsErr);
    process.exit(1);
  }

  console.log(`Found ${teams.length} teams in Supabase teams table.`);

  for (const team of teams) {
    const captainEmail =
      team.captain_email || `${team.join_code.toLowerCase()}@cryptex.internal`;
    const captainName = team.captain_name || `${team.name} Captain`;

    let user = existingUsers.find(
      (u) => u.email?.toLowerCase() === captainEmail.toLowerCase()
    );

    if (!user) {
      // Determine password: if raw is stored, use it; if bcrypt hash, default to 'Competitor@2026'
      const isBcrypt = team.password_hash?.startsWith('$2');
      const pass = isBcrypt ? 'Competitor@2026' : (team.password_hash || 'Competitor@2026');

      const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: captainEmail,
        password: pass,
        email_confirm: true,
        user_metadata: {
          full_name: captainName,
          team_name: team.name,
          team_code: team.join_code,
        },
      });

      if (createErr) {
        console.warn(`Could not create auth user for team ${team.name} (${captainEmail}):`, createErr.message);
      } else if (createdUser?.user) {
        user = createdUser.user;
        console.log(`✓ Created Auth User for team "${team.name}" -> ${captainEmail} (${user.id})`);
      }
    } else {
      console.log(`✓ Auth User already exists for team "${team.name}" -> ${captainEmail}`);
    }

    if (user) {
      // Upsert profile
      await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email: captainEmail,
        full_name: captainName,
        role: 'participant',
      }, { onConflict: 'id' });

      // Link captain_id in teams table
      if (!team.captain_id || team.captain_id !== user.id) {
        await supabaseAdmin
          .from('teams')
          .update({ captain_id: user.id, captain_email: captainEmail })
          .eq('id', team.id);
        console.log(`  -> Linked captain_id for team "${team.name}" to ${user.id}`);
      }

      // Upsert into team_members
      await supabaseAdmin.from('team_members').upsert({
        team_id: team.id,
        user_id: user.id,
        role: 'captain',
      }, { onConflict: 'team_id,user_id' });
    }
  }

  // Final summary
  const { data: finalAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
  const { count: profCount } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
  const { count: memberCount } = await supabaseAdmin.from('team_members').select('*', { count: 'exact', head: true });

  console.log('\n===========================================');
  console.log('SYNC SUMMARY:');
  console.log(`- Supabase Auth Users: ${finalAuthUsers?.users?.length || 0}`);
  console.log(`- Profiles in public.profiles: ${profCount}`);
  console.log(`- Team Members in public.team_members: ${memberCount}`);
  console.log('===========================================\n');
}

sync().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
