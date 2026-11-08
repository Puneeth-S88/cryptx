import { normalizeAnswer, normalizeSentence, timingSafeEqualString } from './normalizer';

export interface EvaluationResult {
  score: number;
  maxScore: number;
  breakdown: Record<string, unknown>;
  isFullyCorrect: boolean;
}

// -------------------------------------------------------------
// ROUND 1: The Secret Code (MCQ x 5)
// -------------------------------------------------------------
export function evaluateRound1(
  submission: { answers: Record<string, string> } | null | undefined,
  secretSolutions: { answers: Record<string, string>; points_per_item: number }
): EvaluationResult {
  if (!submission || typeof submission !== 'object' || !submission.answers) {
    return { score: 0, maxScore: 100, breakdown: {}, isFullyCorrect: false };
  }

  const pointsPerItem = secretSolutions?.points_per_item || 20;
  let earned = 0;
  const breakdown: Record<string, boolean> = {};

  for (let i = 1; i <= 5; i++) {
    const key = String(i);
    const submittedVal = normalizeAnswer(submission.answers?.[key] || '');
    const correctVal = normalizeAnswer(secretSolutions?.answers?.[key] || '');

    const isMatch = timingSafeEqualString(submittedVal, correctVal);
    breakdown[key] = isMatch;
    if (isMatch) {
      earned += pointsPerItem;
    }
  }

  return {
    score: earned,
    maxScore: 100,
    breakdown,
    isFullyCorrect: earned === 100,
  };
}

// -------------------------------------------------------------
// ROUND 2: Cipher Breakers (3 Messages: method + answer)
// -------------------------------------------------------------
export function evaluateRound2(
  submission: { items: Array<{ id: number; method: string; plaintext: string }> } | null | undefined,
  secretSolutions: { items: Array<{ id: number; method: string; plaintext: string; points: number }> }
): EvaluationResult {
  if (!submission || typeof submission !== 'object' || !Array.isArray(submission.items)) {
    return { score: 0, maxScore: 150, breakdown: {}, isFullyCorrect: false };
  }

  let earned = 0;
  const breakdown: Record<string, unknown> = {};

  for (const sol of secretSolutions.items) {
    const subItem = submission.items.find((it) => it.id === sol.id);
    const methodMatch =
      normalizeSentence(subItem?.method || '') === normalizeSentence(sol.method);
    const textMatch = timingSafeEqualString(
      normalizeAnswer(subItem?.plaintext || ''),
      normalizeAnswer(sol.plaintext)
    );

    const itemCorrect = methodMatch && textMatch;
    if (itemCorrect) {
      earned += sol.points;
    }

    breakdown[`item_${sol.id}`] = {
      methodCorrect: methodMatch,
      textCorrect: textMatch,
      pointsAwarded: itemCorrect ? sol.points : 0,
    };
  }

  return {
    score: earned,
    maxScore: 150,
    breakdown,
    isFullyCorrect: earned === 150,
  };
}

// -------------------------------------------------------------
// ROUND 3: Code Grid (Polybius click grid: MEET AT GATE)
// -------------------------------------------------------------
export function evaluateRound3(
  submission: { message?: string; plaintext?: string } | null | undefined,
  secretSolution: { normalized_plaintext: string; points: number }
): EvaluationResult {
  const maxPts = secretSolution?.points || 150;
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: maxPts, breakdown: {}, isFullyCorrect: false };
  }

  const submittedNorm = normalizeAnswer(submission.message || submission.plaintext || '');
  const targetNorm = normalizeAnswer(secretSolution?.normalized_plaintext || '');

  const isMatch = timingSafeEqualString(submittedNorm, targetNorm);
  const score = isMatch ? maxPts : 0;

  return {
    score,
    maxScore: maxPts,
    breakdown: { matched: isMatch, submitted: submittedNorm },
    isFullyCorrect: isMatch,
  };
}

// -------------------------------------------------------------
// ROUND 4: Cipher Scramble (5 drag-and-drop letter puzzles)
// -------------------------------------------------------------
export function evaluateRound4(
  submission: { solutions?: Record<string, string>; [key: string]: any } | null | undefined,
  secretSolutions: { solutions: Record<string, string>; points_per_word: number }
): EvaluationResult {
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: 150, breakdown: {}, isFullyCorrect: false };
  }

  const pointsPerWord = secretSolutions?.points_per_word || 30;
  let earned = 0;
  const breakdown: Record<string, boolean> = {};

  const solutions = submission.solutions || submission;

  for (let i = 1; i <= 5; i++) {
    const key = String(i);
    // Support both "1" and "w_1" keys
    const rawVal = solutions?.[key] ?? solutions?.[`w_${key}`] ?? '';
    const sub = normalizeAnswer(rawVal);
    const correct = normalizeAnswer(secretSolutions?.solutions?.[key] || '');

    const isMatch = timingSafeEqualString(sub, correct);
    breakdown[key] = isMatch;
    if (isMatch) {
      earned += pointsPerWord;
    }
  }

  return {
    score: earned,
    maxScore: 150,
    breakdown,
    isFullyCorrect: earned === 150,
  };
}

// -------------------------------------------------------------
// ROUND 5: Memory Cipher (5 words: GATE, UNDER, ACCESS, RESET, DOOR)
// -------------------------------------------------------------
export function evaluateRound5(
  submission: { decodings?: Record<string, string>; [key: string]: any } | null | undefined,
  secretSolutions: { solutions: Record<string, string>; points_per_word: number }
): EvaluationResult {
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: 200, breakdown: {}, isFullyCorrect: false };
  }

  const pointsPerWord = secretSolutions?.points_per_word || 40;
  let earned = 0;
  const breakdown: Record<string, boolean> = {};

  const decodings = submission.decodings || submission;
  const cipherKeys = Object.keys(secretSolutions?.solutions || {});

  for (const cWord of cipherKeys) {
    const sub = normalizeAnswer(decodings?.[cWord] || '');
    const correct = normalizeAnswer(secretSolutions?.solutions?.[cWord] || '');

    const isMatch = timingSafeEqualString(sub, correct);
    breakdown[cWord] = isMatch;
    if (isMatch) {
      earned += pointsPerWord;
    }
  }

  return {
    score: earned,
    maxScore: 200,
    breakdown,
    isFullyCorrect: earned === 200,
  };
}

// -------------------------------------------------------------
// ROUND 6: Cipher Auction (Rail Fence: MEET AT DAWN with Hint Deductions)
// -------------------------------------------------------------
export function evaluateRound6(
  submission: { message?: string; auction_answer?: string; plaintext?: string } | null | undefined,
  secretSolution: { normalized_plaintext: string; base_points: number },
  hintsUsedCount: number = 0
): EvaluationResult {
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: 200, breakdown: {}, isFullyCorrect: false };
  }

  // Support both submission.message and submission.auction_answer
  const rawMsg = submission.message ?? submission.auction_answer ?? submission.plaintext ?? '';
  const submittedNorm = normalizeAnswer(rawMsg);
  const targetNorm = normalizeAnswer(secretSolution?.normalized_plaintext || '');

  const isMatch = timingSafeEqualString(submittedNorm, targetNorm);
  // Hint deduction: 0 hints = 200, 1 hint = 150, 2 hints = 100
  const penalty = Math.min(Math.max(hintsUsedCount, 0), 2) * 50;
  const earned = isMatch ? Math.max((secretSolution?.base_points || 200) - penalty, 0) : 0;

  return {
    score: earned,
    maxScore: 200,
    breakdown: {
      matched: isMatch,
      hintsUsed: hintsUsedCount,
      penalty,
      finalEarned: earned,
    },
    isFullyCorrect: isMatch,
  };
}

// -------------------------------------------------------------
// ROUND 7: Colour Cipher (Bacon: CODE)
// -------------------------------------------------------------
export function evaluateRound7(
  submission: { word?: string; plaintext?: string; colour_answer?: string } | null | undefined,
  secretSolution: { normalized_plaintext: string; points: number }
): EvaluationResult {
  const maxPts = secretSolution?.points || 200;
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: maxPts, breakdown: {}, isFullyCorrect: false };
  }

  const rawWord = submission.word ?? submission.plaintext ?? submission.colour_answer ?? '';
  const sub = normalizeAnswer(rawWord);
  const target = normalizeAnswer(secretSolution?.normalized_plaintext || '');

  const isMatch = timingSafeEqualString(sub, target);
  const score = isMatch ? maxPts : 0;

  return {
    score,
    maxScore: maxPts,
    breakdown: { matched: isMatch },
    isFullyCorrect: isMatch,
  };
}

// -------------------------------------------------------------
// ROUND 8: Master Cryptanalyst (Vigenere: ATTACKATDAWN + Explanation)
// -------------------------------------------------------------
export function evaluateRound8(
  submission: { plaintext?: string; explanation?: string } | null | undefined,
  secretSolution: {
    plaintext: string;
    plaintext_points: number;
    explanation_points: number;
    required_explanation_keywords: string[];
  }
): EvaluationResult {
  if (!submission || typeof submission !== 'object') {
    return { score: 0, maxScore: 300, breakdown: {}, isFullyCorrect: false };
  }

  const subPlaintext = normalizeAnswer(submission.plaintext || '');
  const targetPlaintext = normalizeAnswer(secretSolution?.plaintext || '');
  const plaintextMatch = timingSafeEqualString(subPlaintext, targetPlaintext);

  const plaintextScore = plaintextMatch ? secretSolution?.plaintext_points || 150 : 0;

  // Auto-scoring explanation via keyword coverage
  const explText = (submission.explanation || '').toLowerCase();
  let keywordMatches = 0;
  const foundKeywords: string[] = [];

  for (const kw of secretSolution?.required_explanation_keywords || []) {
    if (explText.includes(kw.toLowerCase())) {
      keywordMatches++;
      foundKeywords.push(kw);
    }
  }

  // At least 3 keywords for full explanation marks, or proportional
  const explRatio = Math.min(keywordMatches / 3, 1.0);
  const explScore = Math.round(explRatio * (secretSolution?.explanation_points || 150));

  const totalScore = plaintextScore + explScore;

  return {
    score: totalScore,
    maxScore: 300,
    breakdown: {
      plaintextMatch,
      plaintextScore,
      keywordMatches,
      foundKeywords,
      explanationScore: explScore,
    },
    isFullyCorrect: totalScore === 300,
  };
}
