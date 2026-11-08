import { createClient } from '@supabase/supabase-js';

// SAFE Client-Side Supabase Client (Only uses anon key, subject to RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

if (!supabaseUrl && typeof window !== 'undefined') {
  console.warn('Supabase URL not provided. Mock or environment variable needed.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
