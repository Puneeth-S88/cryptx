import { z } from 'zod';

export const QuestionTypeSchema = z.enum(['mcq', 'text']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const RoundTypeSchema = z.enum([
  'standard',
  'polybius',
  'scramble',
  'memory',
  'auction',
  'colour',
  'vigenere',
  'jury',
]);
export type RoundType = z.infer<typeof RoundTypeSchema>;

// Text Question Settings Schema
export const TextSettingsSchema = z.object({
  ignore_case: z.boolean().default(true),
  ignore_punct_space: z.boolean().default(true),
  accept_multiple_answers: z.boolean().default(true),
});

// Single Question Schema for Builder
export const QuestionSchema = z.object({
  id: z.string().optional(),
  round_id: z.string().uuid(),
  order_index: z.number().int().min(0),
  question_type: QuestionTypeSchema,
  question_text: z.string().min(1, 'Question text cannot be empty'),
  monospace_code: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  points: z.number().min(0, 'Marks must be 0 or higher'),
  text_settings: TextSettingsSchema.optional(),
  // Private secret data (for organizer creating/editing questions)
  correct_option_index: z.number().int().min(0).optional(),
  accepted_answers: z.array(z.string().min(1)).optional(),
  explanation: z.string().optional().nullable(),
}).refine((data) => {
  if (data.question_type === 'mcq') {
    if (!data.options || data.options.length < 2 || data.options.length > 6) {
      return false;
    }
    if (data.correct_option_index === undefined || data.correct_option_index < 0 || data.correct_option_index >= data.options.length) {
      return false;
    }
  } else if (data.question_type === 'text') {
    if (!data.accepted_answers || data.accepted_answers.length === 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Invalid question configuration: MCQ requires 2-6 options with one correct answer; TEXT requires at least one accepted answer.',
});

// Bulk Import Questions Schema
export const BulkImportQuestionsSchema = z.object({
  round_id: z.string().uuid(),
  questions: z.array(z.object({
    question_type: QuestionTypeSchema,
    question_text: z.string().min(1),
    monospace_code: z.string().optional().nullable(),
    options: z.array(z.string()).optional(),
    points: z.number().min(0),
    correct_option_index: z.number().int().optional(),
    accepted_answers: z.array(z.string()).optional(),
  })),
});

// Round Builder Meta Schema
export const RoundBuilderSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  round_number: z.number().int().min(1),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  topic: z.string().min(2, 'Topic description required'),
  round_type: RoundTypeSchema,
  duration_seconds: z.number().int().min(60, 'Minimum 1 minute limit'),
  max_points: z.number().int().min(0),
  qualification_note: z.string().optional(),
  order_index: z.number().int().min(0),
});

// Special Templates Content Config Schemas
export const PolybiusConfigSchema = z.object({
  grid_layout: z.array(z.array(z.string().min(1))).length(5),
  ciphertext_pairs: z.string().min(1),
  plaintext_answer: z.string().min(1),
  points: z.number().min(0),
});

export const ScrambleConfigSchema = z.object({
  words: z.array(z.object({
    id: z.number(),
    word: z.string().min(1),
    clue: z.string().min(1),
    points: z.number().min(0),
  })).min(1),
});

export const MemoryConfigSchema = z.object({
  substitution_key: z.record(z.string(), z.string()),
  reveal_duration_seconds: z.number().int().min(3).max(120),
  words_to_decode: z.array(z.object({
    cipher_word: z.string().min(1),
    plain_word: z.string().min(1),
    points: z.number().min(0),
  })).min(1),
});

export const AuctionConfigSchema = z.object({
  ciphertext: z.string().min(1),
  plaintext_answer: z.string().min(1),
  base_points: z.number().min(0),
  deduction_per_hint: z.number().min(0),
  hints: z.array(z.string().min(1)).max(2),
});

export const ColourCipherConfigSchema = z.object({
  colour_a: z.string().min(1).default('Blue'),
  colour_b: z.string().min(1).default('Orange'),
  sequences: z.array(z.array(z.string())).min(1),
  plaintext_answer: z.string().min(1),
  points: z.number().min(0),
});

export const VigenereConfigSchema = z.object({
  ciphertext: z.string().min(1),
  key: z.string().min(1),
  plaintext_answer: z.string().min(1),
  plaintext_points: z.number().min(0),
  explanation_points: z.number().min(0),
  required_keywords: z.array(z.string()).default([]),
});

export const JuryManualConfigSchema = z.object({
  max_points: z.number().min(0),
  evaluation_criteria: z.string().optional(),
});
