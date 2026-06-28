/**
 * Cookie-bound session access (server components & actions).
 *
 * Tokens live in httpOnly cookies. Access tokens are short-lived JWTs whose
 * claims we decode to identify the user without a network round-trip (middleware
 * keeps them fresh). REST calls and JWT decode live in ./gotrue and ./jwt.
 */

import { cookies } from "next/headers";
import { decodeJwtClaims, isExpired } from "./jwt";
import type { SessionUser, TokenSet } from "./gotrue";

export const ACCESS_COOKIE = "sb-access-token";
export const REFRESH_COOKIE = "sb-refresh-token";

export type { SessionUser, TokenSet };

/** Current user from the access-token cookie, or null. No network call. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = decodeJwtClaims(token);
  if (!claims || isExpired(claims)) return null; // middleware refreshes; treat as logged-out here
  return { id: claims.sub, email: claims.email };
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 days; access-token validity governed by its exp
};

export async function setSessionCookies(tokens: TokenSet): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, COOKIE_OPTS);
  jar.set(REFRESH_COOKIE, tokens.refresh_token, COOKIE_OPTS);
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
