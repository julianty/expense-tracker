/**
 * Supabase GoTrue REST calls (no cookies, no next/headers — so it's unit-testable
 * by mocking fetch). Cookie-bound session access lives in ./session.
 *
 * We use REST rather than supabase-js because that SDK constructs a Realtime
 * client requiring a global WebSocket Node < 22 lacks (throws at construction).
 */

const URL_BASE = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = () => process.env.SUPABASE_SECRET_KEY!;

export interface SessionUser {
  id: string;
  email: string;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
}

export interface AuthResult {
  ok: boolean;
  tokens?: TokenSet;
  user?: SessionUser;
  error?: string;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${URL_BASE()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON(), "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return { ok: false, error: data.error_description || data.msg || "Invalid email or password" };
  }
  return {
    ok: true,
    tokens: { access_token: data.access_token, refresh_token: data.refresh_token },
    user: { id: data.user.id, email: data.user.email },
  };
}

/**
 * Create a confirmed account with the service key (skips email verification),
 * then sign in. Keeps onboarding to a single step for this app.
 */
export async function signUpConfirmed(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${URL_BASE()}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SECRET(), Authorization: `Bearer ${SECRET()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    const msg = data.msg || data.error_description || "Could not create account";
    return { ok: false, error: /registered|exists/i.test(msg) ? "That email is already registered" : msg };
  }
  return signInWithPassword(email, password);
}

export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const res = await fetch(`${URL_BASE()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON(), "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) return { ok: false, error: "Session expired" };
  return {
    ok: true,
    tokens: { access_token: data.access_token, refresh_token: data.refresh_token },
    user: { id: data.user.id, email: data.user.email },
  };
}

export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${URL_BASE()}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: ANON(), Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    /* best effort */
  }
}
