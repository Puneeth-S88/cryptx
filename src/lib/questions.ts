/**
 * In-Memory & Supabase-backed Question Registry for Championship Rounds
 * Manages question drafts, order indices, points, and solution data.
 */

import fs from 'fs';
import path from 'path';
import { QuestionDraft } from '@/components/organizer/QuestionBuilder';
import { fetchRoundQuestionsFromSupabase, saveRoundQuestionsToSupabase } from './supabase/sync';

const DATA_DIR = path.join(process.cwd(), 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions_store.json');

function loadQuestionsFromDisk(): Record<string, QuestionDraft[]> | null {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const raw = fs.readFileSync(QUESTIONS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading questions from disk:', err);
  }
  return null;
}

function persistQuestionsToDisk(store: Record<string, QuestionDraft[]>) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving questions to disk:', err);
  }
}

// Initial default questions for Round 1
const defaultR1Questions: QuestionDraft[] = [
  {
    id: 'q1-1',
    order_index: 1,
    question_type: 'mcq',
    question_text: 'What is the primary definition of decryption in classical cryptography?',
    options: [
      'Converting plaintext into unreadable ciphertext',
      'Unlocking an encrypted message using a key',
      'Destroying cryptographic keys after one transmission',
      'Generating pseudo-random hashes',
    ],
    points: 20,
    correct_option_index: 1,
    accepted_answers: [],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q1-2',
    order_index: 2,
    question_type: 'mcq',
    question_text: 'Which substitution cipher shifts the alphabet by 3 positions by default?',
    options: [
      'Caesar Cipher',
      'Atbash Cipher',
      'Vigenere Cipher',
      'Playfair Cipher',
    ],
    points: 20,
    correct_option_index: 0,
    accepted_answers: [],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q1-3',
    order_index: 3,
    question_type: 'mcq',
    question_text: 'The Atbash cipher reverses the alphabet (A -> Z, B -> Y). What is the Atbash encryption of "AX"?',
    options: [
      'ZA',
      'BY',
      'ZC',
      'XC',
    ],
    points: 20,
    correct_option_index: 2,
    accepted_answers: [],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q1-4',
    order_index: 4,
    question_type: 'mcq',
    question_text: 'What is the primary security flaw of simple monoalphabetic substitution ciphers?',
    options: [
      'They require 256-bit quantum keys',
      'They preserve natural letter frequency patterns of the plaintext',
      'They can only encrypt numerals 0-9',
      'They require asymmetric public keys',
    ],
    points: 20,
    correct_option_index: 1,
    accepted_answers: [],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q1-5',
    order_index: 5,
    question_type: 'text',
    question_text: 'In classical cryptography, what 3-letter word denotes the secret parameter used to control encryption and decryption algorithms?',
    options: [],
    points: 20,
    correct_option_index: 0,
    accepted_answers: ['KEY', 'THE KEY'],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
];

const defaultR2Questions: QuestionDraft[] = [
  {
    id: 'q2-1',
    order_index: 1,
    question_type: 'mcq',
    question_text: 'Caesar Shift 3: Decrypt the intercepted transmission "FDW" into English plaintext:',
    monospace_code: 'Ciphertext: FDW  |  Algorithm: Caesar Shift (Alphabet Shift = 3)',
    options: [
      'CAT',
      'DOG',
      'FOX',
      'BAT',
    ],
    points: 50,
    correct_option_index: 0,
    accepted_answers: ['CAT', 'C A T'],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q2-2',
    order_index: 2,
    question_type: 'mcq',
    question_text: 'Atbash Cipher: The Hebrew reciprocal cipher reverses the alphabet (A <-> Z, B <-> Y). Decrypt the transmission "GSV":',
    monospace_code: 'Ciphertext: GSV  |  Algorithm: Atbash (Alphabet Reversal: G->T, S->H, V->E)',
    options: [
      'AND',
      'THE',
      'FOR',
      'NOT',
    ],
    points: 50,
    correct_option_index: 1,
    accepted_answers: ['THE', 'T H E'],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
  {
    id: 'q2-3',
    order_index: 3,
    question_type: 'text',
    question_text: 'Binary ASCII Conversion: Convert the two 8-bit binary bytes into their English ASCII plaintext characters:',
    monospace_code: 'Binary: 01001000 01001001  (01001000 = 72, 01001001 = 73 in ASCII)',
    options: [],
    points: 50,
    correct_option_index: 0,
    accepted_answers: ['HI', 'H I'],
    text_settings: { ignore_case: true, ignore_punct_space: true, accept_multiple_answers: true },
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __cryptex_questions_store: Record<string, QuestionDraft[]> | undefined;
}

export function resetQuestionsStore(): void {
  const disk = loadQuestionsFromDisk();
  if (disk && Object.keys(disk).length > 0) {
    globalThis.__cryptex_questions_store = JSON.parse(JSON.stringify(disk));
  } else {
    globalThis.__cryptex_questions_store = {
      r1: [...defaultR1Questions],
      '1': [...defaultR1Questions],
      r2: [...defaultR2Questions],
      '2': [...defaultR2Questions],
    };
  }
}

if (!globalThis.__cryptex_questions_store) {
  resetQuestionsStore();
}

function normalizeKey(roundId: string): string {
  const clean = roundId.toLowerCase().trim();
  if (clean.startsWith('r')) return clean;
  return `r${clean}`;
}

export function getQuestionsForRound(roundId: string): QuestionDraft[] {
  if (!globalThis.__cryptex_questions_store) {
    const disk = loadQuestionsFromDisk();
    if (disk) {
      globalThis.__cryptex_questions_store = disk;
    }
  }
  const store = globalThis.__cryptex_questions_store || {};
  const key = normalizeKey(roundId);
  return store[key] || store[roundId] || [];
}

export async function getQuestionsForRoundAsync(roundId: string): Promise<QuestionDraft[]> {
  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl) {
    try {
      const dbQuestions = await fetchRoundQuestionsFromSupabase(roundId);
      if (dbQuestions && dbQuestions.length > 0) {
        const key = normalizeKey(roundId);
        if (!globalThis.__cryptex_questions_store) {
          globalThis.__cryptex_questions_store = {};
        }
        globalThis.__cryptex_questions_store[key] = dbQuestions;
        globalThis.__cryptex_questions_store[roundId] = dbQuestions;
        persistQuestionsToDisk(globalThis.__cryptex_questions_store);
        return dbQuestions;
      }
    } catch (err) {
      console.error('Error fetching questions async from Supabase:', err);
    }
  }

  return getQuestionsForRound(roundId);
}

export function sanitizeQuestionsForParticipant(questions: QuestionDraft[]): Array<Omit<QuestionDraft, 'correct_option_index' | 'accepted_answers'>> {
  return questions.map((q) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correct_option_index, accepted_answers, ...publicQuestion } = q;
    return publicQuestion;
  });
}

export async function saveQuestionsForRound(
  roundId: string,
  questions: QuestionDraft[]
): Promise<QuestionDraft[]> {
  if (!globalThis.__cryptex_questions_store) {
    globalThis.__cryptex_questions_store = {};
  }

  const key = normalizeKey(roundId);

  // Ensure consistent indexing and unique IDs
  const sanitized = questions.map((q, idx) => ({
    ...q,
    id: q.id || `q_${key}_${idx + 1}_${Date.now()}`,
    order_index: idx + 1,
    points: Number(q.points) || 10,
    correct_option_index: Number(q.correct_option_index) || 0,
    options: Array.isArray(q.options) ? q.options : [],
    accepted_answers: Array.isArray(q.accepted_answers) ? q.accepted_answers : [],
    text_settings: q.text_settings || {
      ignore_case: true,
      ignore_punct_space: true,
      accept_multiple_answers: true,
    },
  }));

  const numericKey = key.replace(/^r/, '');
  globalThis.__cryptex_questions_store[key] = sanitized;
  globalThis.__cryptex_questions_store[roundId] = sanitized;
  globalThis.__cryptex_questions_store[numericKey] = sanitized;

  // Persist immediately to disk so questions survive server restarts and reloads
  persistQuestionsToDisk(globalThis.__cryptex_questions_store);

  // Supabase write-through if active database is configured
  const isMockUrl =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock.supabase.co');

  if (!isMockUrl) {
    try {
      await saveRoundQuestionsToSupabase(roundId, sanitized);
    } catch (err) {
      console.error('Supabase questions save error:', err);
    }
  }

  return sanitized;
}
