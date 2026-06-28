"use server";

/**
 * Authentication server actions (sign in / sign up / sign out) over the GoTrue
 * REST API. On success we mirror the user into our Prisma `User` table (the FK
 * target for GroupMember.claimedByUserId / Group.createdByUserId) and set the
 * session cookies.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACCESS_COOKIE, clearSessionCookies, setSessionCookies } from "@/lib/session";
import { revokeToken, signInWithPassword, signUpConfirmed } from "@/lib/gotrue";

const loginError = (msg: string) => `/login?error=${encodeURIComponent(msg)}`;

async function syncUser(user: { id: string; email: string }) {
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email },
    update: { email: user.email },
  });
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect(loginError("Enter your email and password"));

  const result = await signInWithPassword(email, password);
  if (!result.ok || !result.tokens || !result.user) redirect(loginError(result.error ?? "Sign in failed"));

  await syncUser(result.user);
  await setSessionCookies(result.tokens);
  redirect("/groups");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 6) redirect(loginError("Password must be at least 6 characters"));

  const result = await signUpConfirmed(email, password);
  if (!result.ok || !result.tokens || !result.user) redirect(loginError(result.error ?? "Sign up failed"));

  await syncUser(result.user);
  await setSessionCookies(result.tokens);
  redirect("/groups");
}

export async function signOutAction() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (token) await revokeToken(token);
  await clearSessionCookies();
  redirect("/login");
}
