import { describe, it, expect } from 'vitest';
import {
  evaluateStandardQuizRound,
  type StandardQuestionSecret,
  type StandardQuestionSubmission,
} from '../../src/lib/crypto/standard-quiz-evaluator';

describe('Standard Quiz Question Builder & Scoring Engine', () => {
  it('correctly evaluates MCQ and TEXT questions with normalization', () => {
    const secrets: StandardQuestionSecret[] = [
      {
        question_id: 'q1',
        type: 'mcq',
        points: 20,
        correct_option_index: 1, // Option B
      },
      {
        question_id: 'q2',
        type: 'text',
        points: 30,
        accepted_answers: ['KEY', 'THE KEY', 'SECRET KEY'],
        text_settings: {
          ignore_case: true,
          ignore_punct_space: true,
        },
      },
    ];

    // Perfect submission
    const perfectSubs: StandardQuestionSubmission[] = [
      { question_id: 'q1', type: 'mcq', selected_option_index: 1 },
      { question_id: 'q2', type: 'text', text_answer: '  the key!  ' },
    ];

    const perfectResult = evaluateStandardQuizRound(perfectSubs, secrets);
    expect(perfectResult.score).toBe(50);
    expect(perfectResult.maxScore).toBe(50);
    expect(perfectResult.isFullyCorrect).toBe(true);

    // Partial submission (wrong MCQ, correct TEXT with punctuation)
    const partialSubs: StandardQuestionSubmission[] = [
      { question_id: 'q1', type: 'mcq', selected_option_index: 0 },
      { question_id: 'q2', type: 'text', text_answer: 'KEY' },
    ];

    const partialResult = evaluateStandardQuizRound(partialSubs, secrets);
    expect(partialResult.score).toBe(30);
    expect(partialResult.isFullyCorrect).toBe(false);
  });
});
