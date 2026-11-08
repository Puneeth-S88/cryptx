import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY SERVICE ROLE CLIENT
// NEVER EXPOSE TO CLIENT CODE OR NEXT_PUBLIC_ PREFIX
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

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
