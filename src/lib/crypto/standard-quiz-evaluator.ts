import { normalizeAnswer, normalizeSentence, timingSafeEqualString } from './normalizer';
import type { EvaluationResult } from './evaluators';

export interface StandardQuestionSubmission {
  question_id: string;
  type: 'mcq' | 'text';
  selected_option_index?: number;
  text_answer?: string;
}

export interface StandardQuestionSecret {
  question_id: string;
  type: 'mcq' | 'text';
  points: number;
  correct_option_index?: number;
  accepted_answers?: string[];
  text_settings?: {
    ignore_case?: boolean;
    ignore_punct_space?: boolean;
  };
}

/**
 * Authoritative Server Evaluator for Standard Quiz Rounds (MCQ & TEXT)
 */
export function evaluateStandardQuizRound(
  submissions: StandardQuestionSubmission[],
  secrets: StandardQuestionSecret[]
): EvaluationResult {
  let earned = 0;
  let maxPossible = 0;
  const breakdown: Record<string, unknown> = {};

  for (const secret of secrets) {
    maxPossible += secret.points;
    const sub = submissions.find((s) => s.question_id === secret.question_id);

    if (secret.type === 'mcq') {
      const isCorrect =
        sub?.selected_option_index !== undefined &&
        sub.selected_option_index === secret.correct_option_index;

      const pointsAwarded = isCorrect ? secret.points : 0;
      earned += pointsAwarded;
      breakdown[secret.question_id] = {
        correct: isCorrect,
        pointsAwarded,
        submitted: sub?.selected_option_index,
      };
    } else if (secret.type === 'text') {
      const rawText = sub?.text_answer || '';
      const ignoreCase = secret.text_settings?.ignore_case ?? true;
      const ignorePunct = secret.text_settings?.ignore_punct_space ?? true;

      const processStr = (s: string) => {
        let res = s.trim();
        if (ignoreCase) res = res.toUpperCase();
        if (ignorePunct) res = res.replace(/[^A-Z0-9]/gi, '');
        else res = res.replace(/\s+/g, ' ');
        return res;
      };

      const normalizedSubmitted = processStr(rawText);
      const isCorrect = (secret.accepted_answers || []).some((ans) => {
        const normalizedTarget = processStr(ans);
        return timingSafeEqualString(normalizedSubmitted, normalizedTarget);
      });

      const pointsAwarded = isCorrect ? secret.points : 0;
      earned += pointsAwarded;
      breakdown[secret.question_id] = {
        correct: isCorrect,
        pointsAwarded,
        submitted: normalizedSubmitted,
      };
    }
  }

  return {
    score: earned,
    maxScore: maxPossible,
    breakdown,
    isFullyCorrect: earned === maxPossible && maxPossible > 0,
  };
}
