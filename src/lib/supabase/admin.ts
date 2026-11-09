import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY SERVICE ROLE CLIENT
// NEVER EXPOSE TO CLIENT CODE OR NEXT_PUBLIC_ PREFIX
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://mock.supabase.co';

function resolveServiceRoleKey(): string {
  // Support standard and alternate Vercel / Cloud server environment variable names
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    '';

  const clean = key.trim().replace(/^["']|["']$/g, '');

  if (!clean || clean === 'mock-service-role-key') {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.warn(
        '[WARNING]: SUPABASE_SERVICE_ROLE_KEY is not configured in this server environment. ' +
        'Database write operations on RLS-protected tables (like "teams") require this key to bypass RLS.'
      );
    }
    return clean || 'mock-service-role-key';
  }

  return clean;
}

const supabaseServiceRoleKey = resolveServiceRoleKey();

if (typeof window !== 'undefined') {
  throw new Error('SECURITY VIOLATION: supabaseAdmin (Service Role) imported in client bundle!');
}

// Polyfill minimal WebSocket stub on Node < 22 server runtimes where realtime client is not connected
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {} as any;
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, {
        ...options,
        cache: 'no-store',
      }),
  },
});
