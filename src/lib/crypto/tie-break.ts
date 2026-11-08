export interface TeamLeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  total_score: number;
  latest_round_score: number;
  per_round_scores: Record<string, { points: number }>;
  is_eliminated: boolean;
  eliminated_after_round?: number | null;
  last_submission_time?: string | null;
}

/**
 * Calculates deterministic tie-breaks:
 * 1. Total score (Descending)
 * 2. Final round marks (Descending)
 * 3. Previous round marks (Descending)
 * 4. Earlier final submission time (Ascending)
 * 5. Team name alphabetical
 */
export function rankTeamsWithTieBreak(teams: TeamLeaderboardEntry[], totalRounds: number): TeamLeaderboardEntry[] {
  return [...teams].sort((a, b) => {
    // 1. Total marks
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }

    // 2. Final round marks down to round 1
    for (let r = totalRounds; r >= 1; r--) {
      const scoreA = a.per_round_scores[String(r)]?.points || 0;
      const scoreB = b.per_round_scores[String(r)]?.points || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
    }

    // 3. Earlier final submission time (earlier wins)
    const timeA = a.last_submission_time ? new Date(a.last_submission_time).getTime() : Infinity;
    const timeB = b.last_submission_time ? new Date(b.last_submission_time).getTime() : Infinity;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 4. Team name fallback
    return a.team_name.localeCompare(b.team_name);
  }).map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));
}
