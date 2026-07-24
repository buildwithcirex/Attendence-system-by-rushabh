import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Used for backend operations (verifying OTPs, inserting sessions, etc)
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are missing');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Anon-key client used only for GoTrue auth flows (magic-link send/verify).
// No session persistence: we mint our own JWT after verifying the identity.
export function getSupabaseAuth() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth environment variables are missing');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
