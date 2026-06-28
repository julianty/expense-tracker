import { NextResponse, type NextRequest } from "next/server";
import { decodeJwtClaims, isExpired } from "@/lib/jwt";

/**
 * Gate for /groups/**: allow a valid (or refreshable) Supabase session, or a
 * share-link guest (share_token cookie). Otherwise redirect to /login.
 *
 * Edge-safe: no SDK, no Node APIs — just cookie reads + a fetch to GoTrue.
 */

const ACCESS = "sb-access-token";
const REFRESH = "sb-refresh-token";
const SHARE = "share_token";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

export async function middleware(req: NextRequest) {
  const access = req.cookies.get(ACCESS)?.value;
  const claims = access ? decodeJwtClaims(access) : null;
  if (claims && !isExpired(claims)) return NextResponse.next();

  // Access token missing/expired — try a refresh.
  const refresh = req.cookies.get(REFRESH)?.value;
  if (refresh) {
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refresh }),
        },
      );
      if (r.ok) {
        const d = await r.json();
        if (d.access_token) {
          const res = NextResponse.next();
          res.cookies.set(ACCESS, d.access_token, COOKIE_OPTS);
          res.cookies.set(REFRESH, d.refresh_token, COOKIE_OPTS);
          return res;
        }
      }
    } catch {
      /* fall through to gate */
    }
  }

  // Share-link guests may view their group.
  if (req.cookies.get(SHARE)?.value) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/groups", "/groups/:path*"],
};
