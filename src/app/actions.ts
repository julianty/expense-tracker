"use server";

/**
 * Server actions — the single write surface for the app.
 *
 * Each mutating action resolves the acting member through `requireAuth` (valid
 * Supabase session OR group share-token) and writes through Prisma. Admin-only
 * actions additionally check `isAdmin`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  addExpense,
  addExpenseBatch,
  addMember,
  canRevertExpense,
  canSettle,
  ClaimError,
  claimSlot,
  createGroup,
  deleteGroup,
  getGroup,
  getMembers,
  isAdmin,
  recordSettlement,
  regenerateShareToken,
  renameMember,
  revertExpense,
  unclaimMember,
  updateExpense,
  updateGroup,
  type SplitMode,
} from "@/lib/store";
import { requireAuth } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { rateToBase } from "@/lib/fx";
import { resolveParticipants, toCents } from "@/lib/splits";
import { uploadReceipt } from "@/lib/storage";

/**
 * Append a toast message the <Toaster> picks up after the redirect. The `ft`
 * nonce makes consecutive identical messages distinct so each one still shows.
 */
const withFlash = (path: string, msg: string) =>
  `${path}?flash=${encodeURIComponent(msg)}&ft=${Date.now()}`;

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function saveExpenseAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const editingId = formData.get("expenseId") ? String(formData.get("expenseId")) : undefined;
  const group = await getGroup(groupId);
  if (!group) redirect("/groups");

  const description = String(formData.get("description") || "").trim() || "Untitled";
  const amount = Number(formData.get("amount") || 0);
  const currency = String(formData.get("currency") || group.baseCurrency);
  const fxRate = Number(formData.get("fxRate")) || rateToBase(currency, group.baseCurrency);
  const payerMemberId = String(formData.get("payerMemberId"));
  const mode = (String(formData.get("splitMode") || "equal") as SplitMode);
  const note = String(formData.get("note") || "").trim() || undefined;
  const dateISO = String(formData.get("date") || new Date().toISOString().slice(0, 10));

  const members = await getMembers(groupId);
  const memberIds = members.map((m) => m.id);
  const rawValues = memberIds.map((id) => Number(formData.get(`split-${id}`) || 0));

  // Convert the entered amount into base-currency cents before splitting.
  const totalBaseCents = Math.round(toCents(amount) * fxRate);
  const participants = resolveParticipants(totalBaseCents, memberIds, mode, rawValues, payerMemberId);

  // Upload a receipt if one was attached (no-ops to undefined without a key/bucket).
  const receipt = formData.get("receipt");
  let imageUrl: string | undefined;
  if (receipt instanceof File && receipt.size > 0) {
    imageUrl = (await uploadReceipt(receipt, groupId)) ?? undefined;
  }

  const actorMemberId = (await requireAuth({ groupId })).memberId;
  const payload = {
    groupId,
    description,
    note,
    dateISO,
    currency,
    fxRate,
    payerMemberId,
    participants,
    splitMode: mode,
    imageUrl,
    actorMemberId,
  };

  if (editingId) await updateExpense(editingId, payload);
  else await addExpense(payload);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(withFlash(`/groups/${groupId}`, editingId ? "Expense updated" : "Expense added"));
}

/**
 * Create an itemized expense: several line items submitted together as one
 * batch. The client serializes the rows into the `items` JSON field; each row's
 * split is resolved server-side (base currency only — no per-item FX).
 */
export async function saveExpenseBatchAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const group = await getGroup(groupId);
  if (!group) redirect("/groups");

  const label = String(formData.get("label") || "").trim() || "Itemized expense";
  const dateISO = String(formData.get("date") || new Date().toISOString().slice(0, 10));

  let rawItems: Array<{
    description?: string;
    amount?: string | number;
    payerMemberId?: string;
    splitMode?: string;
    splitValues?: Record<string, string | number>;
  }> = [];
  try {
    rawItems = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    rawItems = [];
  }

  const members = await getMembers(groupId);
  const memberIds = members.map((m) => m.id);

  const items = rawItems
    .filter((it) => Number(it.amount) > 0)
    .map((it) => {
      const mode = String(it.splitMode || "equal") as SplitMode;
      const payerMemberId = String(it.payerMemberId || memberIds[0]);
      const rawValues = memberIds.map((id) => Number(it.splitValues?.[id] || 0));
      const totalBaseCents = toCents(Number(it.amount) || 0);
      const participants = resolveParticipants(totalBaseCents, memberIds, mode, rawValues, payerMemberId);
      return {
        description: String(it.description || "").trim() || "Item",
        dateISO,
        currency: group.baseCurrency,
        fxRate: 1,
        payerMemberId,
        participants,
        splitMode: mode,
      };
    });

  if (items.length === 0) redirect(`/groups/${groupId}/expense/new`);

  const actorMemberId = (await requireAuth({ groupId })).memberId;
  await addExpenseBatch({ groupId, actorMemberId, label, items });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(withFlash(`/groups/${groupId}`, `Added ${items.length} item${items.length === 1 ? "" : "s"}`));
}

export async function revertExpenseAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const expenseId = String(formData.get("expenseId"));
  const actorMemberId = (await requireAuth({ groupId })).memberId;

  // Only the group admin or the member who created the expense may undo it.
  if (!(await canRevertExpense(expenseId, actorMemberId))) {
    throw new Error("Not allowed: only the group admin or the expense's creator can undo it.");
  }

  await revertExpense(expenseId, actorMemberId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(withFlash(`/groups/${groupId}`, "Expense reverted"));
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function recordSettlementAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const fromMemberId = String(formData.get("fromMemberId"));
  const toMemberId = String(formData.get("toMemberId"));
  const actorMemberId = (await requireAuth({ groupId })).memberId;

  // Only the two parties involved in the payment may record it.
  if (!canSettle(fromMemberId, toMemberId, actorMemberId)) {
    throw new Error("Not allowed: only the payer or payee can record this payment.");
  }

  await recordSettlement({
    groupId,
    fromMemberId,
    toMemberId,
    amountCents: Number(formData.get("amountCents")),
    actorMemberId,
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settle`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(withFlash(`/groups/${groupId}`, "Payment recorded"));
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroupAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const memberNames = formData.getAll("memberName").map((v) => String(v));
  const group = await createGroup({
    name: String(formData.get("name") || ""),
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
    memberNames,
    createdByUserId: user.id,
  });
  revalidatePath("/groups");
  redirect(withFlash(`/groups/${group.id}`, "Group created"));
}

/** Group settings are admin-only (the member slot that created the group). */
async function requireGroupAdmin(groupId: string): Promise<void> {
  const ctx = await requireAuth({ groupId });
  if (!(await isAdmin(groupId, ctx.memberId))) {
    throw new Error("Not allowed: only the group admin can change settings.");
  }
}

export async function updateGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  await updateGroup(groupId, {
    name: String(formData.get("name") || "").trim() || undefined,
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Settings saved"));
}

export async function addMemberAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const name = String(formData.get("memberName") || "").trim();
  // Any member of the group can add a new slot.
  await requireAuth({ groupId });
  if (name) await addMember(groupId, name);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, name ? `Added ${name}` : "Settings saved"));
}

export async function regenerateLinkAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  await regenerateShareToken(groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Share link regenerated"));
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  await deleteGroup(groupId);
  revalidatePath("/groups");
  redirect(withFlash("/groups", "Group deleted"));
}

// ---------------------------------------------------------------------------
// Share-link entry
// ---------------------------------------------------------------------------

export async function claimSlotAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const token = String(formData.get("token"));
  const memberId = formData.get("memberId") ? String(formData.get("memberId")) : undefined;
  const newName = formData.get("newName") ? String(formData.get("newName")) : undefined;

  // Link the slot to the account if the visitor is signed in; otherwise they act
  // as a share-token guest (identified by the member_id cookie below).
  const user = await getSessionUser();
  let claimedId: string;
  try {
    claimedId = await claimSlot({ groupId, memberId, newName, userId: user?.id });
  } catch (e) {
    // Recoverable claim problems (name taken, account-locked slot) go back to the
    // entry form with a message instead of crashing.
    if (e instanceof ClaimError) {
      redirect(`/g/${token}?error=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }

  // Mark the visitor as authorized for this group via the share token, exactly
  // as src/lib/auth.ts expects on the write path.
  const jar = await cookies();
  jar.set("share_token", token, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set("member_id", claimedId, { httpOnly: true, sameSite: "lax", path: "/" });

  revalidatePath(`/groups/${groupId}`);
  redirect(withFlash(`/groups/${groupId}`, "Joined group"));
}

/**
 * Release a slot's claim. The group admin may release anyone; a member may
 * release their own slot. The slot and its expense history are kept.
 */
export async function unclaimMemberAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const memberId = String(formData.get("memberId"));
  const ctx = await requireAuth({ groupId });
  if (ctx.memberId !== memberId && !(await isAdmin(groupId, ctx.memberId))) {
    throw new Error("Not allowed: only the group admin or the member themselves can release a slot.");
  }

  await unclaimMember(memberId);

  // If a member released their own slot, drop the cookie that tied them to it.
  if (ctx.memberId === memberId && ctx.isShareLinkActor) {
    const jar = await cookies();
    jar.delete("member_id");
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Slot released"));
}

/** Rename a member slot (admin only) — fixes typos / relabels a slot. */
export async function renameMemberAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const memberId = String(formData.get("memberId"));
  const name = String(formData.get("displayName") || "").trim();
  await requireGroupAdmin(groupId);
  try {
    await renameMember(memberId, name);
  } catch (e) {
    if (e instanceof ClaimError) {
      redirect(withFlash(`/groups/${groupId}/settings`, e.message));
    }
    throw e;
  }
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Member renamed"));
}
