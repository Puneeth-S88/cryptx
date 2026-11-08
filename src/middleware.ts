import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface EdgeSessionPayload {
  accountId: string;
  sessionId?: string;
  role: 'participant' | 'organizer';
  name?: string;
  teamId?: string;
  createdAt: number;
  [key: string]: any;
}

export interface EdgeVerificationResult {
  valid: boolean;
  payload?: EdgeSessionPayload;
}

/**
 * Safe session secret resolution in Edge runtime.
 * Fails closed in production if neither NEXTAUTH_SECRET nor SESSION_SECRET is set.
 */
export function getEdgeSessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL SECURITY ERROR: NEXTAUTH_SECRET or SESSION_SECRET is not set in production Edge environment.');
      return '';
    }
    return 'cryptex-development-fallback-secret-2026';
  }
  return secret;
}

/**
 * Edge-compatible HMAC-SHA256 session token verification using Web Crypto API (crypto.subtle).
 * Constant-time native verification, UTF-8 payload parsing, zero Node.js dependencies.
 */
export async function verifySessionTokenEdge(
  token: string | undefined | null,
  secret?: string
): Promise<EdgeVerificationResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [base64UrlPayload, base64UrlSignature] = parts;
    if (!base64UrlPayload || !base64UrlSignature) return { valid: false };

    const resolvedSecret = secret ?? getEdgeSessionSecret();
    if (!resolvedSecret) return { valid: false };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(resolvedSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Convert base64url signature to binary Uint8Array for native verification
    const base64Sig = base64UrlSignature.replace(/-/g, '+').replace(/_/g, '/');
    const paddedSig = base64Sig.padEnd(base64Sig.length + ((4 - (base64Sig.length % 4)) % 4), '=');
    const binarySig = atob(paddedSig);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const payloadBytes = encoder.encode(base64UrlPayload);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
    if (!isValid) return { valid: false };

    // Safe UTF-8 decoding of base64url payload
    const base64Data = base64UrlPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedData = base64Data.padEnd(base64Data.length + ((4 - (base64Data.length % 4)) % 4), '=');
    const binaryData = atob(paddedData);
    const dataBytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      dataBytes[i] = binaryData.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(dataBytes);
    const payload = JSON.parse(jsonStr) as EdgeSessionPayload;

    if (typeof payload.createdAt === 'number') {
      const now = Date.now();
      if (now - payload.createdAt > SESSION_MAX_AGE_MS || payload.createdAt > now + 60_000) {
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Strict Content-Security-Policy (CSP)
  const nonce = btoa(crypto.randomUUID());
  
  // Projector /display is allowed minimal framing if explicitly configured, all others frame-ancestors 'none'
  const frameAncestors = pathname.startsWith('/display') ? "'self'" : "'none'";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com;
    frame-src 'self' https://challenges.cloudflare.com;
    frame-ancestors ${frameAncestors};
    form-action 'self';
    base-uri 'self';
    object-src 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  // 2. Strict Organizer UI Page Protection
  if (pathname.startsWith('/organizer') && !pathname.startsWith('/organizer/login')) {
    const sessionToken =
      request.cookies.get('cryptex_session')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { valid, payload: sessionPayload } = await verifySessionTokenEdge(sessionToken);

    // If no session token or payload is missing, redirect to login
    if (!valid || !sessionPayload) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Participants are strictly isolated from organizer tools
    if (sessionPayload.role === 'participant') {
      const playUrl = new URL('/play', request.url);
      return NextResponse.redirect(playUrl);
    }

    // Non-organizer roles denied
    if (sessionPayload.role !== 'organizer') {
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Strict Organizer API Protection
  if (pathname.startsWith('/api/organizer')) {
    // Walk-in signup calls POST /api/organizer/teams to register a team; allow this
    const isSignupRegistration = pathname === '/api/organizer/teams' && request.method === 'POST';

    if (!isSignupRegistration) {
      const sessionToken =
        request.cookies.get('cryptex_session')?.value ||
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Unauthorized: Session required for administrative endpoints.' },
          { status: 401 }
        );
      }

      const { valid, payload: sessionPayload } = await verifySessionTokenEdge(sessionToken);

      if (!valid || !sessionPayload) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or expired session token.' },
          { status: 401 }
        );
      }

      if (sessionPayload.role !== 'organizer') {
        return NextResponse.json(
          { error: 'Forbidden: Organizer privilege required to access admin APIs.' },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
