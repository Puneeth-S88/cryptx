import crypto from 'crypto';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Captain' | 'Member';
  joinedAt?: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  email: string;
  code: string;
  captain: string;
  password: string; // Plain password for organizer display/handover
  total_score: number;
  latest_round_score: number;
  per_round_scores: Record<string, { points: number }>;
  is_eliminated: boolean;
  eliminated_after_round?: number | null;
  last_submission_time?: string | null;
  createdAt: string;
  members: TeamMember[];
}

// Preserve teams in memory across Next.js reloads
declare global {
  // eslint-disable-next-line no-var
  var __cryptex_teams_store: TeamRecord[] | undefined;
}

const initialTeams: TeamRecord[] = [
  {
    id: 't1',
    name: 'CipherAces',
    email: 'captain@cipheraces.com',
    code: 'ACES-9942',
    captain: 'Alice Captain',
    password: 'Competitor@2026',
    total_score: 350,
    latest_round_score: 100,
    per_round_scores: { '1': { points: 100 }, '2': { points: 150 }, '3': { points: 100 } },
    is_eliminated: false,
    last_submission_time: '2026-11-11T14:30:00Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    members: [
      { id: 'm_1_1', name: 'Alice Captain', email: 'captain@cipheraces.com', role: 'Captain', joinedAt: '2026-11-11T00:00:00.000Z' },
    ],
  },
  {
    id: 't2',
    name: 'Atbashers United',
    email: 'captain@atbashers.org',
    code: 'ATB-5512',
    captain: 'Bob Atbash',
    password: 'Competitor@2026',
    total_score: 310,
    latest_round_score: 80,
    per_round_scores: { '1': { points: 80 }, '2': { points: 150 }, '3': { points: 80 } },
    is_eliminated: false,
    last_submission_time: '2026-11-11T14:32:00Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    members: [
      { id: 'm_2_1', name: 'Bob Atbash', email: 'captain@atbashers.org', role: 'Captain', joinedAt: '2026-11-11T00:00:00.000Z' },
    ],
  },
  {
    id: 't3',
    name: 'Enigma Breakers',
    email: 'captain@enigma.io',
    code: 'ENIG-1188',
    captain: 'Alan Rotor',
    password: 'Competitor@2026',
    total_score: 280,
    latest_round_score: 60,
    per_round_scores: { '1': { points: 80 }, '2': { points: 140 }, '3': { points: 60 } },
    is_eliminated: false,
    last_submission_time: '2026-11-11T14:35:00Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    members: [
      { id: 'm_3_1', name: 'Alan Rotor', email: 'captain@enigma.io', role: 'Captain', joinedAt: '2026-11-11T00:00:00.000Z' },
    ],
  },
  {
    id: 't4',
    name: 'Quantum Hashes',
    email: 'captain@quantum.net',
    code: 'QUANT-7721',
    captain: 'Dave Qubit',
    password: 'Competitor@2026',
    total_score: 210,
    latest_round_score: 40,
    per_round_scores: { '1': { points: 60 }, '2': { points: 110 }, '3': { points: 40 } },
    is_eliminated: false,
    last_submission_time: '2026-11-11T14:40:00Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    members: [
      { id: 'm_4_1', name: 'Dave Qubit', email: 'captain@quantum.net', role: 'Captain', joinedAt: '2026-11-11T00:00:00.000Z' },
    ],
  },
  {
    id: 't5',
    name: 'Polybius Prime',
    email: 'captain@polybius.dev',
    code: 'POLY-4409',
    captain: 'Eve Coordinate',
    password: 'Competitor@2026',
    total_score: 140,
    latest_round_score: 20,
    per_round_scores: { '1': { points: 40 }, '2': { points: 80 }, '3': { points: 20 } },
    is_eliminated: true,
    eliminated_after_round: 2,
    last_submission_time: '2026-11-11T14:45:00Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    members: [
      { id: 'm_5_1', name: 'Eve Coordinate', email: 'captain@polybius.dev', role: 'Captain', joinedAt: '2026-11-11T00:00:00.000Z' },
    ],
  },
];

export function resetTeamsStore(): void {
  globalThis.__cryptex_teams_store = JSON.parse(JSON.stringify(initialTeams));
}

export function getAllTeams(): TeamRecord[] {
  if (!globalThis.__cryptex_teams_store) {
    resetTeamsStore();
  }
  return globalThis.__cryptex_teams_store!;
}

export function findTeamByIdentifier(identifier: string): TeamRecord | undefined {
  const clean = identifier.trim().toLowerCase();
  const list = getAllTeams();
  return list.find(
    (t) =>
      t.email.toLowerCase() === clean ||
      t.code.toLowerCase() === clean ||
      t.name.toLowerCase() === clean ||
      t.id.toLowerCase() === clean
  );
}

/**
 * Generates a cryptographically strong, human-readable competition password.
 * Format: Word-Word-4digits (e.g. Cyber-Matrix-8492)
 */
export function generateAutoPassword(): string {
  const prefixes = [
    'Cipher',
    'Enigma',
    'Matrix',
    'Quantum',
    'Crypto',
    'Atbash',
    'Vigenere',
    'Polybius',
    'Stego',
    'Nexus',
    'Vortex',
    'Shadow',
  ];
  const suffixes = [
    'Key',
    'Shield',
    'Vault',
    'Blade',
    'Node',
    'Lock',
    'Rotor',
    'Byte',
    'Grid',
    'Vector',
  ];
  const randomPrefix = prefixes[crypto.randomInt(0, prefixes.length)];
  const randomSuffix = suffixes[crypto.randomInt(0, suffixes.length)];
  const randomDigits = crypto.randomInt(1000, 10000);
  return `${randomPrefix}-${randomSuffix}-${randomDigits}`;
}

/**
 * Generates a standard team join code from the team name.
 * e.g. "Cyber Knights" -> "CYBER-5821"
 */
export function generateTeamJoinCode(name: string): string {
  const cleanPrefix = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 5) || 'TEAM';
  const randomDigits = crypto.randomInt(1000, 10000);
  return `${cleanPrefix}-${randomDigits}`;
}

export function registerNewTeam(teamData: {
  name: string;
  captain: string;
  email: string;
  password?: string;
  code?: string;
}): TeamRecord {
  const list = getAllTeams();

  const teamId = `team_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const password = teamData.password?.trim() || generateAutoPassword();
  const code = teamData.code?.trim().toUpperCase() || generateTeamJoinCode(teamData.name);

  const newTeam: TeamRecord = {
    id: teamId,
    name: teamData.name.trim(),
    captain: teamData.captain.trim(),
    email: teamData.email.trim(),
    code,
    password,
    total_score: 0,
    latest_round_score: 0,
    per_round_scores: {},
    is_eliminated: false,
    eliminated_after_round: null,
    last_submission_time: null,
    createdAt: new Date().toISOString(),
    members: [
      {
        id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        name: teamData.captain.trim(),
        email: teamData.email.trim(),
        role: 'Captain',
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  list.push(newTeam);
  globalThis.__cryptex_teams_store = list;
  return newTeam;
}

export function updateTeam(
  teamId: string,
  updates: Partial<Pick<TeamRecord, 'name' | 'captain' | 'email' | 'code' | 'password' | 'is_eliminated' | 'eliminated_after_round'>>
): TeamRecord | undefined {
  const list = getAllTeams();
  const cleanId = teamId.trim().toLowerCase();
  const target = list.find(
    (t) => t.id.toLowerCase() === cleanId || t.code.toLowerCase() === cleanId
  );
  if (!target) return undefined;

  if (updates.name !== undefined && updates.name.trim()) target.name = updates.name.trim();
  if (updates.captain !== undefined && updates.captain.trim()) {
    target.captain = updates.captain.trim();
    if (target.members && target.members.length > 0) {
      const capt = target.members.find((m) => m.role === 'Captain') || target.members[0];
      capt.name = target.captain;
    }
  }
  if (updates.email !== undefined && updates.email.trim()) target.email = updates.email.trim();
  if (updates.code !== undefined && updates.code.trim()) target.code = updates.code.trim().toUpperCase();
  if (updates.password !== undefined && updates.password.trim()) target.password = updates.password.trim();
  if (updates.is_eliminated !== undefined) target.is_eliminated = updates.is_eliminated;
  if (updates.eliminated_after_round !== undefined) target.eliminated_after_round = updates.eliminated_after_round;

  globalThis.__cryptex_teams_store = list;
  return target;
}

export function deleteTeam(teamId: string): boolean {
  const list = getAllTeams();
  const cleanId = teamId.trim().toLowerCase();
  const index = list.findIndex(
    (t) => t.id.toLowerCase() === cleanId || t.code.toLowerCase() === cleanId
  );
  if (index === -1) return false;
  list.splice(index, 1);
  globalThis.__cryptex_teams_store = list;
  return true;
}

export function addTeamMember(
  teamId: string,
  memberData: { name: string; email: string; role?: 'Captain' | 'Member' }
): { success: boolean; team?: TeamRecord; error?: string } {
  const list = getAllTeams();
  const cleanId = teamId.trim().toLowerCase();
  const target = list.find(
    (t) => t.id.toLowerCase() === cleanId || t.code.toLowerCase() === cleanId
  );
  if (!target) {
    return { success: false, error: 'Team not found.' };
  }

  if (target.is_eliminated) {
    return { success: false, error: 'Cannot add member: Team has been eliminated.' };
  }

  if (!target.members) {
    target.members = [];
  }

  if (target.members.length >= 4) {
    return { success: false, error: 'Maximum team size reached (4 members max).' };
  }

  const cleanEmail = memberData.email.trim().toLowerCase();
  if (target.members.some((m) => m.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'A member with this email already exists in the roster.' };
  }

  const newMember: TeamMember = {
    id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    name: memberData.name.trim(),
    email: memberData.email.trim(),
    role: memberData.role || 'Member',
    joinedAt: new Date().toISOString(),
  };

  target.members.push(newMember);
  globalThis.__cryptex_teams_store = list;
  return { success: true, team: target };
}

export function removeTeamMember(
  teamId: string,
  memberId: string
): { success: boolean; team?: TeamRecord; error?: string } {
  const list = getAllTeams();
  const cleanId = teamId.trim().toLowerCase();
  const target = list.find(
    (t) => t.id.toLowerCase() === cleanId || t.code.toLowerCase() === cleanId
  );
  if (!target) {
    return { success: false, error: 'Team not found.' };
  }

  if (!target.members || target.members.length <= 1) {
    return { success: false, error: 'A team must have at least one member.' };
  }

  const memberIndex = target.members.findIndex(
    (m) => m.id === memberId || m.email.toLowerCase() === memberId.toLowerCase()
  );
  if (memberIndex === -1) {
    return { success: false, error: 'Member not found in roster.' };
  }

  const memberToRemove = target.members[memberIndex];
  if (memberToRemove.role === 'Captain') {
    return { success: false, error: 'Cannot remove the Team Captain.' };
  }

  target.members.splice(memberIndex, 1);
  globalThis.__cryptex_teams_store = list;
  return { success: true, team: target };
}

export function toggleTeamElimination(teamId: string, currentRoundNumber: number = 1): TeamRecord | undefined {
  const list = getAllTeams();
  const target = list.find((t) => t.id === teamId);
  if (!target) return undefined;

  target.is_eliminated = !target.is_eliminated;
  target.eliminated_after_round = target.is_eliminated ? currentRoundNumber : null;
  globalThis.__cryptex_teams_store = list;
  return target;
}

export function updateTeamScore(
  teamId: string,
  roundNumber: number | string,
  score: number,
  submissionTime?: string
): TeamRecord | undefined {
  const list = getAllTeams();
  const cleanId = teamId.trim().toLowerCase();
  const target = list.find(
    (t) =>
      t.id.toLowerCase() === cleanId ||
      t.code.toLowerCase() === cleanId ||
      t.name.toLowerCase() === cleanId
  );
  if (!target) return undefined;

  target.per_round_scores = target.per_round_scores || {};
  target.per_round_scores[String(roundNumber)] = { points: score };
  target.latest_round_score = score;
  target.total_score = Object.values(target.per_round_scores).reduce(
    (acc, curr) => acc + (curr?.points || 0),
    0
  );
  target.last_submission_time = submissionTime || new Date().toISOString();
  globalThis.__cryptex_teams_store = list;
  return target;
}
