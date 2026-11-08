import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  getQuestionsForRound,
  saveQuestionsForRound,
  sanitizeQuestionsForParticipant,
  resetQuestionsStore,
} from '@/lib/questions';
import type { QuestionDraft } from '@/components/organizer/QuestionBuilder';

describe('Questions Registry & Dynamic Sync', () => {
  beforeEach(() => {
    resetQuestionsStore();
  });

  afterAll(() => {
    resetQuestionsStore();
  });
  it('retrieves default seeded questions for Round 1', () => {
    const qList = getQuestionsForRound('r1');
    expect(qList.length).toBeGreaterThanOrEqual(2);
    expect(qList[0].question_type).toBe('mcq');
    expect(qList[0].options.length).toBe(4);
  });

  it('sanitizes questions for participants without leaking correct answers', () => {
    const fullQuestions = getQuestionsForRound('r1');
    const sanitized = sanitizeQuestionsForParticipant(fullQuestions);

    sanitized.forEach((q: any) => {
      expect(q.correct_option_index).toBeUndefined();
      expect(q.accepted_answers).toBeUndefined();
      expect(q.question_text).toBeTruthy();
      expect(q.points).toBeGreaterThan(0);
    });
  });

  it('saves new questions, updates order index, and persists across queries', async () => {
    const customQuestions: QuestionDraft[] = [
      {
        order_index: 1,
        question_type: 'mcq',
        question_text: 'What is AES?',
        options: ['Advanced Encryption Standard', 'Ancient Encoding System'],
        points: 25,
        correct_option_index: 0,
        accepted_answers: [],
        text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
      },
      {
        order_index: 2,
        question_type: 'text',
        question_text: 'What does RSA stand for?',
        options: [],
        points: 35,
        correct_option_index: 0,
        accepted_answers: ['RIVEST SHAMIR ADLEMAN'],
        text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
      },
    ];

    const saved = await saveQuestionsForRound('r_test', customQuestions);
    expect(saved.length).toBe(2);
    expect(saved[0].points).toBe(25);
    expect(saved[1].points).toBe(35);

    // Retrieve again to verify persistence
    const loaded = getQuestionsForRound('r_test');
    expect(loaded.length).toBe(2);
    expect(loaded[0].question_text).toBe('What is AES?');
    expect(loaded[1].accepted_answers).toContain('RIVEST SHAMIR ADLEMAN');
  });
});
