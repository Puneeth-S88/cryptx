import crypto from 'crypto';

export interface ActiveSession {
  sessionId: string;
  accountId: string;
  accountName: string;
  role: 'participant' | 'organizer';
  teamId?: string;
  email?: string;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: number;
  lastActiveAt: number;
}

// Global active sessions map (preserved across hot-reloads)
declare global {
  // eslint-disable-next-line no-var
  var __cryptex_active_sessions: Map<string, ActiveSession> | undefined;
}

if (!globalThis.__cryptex_active_sessions) {
  globalThis.__cryptex_active_sessions = new Map<string, ActiveSession>();
}

const activeSessions = globalThis.__cryptex_active_sessions;

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Safe session secret resolution in Node.js server runtime.
 * Throws in production if neither NEXTAUTH_SECRET nor SESSION_SECRET is set.
 */
export function getSessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL SECURITY CONFIGURATION ERROR: NEXTAUTH_SECRET or SESSION_SECRET environment variable is missing in production.'
      );
    }
    return 'cryptex-development-fallback-secret-2026';
  }
  return secret;
}

export interface SessionTokenPayload {
  accountId: string;
  sessionId: string;
  role: 'participant' | 'organizer';
  teamId?: string;
  name: string;
  createdAt: number;
}

/**
 * Authoritative session token signing function.
 * Generates an HMAC-SHA256 URL-safe signed token (${base64UrlPayload}.${base64UrlSignature}).
 */
export function createSessionToken(payload: SessionTokenPayload, secret?: string): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString('base64url');
  const currentSecret = secret ?? getSessionSecret();
  const signature = crypto
    .createHmac('sha256', currentSecret)
    .update(base64)
    .digest('base64url');
  return `${base64}.${signature}`;
}

function signPayload(payload: SessionTokenPayload): string {
  return createSessionToken(payload);
}

export function parseAndVerifyToken(token: string, secret?: string): SessionTokenPayload | null {
  try {
    const [base64, sig] = token.split('.');
    if (!base64 || !sig) return null;

    const currentSecret = secret ?? getSessionSecret();
    const expectedSig = crypto
      .createHmac('sha256', currentSecret)
      .update(base64)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const json = Buffer.from(base64, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as SessionTokenPayload;
    const now = Date.now();
    if (now - payload.createdAt > SESSION_MAX_AGE_MS || payload.createdAt > now + 900_000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Edge-compatible session token verification using Web Crypto API (crypto.subtle).
 * Zero Node.js Buffer dependency, UTF-8 safe, constant-time verification.
 */
export async function verifySessionTokenEdge(
  token: string | undefined | null,
  secret?: string
): Promise<{ valid: boolean; payload?: SessionTokenPayload }> {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [base64UrlPayload, base64UrlSignature] = parts;
    if (!base64UrlPayload || !base64UrlSignature) return { valid: false };

    let resolvedSecret: string;
    try {
      resolvedSecret = secret ?? getSessionSecret();
    } catch {
      return { valid: false };
    }
    if (!resolvedSecret) return { valid: false };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(resolvedSecret);
    const subtleCrypto = globalThis.crypto?.subtle || (crypto as any).webcrypto?.subtle;
    const key = await subtleCrypto.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const base64Sig = base64UrlSignature.replace(/-/g, '+').replace(/_/g, '/');
    const paddedSig = base64Sig.padEnd(base64Sig.length + ((4 - (base64Sig.length % 4)) % 4), '=');
    const binarySig = atob(paddedSig);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const payloadBytes = encoder.encode(base64UrlPayload);
    const isValid = await subtleCrypto.verify('HMAC', key, sigBytes, payloadBytes);
    if (!isValid) return { valid: false };

    const base64Data = base64UrlPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedData = base64Data.padEnd(base64Data.length + ((4 - (base64Data.length % 4)) % 4), '=');
    const binaryData = atob(paddedData);
    const dataBytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      dataBytes[i] = binaryData.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(dataBytes);
    const payload = JSON.parse(jsonStr) as SessionTokenPayload;

    if (typeof payload.createdAt === 'number') {
      const now = Date.now();
      if (now - payload.createdAt > SESSION_MAX_AGE_MS || payload.createdAt > now + 900_000) {
        return { valid: false };
      }
    }

    if (!payload.accountId || !payload.role) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * Creates an authoritative session for an account.
 * Automatically invalidates and supersedes any prior active session on other devices.
 */
export function createSession(
  account: {
    id: string;
    name: string;
    role: 'participant' | 'organizer';
    teamId?: string;
    email?: string;
  },
  reqDetails?: { ipAddress?: string; deviceInfo?: string }
): { token: string; session: ActiveSession } {
  // Unique random identifier for this specific device connection
  const sessionId = `dev_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;

  const session: ActiveSession = {
    sessionId,
    accountId: account.id,
    accountName: account.name,
    role: account.role,
    teamId: account.teamId || account.id,
    email: account.email,
    deviceInfo: reqDetails?.deviceInfo || 'Unknown Device',
    ipAddress: reqDetails?.ipAddress || '127.0.0.1',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  // Enforce single active device: overwriting here means any prior device session will now fail validation
  activeSessions.set(account.id, session);

  const tokenPayload: SessionTokenPayload = {
    accountId: account.id,
    sessionId,
    role: account.role,
    teamId: session.teamId,
    name: account.name,
    createdAt: session.createdAt,
  };

  const token = signPayload(tokenPayload);
  return { token, session };
}

export interface SessionValidationResult {
  valid: boolean;
  superseded?: boolean;
  session?: ActiveSession;
  error?: string;
}

/**
 * Validates a session token against the active session registry.
 * If another device logged into this account, superseded will be TRUE.
 */
export function validateSession(token: string): SessionValidationResult {
  const payload = parseAndVerifyToken(token);
  if (!payload) {
    return {
      valid: false,
      error: 'Invalid or expired session token.',
    };
  }

  // Organizers are completely exempt from single-device restrictions
  if (payload.role === 'organizer') {
    const orgSession: ActiveSession = {
      sessionId: payload.sessionId,
      accountId: payload.accountId,
      accountName: payload.name,
      role: 'organizer',
      teamId: payload.teamId,
      createdAt: payload.createdAt,
      lastActiveAt: Date.now(),
    };
    activeSessions.set(payload.accountId, orgSession);
    return { valid: true, session: orgSession };
  }

  const current = activeSessions.get(payload.accountId);

  if (!current) {
    const hydratedSession: ActiveSession = {
      sessionId: payload.sessionId,
      accountId: payload.accountId,
      accountName: payload.name,
      role: payload.role,
      teamId: payload.teamId,
      createdAt: payload.createdAt,
      lastActiveAt: Date.now(),
    };
    activeSessions.set(payload.accountId, hydratedSession);
    return { valid: true, session: hydratedSession };
  }

  // SINGLE-DEVICE CHECK FOR PARTICIPANTS:
  if (current.sessionId !== payload.sessionId) {
    // If incoming token was created at or after current stored session,
    // this is a newer authoritative login on another/same device.
    if (payload.createdAt >= current.createdAt) {
      const updatedSession: ActiveSession = {
        sessionId: payload.sessionId,
        accountId: payload.accountId,
        accountName: payload.name,
        role: payload.role,
        teamId: payload.teamId,
        createdAt: payload.createdAt,
        lastActiveAt: Date.now(),
      };
      activeSessions.set(payload.accountId, updatedSession);
      return { valid: true, session: updatedSession };
    }

    // Incoming token is strictly older than current in-memory session -> superseded
    return {
      valid: false,
      superseded: true,
      error: 'Another device has logged into this account. For competition integrity, only one active device is allowed. You have been logged out.',
    };
  }

  current.lastActiveAt = Date.now();
  return {
    valid: true,
    session: current,
  };
}

export function terminateSession(accountId: string): void {
  activeSessions.delete(accountId);
}

export function getActiveSession(accountId: string): ActiveSession | undefined {
  return activeSessions.get(accountId);
}
