import { describe, it, expect } from 'vitest';
import { rankTeamsWithTieBreak, type TeamLeaderboardEntry } from '../../src/lib/crypto/tie-break';

describe('Deterministic Tie-Break Engine', () => {
  it('breaks ties using total marks, round-by-round rollback, and earlier submission time', () => {
    const teams: TeamLeaderboardEntry[] = [
      {
        rank: 0,
        team_id: '1',
        team_name: 'Team Alpha',
        total_score: 300,
        latest_round_score: 100,
        per_round_scores: { '1': { points: 100 }, '2': { points: 100 }, '3': { points: 100 } },
        is_eliminated: false,
        last_submission_time: '2026-11-11T14:40:00Z',
      },
      {
        rank: 0,
        team_id: '2',
        team_name: 'Team Beta',
        total_score: 300,
        latest_round_score: 100,
        per_round_scores: { '1': { points: 100 }, '2': { points: 100 }, '3': { points: 100 } },
        is_eliminated: false,
        last_submission_time: '2026-11-11T14:35:00Z', // Submitted earlier
      },
      {
        rank: 0,
        team_id: '3',
        team_name: 'Team Gamma',
        total_score: 350,
        latest_round_score: 150,
        per_round_scores: { '1': { points: 100 }, '2': { points: 100 }, '3': { points: 150 } },
        is_eliminated: false,
        last_submission_time: '2026-11-11T14:50:00Z',
      },
    ];

    const ranked = rankTeamsWithTieBreak(teams, 3);

    // 1st place: Team Gamma (350 pts)
    expect(ranked[0].team_name).toBe('Team Gamma');
    expect(ranked[0].rank).toBe(1);

    // 2nd place: Team Beta (Tie at 300, same per round, but submitted at 14:35 vs 14:40)
    expect(ranked[1].team_name).toBe('Team Beta');
    expect(ranked[1].rank).toBe(2);

    // 3rd place: Team Alpha
    expect(ranked[2].team_name).toBe('Team Alpha');
    expect(ranked[2].rank).toBe(3);
  });
});
