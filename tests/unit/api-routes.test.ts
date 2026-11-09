import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { GET as sessionHandler } from '@/app/api/auth/session/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { GET as getAnnouncements, POST as postAnnouncementRoute, DELETE as deleteAnnouncementRoute } from '@/app/api/announcements/route';
import { POST as submitHandler } from '@/app/api/rounds/[roundId]/submit/route';
import { PATCH as updateTeamRoute, DELETE as deleteTeamRoute } from '@/app/api/organizer/teams/route';
import { GET as getMembersRoute, POST as addMemberRoute, DELETE as deleteMemberRoute } from '@/app/api/team/members/route';
import { GET as leaderboardHandler } from '@/app/api/leaderboard/route';
import { POST as elevateHandler } from '@/app/api/organizer/elevate/route';
import { POST as lockControlsHandler } from '@/app/api/organizer/lock-controls/route';
import { GET as getRoundsHandler, PATCH as patchRoundHandler } from '@/app/api/rounds/route';
import { GET as getQuestionsRoute, PUT as putQuestionsRoute } from '@/app/api/rounds/[roundId]/questions/route';
import { resetTeamsStore } from '@/lib/teams';
import { resetRoundsStore, updateRoundState } from '@/lib/rounds';
import { resetQuestionsStore } from '@/lib/questions';
import { createSession } from '@/lib/session';

describe('API Route Security and Validation Suite', () => {
  beforeEach(async () => {
    resetTeamsStore();
    resetRoundsStore();
    resetQuestionsStore();
    // Ensure Round 1 is open for testing submissions
    await updateRoundState('r1', 'open', { duration_seconds: 600 });
  });

  afterAll(() => {
    resetQuestionsStore();
  });

  describe('Authentication Route (/api/auth/login)', () => {
    it('authenticates organizer with valid bcrypt-hashed credentials', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrCode: 'organizer@cryptex.internal',
          password: 'CryptX@2026!',
          role: 'organizer',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user.role).toBe('organizer');
      expect(json.token).toBeTruthy();
    });

    it('rejects invalid organizer credentials', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrCode: 'organizer@cryptex.internal',
          password: 'WrongPassword123',
          role: 'organizer',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('authenticates team with registered password', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrCode: 'ACES-9942',
          password: 'Competitor@2026', // t1 registered password
          role: 'participant',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user.name).toBe('CipherAces');
      expect(json.user.is_qualified).toBe(true);
    });

    it('correctly sets is_qualified to false for eliminated teams', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrCode: 'POLY-4409', // t5 (eliminated)
          password: 'Competitor@2026',
          role: 'participant',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.user.is_qualified).toBe(false);
      expect(json.user.eliminated_after_round).toBe(2);
    });
  });

  describe('Session Verification Route (/api/auth/session)', () => {
    it('returns authenticated user details for valid token', async () => {
      const { token } = createSession({
        id: 'test_team',
        name: 'Test Team',
        role: 'participant',
      });

      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const res = await sessionHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.authenticated).toBe(true);
      expect(json.user.accountId).toBe('test_team');
    });

    it('rejects unauthenticated requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
      });

      const res = await sessionHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.authenticated).toBe(false);
    });
  });

  describe('Announcements Route Security (/api/announcements)', () => {
    it('allows public GET to retrieve announcements', async () => {
      const res = await getAnnouncements();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.announcements)).toBe(true);
    });

    it('blocks unauthenticated POST for announcement creation', async () => {
      const req = new NextRequest('http://localhost:3000/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Fake Announcement' }),
      });

      const res = await postAnnouncementRoute(req);
      expect(res.status).toBe(403);
    });

    it('allows authenticated organizer to broadcast an announcement', async () => {
      const { token } = createSession({
        id: 'org_admin',
        name: 'Chief Arbiter',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'Competition is officially starting!',
          priority: 'urgent',
        }),
      });

      const res = await postAnnouncementRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.announcement.message).toBe('Competition is officially starting!');
    });

    it('blocks unauthenticated DELETE to clear announcements', async () => {
      const req = new NextRequest('http://localhost:3000/api/announcements', {
        method: 'DELETE',
      });

      const res = await deleteAnnouncementRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe('Answer Submission Route Security & Evaluation (/api/rounds/[roundId]/submit)', () => {
    it('rejects unauthenticated submissions', async () => {
      const req = new NextRequest('http://localhost:3000/api/rounds/r1/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: 't1',
          payload: { 1: 'B', 2: 'A', 3: 'C', 4: 'B', 5: 'KEY' },
        }),
      });

      const res = await submitHandler(req, { params: { roundId: 'r1' } });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('blocks spoofed submissions from a different team', async () => {
      const { token } = createSession({
        id: 't2',
        teamId: 't2',
        name: 'Atbashers United',
        role: 'participant',
      });

      // Token belongs to t2, but body claims to submit for t1
      const req = new NextRequest('http://localhost:3000/api/rounds/r1/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: 't1',
          payload: { 1: 'B' },
        }),
      });

      const res = await submitHandler(req, { params: { roundId: 'r1' } });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
    });

    it('scores Round 4 Scramble successfully when UI sends w_1 .. w_5 keys', async () => {
      await updateRoundState('r4', 'open', { duration_seconds: 600 });

      const { token } = createSession({
        id: 't1',
        teamId: 't1',
        name: 'CipherAces',
        role: 'participant',
      });

      const req = new NextRequest('http://localhost:3000/api/rounds/r4/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: 't1',
          payload: {
            w_1: 'VIGENERE',
            w_2: 'ALPHABET',
            w_3: 'PUZZLE',
            w_4: 'LEVEL',
            w_5: 'TEXT',
          },
        }),
      });

      const res = await submitHandler(req, { params: { roundId: 'r4' } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.score).toBe(150);
      expect(json.isFullyCorrect).toBe(true);
    });

    it('scores Round 6 Auction successfully when UI sends auction_answer', async () => {
      await updateRoundState('r6', 'open', { duration_seconds: 600 });

      const { token } = createSession({
        id: 't1',
        teamId: 't1',
        name: 'CipherAces',
        role: 'participant',
      });

      const req = new NextRequest('http://localhost:3000/api/rounds/r6/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: 't1',
          payload: {
            auction_answer: 'MEET AT DAWN',
            hintsUsed: 1,
          },
        }),
      });

      const res = await submitHandler(req, { params: { roundId: 'r6' } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.score).toBe(150); // 200 - 50 (1 hint used)
    });
  });

  describe('Organizer Team Management Routes (/api/organizer/teams)', () => {
    it('allows organizer to modify team details', async () => {
      const { token } = createSession({
        id: 'org1',
        name: 'Organizer Lead',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/organizer/teams', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'modify',
          teamId: 't1',
          name: 'Renamed Aces',
          captain: 'Alice New Capt',
        }),
      });

      const res = await updateTeamRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.team.name).toBe('Renamed Aces');
      expect(json.team.captain).toBe('Alice New Capt');
    });

    it('allows organizer to confirm qualifiers and persists elimination across teams', async () => {
      const { token } = createSession({
        id: 'org1',
        name: 'Organizer Lead',
        role: 'organizer',
      });

      // Select top 2 teams: t1 and t2
      const req = new NextRequest('http://localhost:3000/api/organizer/teams', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'qualify',
          currentRoundNumber: 1,
          qualifierTeamIds: ['t1', 't2'],
        }),
      });

      const res = await updateTeamRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const team1 = json.teams.find((t: any) => t.id === 't1');
      const team2 = json.teams.find((t: any) => t.id === 't2');
      const team3 = json.teams.find((t: any) => t.id === 't3');
      const team4 = json.teams.find((t: any) => t.id === 't4');

      expect(team1.is_eliminated).toBe(false);
      expect(team2.is_eliminated).toBe(false);
      expect(team3.is_eliminated).toBe(true);
      expect(team3.eliminated_after_round).toBe(1);
      expect(team4.is_eliminated).toBe(true);
      expect(team4.eliminated_after_round).toBe(1);
    });

    it('allows organizer to delete a team', async () => {
      const { token } = createSession({
        id: 'org1',
        name: 'Organizer Lead',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/organizer/teams?teamId=t5', {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const res = await deleteTeamRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('rejects unauthorized delete attempts', async () => {
      const req = new NextRequest('http://localhost:3000/api/organizer/teams?teamId=t1', {
        method: 'DELETE',
      });

      const res = await deleteTeamRoute(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Team Member Roster Management Routes (/api/team/members)', () => {
    it('allows a logged-in team to add and remove members', async () => {
      const { token } = createSession({
        id: 't2',
        teamId: 't2',
        name: 'Atbashers United',
        role: 'participant',
      });

      // Add a new member
      const addReq = new NextRequest('http://localhost:3000/api/team/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Teammate Test',
          email: 'test@atbashers.org',
        }),
      });

      const addRes = await addMemberRoute(addReq);
      const addJson = await addRes.json();

      expect(addRes.status).toBe(200);
      expect(addJson.success).toBe(true);
      expect(addJson.members).toHaveLength(2);

      const addedMemberId = addJson.members[1].id;

      // Get members
      const getReq = new NextRequest('http://localhost:3000/api/team/members', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const getRes = await getMembersRoute(getReq);
      const getJson = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getJson.members).toHaveLength(2);

      // Remove member
      const delReq = new NextRequest(`http://localhost:3000/api/team/members?memberId=${addedMemberId}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const delRes = await deleteMemberRoute(delReq);
      const delJson = await delRes.json();

      expect(delRes.status).toBe(200);
      expect(delJson.success).toBe(true);
      expect(delJson.members).toHaveLength(1);
    });

    it('rejects unauthenticated member access', async () => {
      const req = new NextRequest('http://localhost:3000/api/team/members', {
        method: 'GET',
      });

      const res = await getMembersRoute(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Auth Logout and Signup Routes (/api/auth/logout, /api/auth/signup)', () => {
    it('successfully logs out and clears session', async () => {
      const { token } = createSession({
        id: 't1',
        name: 'CipherAces',
        role: 'participant',
      });

      const req = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const res = await logoutHandler(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('rejects team registration without name', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await signupHandler(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('registers new team via signup route', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nova Crypt',
          captain: 'Nova Leader',
          email: 'nova@crypt.internal',
          autoGeneratePassword: true,
        }),
      });

      const res = await signupHandler(req);
      const json = await res.json();
      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.team.name).toBe('Nova Crypt');
      expect(json.credentials.code).toBeTruthy();
    });
  });

  describe('Leaderboard Route (/api/leaderboard)', () => {
    it('returns ranked leaderboard and frozen status', async () => {
      const res = await leaderboardHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.leaderboard)).toBe(true);
      expect(json.leaderboard.length).toBeGreaterThan(0);
      expect(typeof json.frozen).toBe('boolean');
    });
  });

  describe('Organizer Elevation and Lock Controls (/api/organizer/elevate, /api/organizer/lock-controls)', () => {
    it('rejects elevation from unauthenticated request', async () => {
      const req = new NextRequest('http://localhost:3000/api/organizer/elevate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'CryptX@2026!' }),
      });

      const res = await elevateHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects elevation from participant session', async () => {
      const { token } = createSession({
        id: 'participant_1',
        name: 'Player One',
        role: 'participant',
      });

      const req = new NextRequest('http://localhost:3000/api/organizer/elevate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const res = await elevateHandler(req);
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('elevates permissions directly for authenticated organizer session', async () => {
      const { token } = createSession({
        id: 'organizer_1',
        name: 'Lead Organizer',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/organizer/elevate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const res = await elevateHandler(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.elevated).toBe(true);
      expect(json.token).toBeTruthy();
    });

    it('locks organizer controls successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/organizer/lock-controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await lockControlsHandler(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Rounds Route (/api/rounds)', () => {
    it('returns all rounds and active round', async () => {
      const res = await getRoundsHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.rounds).toHaveLength(8);
      expect(json.activeRound).toBeTruthy();
    });

    it('rejects patch round state without organizer session', async () => {
      const req = new NextRequest('http://localhost:3000/api/rounds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: 'r2', state: 'open' }),
      });

      const res = await patchRoundHandler(req);
      expect(res.status).toBe(401);
    });

    it('updates round state when authorized as organizer', async () => {
      const { token } = createSession({
        id: 'org_admin',
        name: 'Organizer',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/rounds', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roundId: 'r2', state: 'open', duration_seconds: 600 }),
      });

      const res = await patchRoundHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.round.id).toBe('r2');
      expect(json.round.state).toBe('open');
    });
  });

  describe('Round Questions Route (/api/rounds/[roundId]/questions)', () => {
    it('retrieves sanitized questions for public/participant requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/rounds/r1/questions', {
        method: 'GET',
      });

      const res = await getQuestionsRoute(req, { params: { roundId: 'r1' } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.questions)).toBe(true);
      expect(json.questions.length).toBeGreaterThanOrEqual(2);
      // Ensure correct answers are not leaked to public
      json.questions.forEach((q: any) => {
        expect(q.correct_option_index).toBeUndefined();
        expect(q.accepted_answers).toBeUndefined();
      });
    });

    it('retrieves full questions with secrets for organizer requests', async () => {
      const { token } = createSession({
        id: 'org_admin',
        name: 'Organizer',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/rounds/r1/questions', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await getQuestionsRoute(req, { params: { roundId: 'r1' } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.questions[0].correct_option_index).toBeDefined();
    });

    it('rejects put questions without organizer session', async () => {
      const req = new NextRequest('http://localhost:3000/api/rounds/r1/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: [] }),
      });

      const res = await putQuestionsRoute(req, { params: { roundId: 'r1' } });
      expect(res.status).toBe(401);
    });

    it('saves special round config when organizer submits config payload', async () => {
      const { token } = createSession({
        id: 'org_admin',
        name: 'Organizer',
        role: 'organizer',
      });

      const req = new NextRequest('http://localhost:3000/api/rounds/r3/questions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roundType: 'polybius',
          config: {
            round_type: 'polybius',
            ciphertext_pairs: '11-22-33-44',
            polybius_plaintext: 'TEST',
          },
        }),
      });

      const res = await putQuestionsRoute(req, { params: { roundId: 'r3' } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.config.polybius_plaintext).toBe('TEST');
    });
  });
});
