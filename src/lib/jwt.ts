/**
 * Minimal JWT payload decode (no signature verification — Supabase signs the
 * tokens; we only read claims from tokens we set ourselves). Runtime-agnostic
 * (works in Node and the edge middleware): uses global atob.
 */

export interface JwtClaims {
  sub: string;
  email: string;
  exp: number; // seconds since epoch
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "="; // restore padding for atob
    const json = atob(b64);
    const c = JSON.parse(json) as { sub?: string; email?: string; exp?: number };
    if (!c.sub || typeof c.exp !== "number") return null;
    return { sub: c.sub, email: c.email ?? "", exp: c.exp };
  } catch {
    return null;
  }
}

/** True if the token's exp is in the past (optionally relative to a given time). */
export function isExpired(claims: { exp: number }, nowMs: number = Date.now()): boolean {
  return claims.exp * 1000 <= nowMs;
}
