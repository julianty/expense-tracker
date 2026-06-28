/**
 * Server-action auth gate.
 *
 * Every mutating server action resolves the acting GroupMember via EITHER:
 *   1. a real Supabase session (REST/JWT — see ./session), OR
 *   2. a group share-token cookie (+ the claimed member_id cookie).
 *
 * On success → AuthContext with the acting member. On failure → AuthError.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export interface AuthContext {
  memberId: string;
  memberDisplayName: string;
  groupId: string;
  isShareLinkActor: boolean;
  userId: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "GROUP_NOT_FOUND"
      | "MEMBER_NOT_FOUND" = "UNAUTHENTICATED",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface RequireAuthOptions {
  groupId: string;
  /** Optional explicit member slot; otherwise resolved from the session/token. */
  memberId?: string;
}

/** Resolve the acting member for a mutating action. Throws AuthError on failure. */
export async function requireAuth(opts: RequireAuthOptions): Promise<AuthContext> {
  const { groupId } = opts;

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, shareToken: true } });
  if (!group) throw new AuthError(`Group ${groupId} not found`, "GROUP_NOT_FOUND");

  // 1. Real session
  const user = await getSessionUser();
  if (user) {
    const member = opts.memberId
      ? await prisma.groupMember.findFirst({ where: { id: opts.memberId, groupId, claimedByUserId: user.id } })
      : await prisma.groupMember.findFirst({ where: { groupId, claimedByUserId: user.id }, orderBy: { createdAt: "asc" } });
    if (!member) {
      throw new AuthError("You're not a member of this group.", "UNAUTHORIZED");
    }
    return {
      memberId: member.id,
      memberDisplayName: member.displayName,
      groupId,
      isShareLinkActor: false,
      userId: user.id,
    };
  }

  // 2. Share-token actor
  const jar = await cookies();
  const shareToken = jar.get("share_token")?.value;
  const memberId = opts.memberId ?? jar.get("member_id")?.value;
  if (shareToken && shareToken === group.shareToken && memberId) {
    const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId } });
    if (!member) throw new AuthError("Member slot not found in this group.", "MEMBER_NOT_FOUND");
    return {
      memberId: member.id,
      memberDisplayName: member.displayName,
      groupId,
      isShareLinkActor: true,
      userId: member.claimedByUserId ?? null,
    };
  }

  throw new AuthError("Sign in or open this group's share link to continue.", "UNAUTHENTICATED");
}

/**
 * Non-throwing variant for read/render: returns the acting member's id, or "".
 * Used by pages to decide "you"/permission affordances without erroring.
 */
export async function getActingMemberId(groupId: string): Promise<string> {
  const user = await getSessionUser();
  if (user) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, claimedByUserId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return member?.id ?? "";
  }

  const jar = await cookies();
  const shareToken = jar.get("share_token")?.value;
  const memberId = jar.get("member_id")?.value;
  if (shareToken && memberId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { shareToken: true } });
    if (group?.shareToken === shareToken) {
      const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId }, select: { id: true } });
      return member?.id ?? "";
    }
  }
  return "";
}
