/**
 * Server-action auth gate.
 *
 * Architecture rule: ALL writes go through Next.js server actions.
 * Each action validates EITHER:
 *   1. A real Supabase session (email+password login), OR
 *   2. A group share-token (/g/{token} link)
 *
 * On success, resolves to an AuthContext with the acting GroupMember.
 * On failure, throws an AuthError (action returns early).
 *
 * Usage:
 *   export async function createExpenseAction(groupId: string, ...) {
 *     const ctx = await requireAuth({ groupId });
 *     // ctx.member is the acting GroupMember slot
 *   }
 */

"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  /** The GroupMember slot that is acting (may be unclaimed) */
  memberId: string;
  memberDisplayName: string;
  groupId: string;
  /** True if the actor is identified via a share-link (not a real account) */
  isShareLinkActor: boolean;
  /** Supabase user id (null for share-link actors) */
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

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

interface RequireAuthOptions {
  /** The group this action operates on */
  groupId: string;
  /**
   * Optional: if provided, verify the acting member is in this group.
   * If not provided, the session user's first member slot in the group is used.
   */
  memberId?: string;
}

/**
 * Resolve the acting member for a server action.
 * Call at the top of every mutating server action.
 *
 * @throws AuthError if authentication or authorization fails.
 */
export async function requireAuth(opts: RequireAuthOptions): Promise<AuthContext> {
  const { groupId } = opts;

  // -- 1. Check Supabase session -----------------------------------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return resolveSessionActor({ groupId, userId: user.id, memberId: opts.memberId });
  }

  // -- 2. Fall back to share-token ----------------------------------------
  const shareToken = cookieStore.get("share_token")?.value;
  if (shareToken) {
    return resolveShareTokenActor({ groupId, shareToken, memberId: opts.memberId });
  }

  throw new AuthError("Not authenticated — please sign in or use a share link.", "UNAUTHENTICATED");
}

// ---------------------------------------------------------------------------
// Internal resolvers
// ---------------------------------------------------------------------------

async function resolveSessionActor(opts: {
  groupId: string;
  userId: string;
  memberId?: string;
}): Promise<AuthContext> {
  const { groupId, userId, memberId } = opts;

  // Verify group exists
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AuthError(`Group ${groupId} not found`, "GROUP_NOT_FOUND");

  // Resolve the acting member slot
  const member = memberId
    ? await prisma.groupMember.findFirst({
        where: { id: memberId, groupId, claimedByUserId: userId },
      })
    : await prisma.groupMember.findFirst({
        where: { groupId, claimedByUserId: userId },
        orderBy: { createdAt: "asc" },
      });

  if (!member) {
    throw new AuthError(
      `User ${userId} has no claimed member slot in group ${groupId}`,
      "UNAUTHORIZED",
    );
  }

  return {
    memberId: member.id,
    memberDisplayName: member.displayName,
    groupId,
    isShareLinkActor: false,
    userId,
  };
}

async function resolveShareTokenActor(opts: {
  groupId: string;
  shareToken: string;
  memberId?: string;
}): Promise<AuthContext> {
  const { groupId, shareToken, memberId } = opts;

  // Validate the share token belongs to this group
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AuthError(`Group ${groupId} not found`, "GROUP_NOT_FOUND");
  if (group.shareToken !== shareToken) {
    throw new AuthError("Invalid share token for this group", "UNAUTHORIZED");
  }

  // A share-link actor must explicitly provide a memberId (set when they claim a slot)
  if (!memberId) {
    throw new AuthError(
      "Share-link actors must have a claimed member slot. " +
      "Visit /g/{token}/claim to claim a slot first.",
      "UNAUTHORIZED",
    );
  }

  const member = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId },
  });
  if (!member) {
    throw new AuthError(`Member ${memberId} not found in group ${groupId}`, "MEMBER_NOT_FOUND");
  }

  return {
    memberId: member.id,
    memberDisplayName: member.displayName,
    groupId,
    isShareLinkActor: true,
    userId: member.claimedByUserId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Audit log helper — call inside every mutating action
// ---------------------------------------------------------------------------

export async function writeAuditLog(opts: {
  groupId: string;
  actorMemberId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeJson?: object;
  afterJson?: object;
}) {
  await prisma.auditLog.create({
    data: {
      groupId: opts.groupId,
      actorMemberId: opts.actorMemberId,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      beforeJson: opts.beforeJson ?? undefined,
      afterJson: opts.afterJson ?? undefined,
    },
  });
}
