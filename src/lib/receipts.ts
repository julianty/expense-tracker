/**
 * Pure helpers for receipt uploads — no Supabase/network, so they're unit-testable.
 * The actual upload/signing lives in `./storage` (server-only).
 */

export const RECEIPTS_BUCKET = "receipts";

/** Keep well under the free-tier 50 MB ceiling; receipts are photos. */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export interface ReceiptCheck {
  ok: boolean;
  reason?: string;
}

/** Validate a file's MIME type and size before uploading. */
export function isAllowedReceipt(type: string, size: number): ReceiptCheck {
  if (size <= 0) return { ok: false, reason: "Empty file" };
  if (size > MAX_RECEIPT_BYTES) {
    return { ok: false, reason: `File too large (max ${MAX_RECEIPT_BYTES / (1024 * 1024)} MB)` };
  }
  if (!(ALLOWED_RECEIPT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: "Only image files are allowed" };
  }
  return { ok: true };
}

/** Pick a safe lowercase extension from the filename, falling back to the MIME type. */
export function extensionFor(filename: string, type: string): string {
  const fromName = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (fromName && Object.values(MIME_EXT).includes(fromName)) return fromName;
  if (fromName === "jpeg") return "jpg";
  return MIME_EXT[type] ?? "bin";
}

/** Short random id for object keys (avoids guessable/collision-prone names). */
function randomKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Storage object path for a receipt: `{groupId}/{random}.{ext}`.
 * Grouping by groupId keeps a group's receipts together for easy policy/cleanup.
 */
export function receiptObjectPath(groupId: string, filename: string, type: string): string {
  return `${groupId}/${randomKey()}.${extensionFor(filename, type)}`;
}
