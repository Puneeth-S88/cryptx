import { describe, it, expect } from 'vitest';
import {
  evaluateRound1,
  evaluateRound2,
  evaluateRound3,
  evaluateRound4,
  evaluateRound5,
  evaluateRound6,
  evaluateRound7,
  evaluateRound8,
} from '../../src/lib/crypto/evaluators';

describe('CRYPTEX 2026 Cipher Evaluators (R1 - R8)', () => {
  // R1 The Secret Code (MCQ x 5)
  it('evaluates Round 1 with exact answers (Q1:B, Q2:A, Q3:C, Q4:B, Q5:KEY)', () => {
    const secret = {
      answers: { '1': 'B', '2': 'A', '3': 'C', '4': 'B', '5': 'KEY' },
      points_per_item: 20,
    };

    const res = evaluateRound1(
      { answers: { '1': 'B', '2': 'A', '3': 'c', '4': 'b', '5': ' key ' } },
      secret
    );
    expect(res.score).toBe(100);
    expect(res.isFullyCorrect).toBe(true);

    const partial = evaluateRound1(
      { answers: { '1': 'B', '2': 'D', '3': 'C', '4': 'B', '5': 'WRONG' } },
      secret
    );
    expect(partial.score).toBe(60);
    expect(partial.isFullyCorrect).toBe(false);
  });

  // R2 Cipher Breakers (FDW -> CAT, GSV -> THE, Binary -> HI)
  it('evaluates Round 2 multi-cipher breaker', () => {
    const secret = {
      items: [
        { id: 1, method: 'Caesar Shift 3', plaintext: 'CAT', points: 50 },
        { id: 2, method: 'Atbash Cipher', plaintext: 'THE', points: 50 },
        { id: 3, method: 'Binary (ASCII)', plaintext: 'HI', points: 50 },
      ],
    };

    const res = evaluateRound2(
      {
        items: [
          { id: 1, method: 'Caesar Shift 3', plaintext: 'cat' },
          { id: 2, method: 'Atbash Cipher', plaintext: 'THE' },
          { id: 3, method: 'Binary (ASCII)', plaintext: 'hi' },
        ],
      },
      secret
    );
    expect(res.score).toBe(150);
    expect(res.isFullyCorrect).toBe(true);
  });

  // R3 Code Grid (Polybius 32-15-15-44 / 11-44 / 22-11-44-15 -> MEET AT GATE)
  it('evaluates Round 3 Polybius Grid', () => {
    const secret = { normalized_plaintext: 'MEETATGATE', points: 150 };
    const res = evaluateRound3({ message: 'MEET AT GATE' }, secret);
    expect(res.score).toBe(150);
    expect(res.isFullyCorrect).toBe(true);
  });

  // R4 Cipher Scramble (VIGENERE, ALPHABET, PUZZLE, LEVEL, TEXT)
  it('evaluates Round 4 letter scramble', () => {
    const secret = {
      solutions: {
        '1': 'VIGENERE',
        '2': 'ALPHABET',
        '3': 'PUZZLE',
        '4': 'LEVEL',
        '5': 'TEXT',
      },
      points_per_word: 30,
    };

    const res = evaluateRound4(
      {
        solutions: {
          '1': 'vigenere',
          '2': 'alphabet',
          '3': 'puzzle',
          '4': 'level',
          '5': 'text',
        },
      },
      secret
    );
    expect(res.score).toBe(150);
    expect(res.isFullyCorrect).toBe(true);
  });

  // R5 Memory Cipher (GATE, UNDER, ACCESS, RESET, DOOR)
  it('evaluates Round 5 memory cipher decoding', () => {
    const secret = {
      solutions: {
        UQZT: 'GATE',
        XFRTK: 'UNDER',
        QEETLL: 'ACCESS',
        KTLTZ: 'RESET',
        RGGK: 'DOOR',
      },
      points_per_word: 40,
    };

    const res = evaluateRound5(
      {
        decodings: {
          UQZT: 'GATE',
          XFRTK: 'under',
          QEETLL: 'access',
          KTLTZ: 'reset',
          RGGK: 'door',
        },
      },
      secret
    );
    expect(res.score).toBe(200);
    expect(res.isFullyCorrect).toBe(true);
  });

  // R6 Cipher Auction (MEET AT DAWN with 0, 1, or 2 hints)
  it('evaluates Round 6 Rail Fence with auction hints', () => {
    const secret = { normalized_plaintext: 'MEETATDAWN', base_points: 200 };

    const zeroHints = evaluateRound6({ message: 'MEET AT DAWN' }, secret, 0);
    expect(zeroHints.score).toBe(200);

    const oneHint = evaluateRound6({ message: 'MEET AT DAWN' }, secret, 1);
    expect(oneHint.score).toBe(150);

    const twoHints = evaluateRound6({ message: 'MEET AT DAWN' }, secret, 2);
    expect(twoHints.score).toBe(100);
  });

  // R7 Colour Cipher (Bacon Blue/Orange tiles -> CODE)
  it('evaluates Round 7 Colour Cipher Bacon decoding', () => {
    const secret = { normalized_plaintext: 'CODE', points: 200 };
    const res = evaluateRound7({ word: 'code' }, secret);
    expect(res.score).toBe(200);
  });

  // R8 Master Cryptanalyst (ATTACKATDAWN + technical explanation)
  it('evaluates Round 8 Vigenere and keyword explanation', () => {
    const secret = {
      plaintext: 'ATTACKATDAWN',
      plaintext_points: 150,
      explanation_points: 150,
      required_explanation_keywords: ['vigenere', 'lemon', 'repeat', 'shift', 'modular', 'polyalphabetic'],
    };

    const res = evaluateRound8(
      {
        plaintext: 'ATTACKATDAWN',
        explanation: 'We applied the Vigenere cipher using the repeating key LEMON to shift each character modularly.',
      },
      secret
    );
    expect(res.score).toBe(300);
    expect(res.isFullyCorrect).toBe(true);
  });
});
