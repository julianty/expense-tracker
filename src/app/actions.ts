"use server";

/**
 * Server actions — the single write surface for the app.
 *
 * In production each action would call `requireAuth({ groupId })` from
 * src/lib/auth.ts (valid session OR share token) and write through Prisma. Here
 * they validate input and write to the in-memory demo store, then revalidate the
 * affected paths. The acting member is resolved with `currentMemberId` (the demo
 * stand-in for the auth gate).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  addExpense,
  canRevertExpense,
  canSettle,
  claimSlot,
  createGroup,
  currentMemberId,
  deleteGroup,
  getGroup,
  getMembers,
  recordSettlement,
  regenerateShareToken,
  revertExpense,
  updateExpense,
  updateGroup,
  type SplitMode,
} from "@/lib/store";
import { rateToBase } from "@/lib/fx";
import { resolveParticipants, toCents } from "@/lib/splits";

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

  const actorMemberId = await currentMemberId(groupId);
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
    actorMemberId,
  };

  if (editingId) await updateExpense(editingId, payload);
  else await addExpense(payload);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(withFlash(`/groups/${groupId}`, editingId ? "Expense updated" : "Expense added"));
}

export async function revertExpenseAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const expenseId = String(formData.get("expenseId"));
  const actorMemberId = await currentMemberId(groupId);

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
  const actorMemberId = await currentMemberId(groupId);

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
  const memberNames = formData.getAll("memberName").map((v) => String(v));
  const group = await createGroup({
    name: String(formData.get("name") || ""),
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
    memberNames,
  });
  revalidatePath("/groups");
  redirect(withFlash(`/groups/${group.id}`, "Group created"));
}

export async function updateGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  await updateGroup(groupId, {
    name: String(formData.get("name") || "").trim() || undefined,
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Settings saved"));
}

export async function regenerateLinkAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  await regenerateShareToken(groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(withFlash(`/groups/${groupId}/settings`, "Share link regenerated"));
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
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

  const claimedId = await claimSlot({ groupId, memberId, newName });

  // Mark the visitor as authorized for this group via the share token, exactly
  // as src/lib/auth.ts expects on the write path.
  const jar = await cookies();
  jar.set("share_token", token, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set("member_id", claimedId, { httpOnly: true, sameSite: "lax", path: "/" });

  revalidatePath(`/groups/${groupId}`);
  redirect(withFlash(`/groups/${groupId}`, "Joined group"));
}
