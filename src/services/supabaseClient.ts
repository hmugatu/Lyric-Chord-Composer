/**
 * Shared Supabase client.
 *
 * The URL + anon key come from build-time Vite env vars (`import.meta.env`).
 * The anon key is safe to ship in the client bundle — per-user isolation is
 * enforced by Row-Level Security, not by keeping this key secret.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev/build rather than producing confusing auth errors later.
  throw new Error(
    'Missing Supabase config: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      '(see .env.example).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Completes the magic-link redirect by reading the session from the URL.
    detectSessionInUrl: true,
  },
});
