import crypto from 'crypto';

/**
 * Cryptographic Answer Normalizer
 * Normalizes user submissions safely (trim, uppercase, remove punctuation/extra whitespace)
 */
export function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalizes answer preserving single words/spaces where appropriate
 */
export function normalizeSentence(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    const dummy = Buffer.alloc(bufA.length);
    crypto.timingSafeEqual(bufA, dummy);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
