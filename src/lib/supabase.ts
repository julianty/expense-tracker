/**
 * Supabase service client (server-only).
 *
 * Uses SUPABASE_SECRET_KEY (the `sb_secret_…` key) to perform privileged
 * server-side operations like Storage uploads, bypassing RLS. Returns null until
 * the key is configured, so callers can degrade gracefully.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function hasServiceCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (cached) return cached;
  if (!hasServiceCredentials()) return null;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
