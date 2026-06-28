/**
 * Receipt storage (server-only) — upload to and sign URLs from the Supabase
 * `receipts` bucket. Every function no-ops to null when the service key isn't
 * configured (or the bucket doesn't exist yet), so the app works without them.
 */

import { getServiceClient } from "./supabase";
import {
  RECEIPTS_BUCKET,
  isAllowedReceipt,
  receiptObjectPath,
} from "./receipts";

/**
 * Upload a receipt image. Returns the stored object path (to save as the
 * expense's imageUrl), or null if skipped (no key, invalid file, or error).
 */
export async function uploadReceipt(file: File, groupId: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;

  const check = isAllowedReceipt(file.type, file.size);
  if (!check.ok) return null;

  const path = receiptObjectPath(groupId, file.name, file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from(RECEIPTS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error("Receipt upload failed:", error.message);
    return null;
  }
  return path;
}

/** Time-limited signed URL for a stored receipt (private bucket). Null if unavailable. */
export async function getSignedReceiptUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;

  const { data, error } = await client.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Receipt signing failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
