import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTeams,
  registerNewTeam,
  findTeamByIdentifier,
  updateTeamScore,
  toggleTeamElimination,
  generateAutoPassword,
  generateTeamJoinCode,
  resetTeamsStore,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
} from '../../src/lib/teams';

describe('Team Registry & Score System', () => {
  beforeEach(() => {
    resetTeamsStore();
  });
  it('generates compliant passwords and team codes', () => {
    const pwd = generateAutoPassword();
    expect(pwd).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{4}$/);

    const code = generateTeamJoinCode('Cyber Knights');
    expect(code).toMatch(/^CYBER-\d{4}$/);
  });

  it('registers a new team and finds them by code or email', () => {
    const team = registerNewTeam({
      name: 'Vortex Sentinel',
      captain: 'Prajwal',
      email: 'prajwal@vortex.internal',
      code: 'VORTEX-1111',
      password: 'Cipher-Vault-9999',
    });

    expect(team.name).toBe('Vortex Sentinel');
    expect(team.code).toBe('VORTEX-1111');

    const foundByCode = findTeamByIdentifier('VORTEX-1111');
    expect(foundByCode?.id).toBe(team.id);

    const foundByEmail = findTeamByIdentifier('prajwal@vortex.internal');
    expect(foundByEmail?.id).toBe(team.id);
  });

  it('updates team score per round and calculates total score', () => {
    const team = registerNewTeam({
      name: 'Stego Squad',
      captain: 'Puneeth',
      email: 'puneeth@stego.internal',
      code: 'STEGO-2222',
      password: 'Crypto-Shield-1234',
    });

    expect(team.total_score).toBe(0);

    const updated = updateTeamScore(team.id, 1, 100);
    expect(updated?.latest_round_score).toBe(100);
    expect(updated?.total_score).toBe(100);

    const updatedR2 = updateTeamScore(team.id, 2, 80);
    expect(updatedR2?.latest_round_score).toBe(80);
    expect(updatedR2?.total_score).toBe(180);
  });

  it('toggles team elimination correctly', () => {
    const team = registerNewTeam({
      name: 'Shadow Ciphers',
      captain: 'Bob',
      email: 'bob@shadow.internal',
      code: 'SHAD-3333',
    });

    expect(team.is_eliminated).toBe(false);

    const eliminated = toggleTeamElimination(team.id, 2);
    expect(eliminated?.is_eliminated).toBe(true);
    expect(eliminated?.eliminated_after_round).toBe(2);

    const reinstated = toggleTeamElimination(team.id);
    expect(reinstated?.is_eliminated).toBe(false);
  });

  it('modifies and deletes a team correctly', () => {
    const team = registerNewTeam({
      name: 'Mod Team',
      captain: 'Original Capt',
      email: 'capt@mod.internal',
      code: 'MOD-9999',
      password: 'OldPassword123',
    });

    const modified = updateTeam(team.id, {
      name: 'Modified Team Alpha',
      captain: 'New Capt',
      password: 'NewSecurePassword456',
    });

    expect(modified?.name).toBe('Modified Team Alpha');
    expect(modified?.captain).toBe('New Capt');
    expect(modified?.password).toBe('NewSecurePassword456');

    const deleted = deleteTeam(team.id);
    expect(deleted).toBe(true);
    expect(findTeamByIdentifier('MOD-9999')).toBeUndefined();
  });

  it('adds and removes team members with capacity and role constraints', () => {
    const team = registerNewTeam({
      name: 'Squad Goals',
      captain: 'Capt Carol',
      email: 'carol@squad.internal',
      code: 'SQD-1234',
    });

    // 1 member initially (captain)
    expect(team.members).toHaveLength(1);
    expect(team.members[0].role).toBe('Captain');

    // Add 2nd member
    const add1 = addTeamMember(team.id, { name: 'Member Dave', email: 'dave@squad.internal' });
    expect(add1.success).toBe(true);
    expect(add1.team?.members).toHaveLength(2);

    // Add 3rd member
    const add2 = addTeamMember(team.id, { name: 'Member Eve', email: 'eve@squad.internal' });
    expect(add2.success).toBe(true);
    expect(add2.team?.members).toHaveLength(3);

    // Add 4th member
    const add3 = addTeamMember(team.id, { name: 'Member Frank', email: 'frank@squad.internal' });
    expect(add3.success).toBe(true);
    expect(add3.team?.members).toHaveLength(4);

    // Reject 5th member (exceeds max 4)
    const add4 = addTeamMember(team.id, { name: 'Member Grace', email: 'grace@squad.internal' });
    expect(add4.success).toBe(false);
    expect(add4.error).toMatch(/Maximum team size reached/i);

    // Reject duplicate email
    const duplicate = addTeamMember(team.id, { name: 'Dave Clone', email: 'dave@squad.internal' });
    expect(duplicate.success).toBe(false);

    // Cannot remove Captain
    const captId = team.members[0].id;
    const remCapt = removeTeamMember(team.id, captId);
    expect(remCapt.success).toBe(false);
    expect(remCapt.error).toMatch(/Cannot remove the Team Captain/i);

    // Remove 4th member
    const memberId = add3.team!.members[3].id;
    const remMember = removeTeamMember(team.id, memberId);
    expect(remMember.success).toBe(true);
    expect(remMember.team?.members).toHaveLength(3);
  });
});
