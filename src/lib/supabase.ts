/**
 * Supabase Storage client (server-only).
 *
 * Uses SUPABASE_SECRET_KEY (the `sb_secret_…` key) to perform privileged
 * server-side Storage operations, bypassing RLS. Returns null until the key is
 * configured, so callers can degrade gracefully.
 *
 * We use the standalone StorageClient rather than the full `supabase-js`
 * createClient on purpose: the full client initializes Realtime, which requires a
 * global WebSocket that Node < 22 doesn't provide. Storage needs none of that.
 */

import { StorageClient } from "@supabase/storage-js";

export function hasServiceCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

let cached: StorageClient | null = null;

export function getStorageClient(): StorageClient | null {
  if (cached) return cached;
  if (!hasServiceCredentials()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  cached = new StorageClient(`${url}/storage/v1`, {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
  });
  return cached;
}
