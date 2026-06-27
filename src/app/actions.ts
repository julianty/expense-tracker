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
  type PayShare,
  type SplitMode,
} from "@/lib/store";
import { rateToBase } from "@/lib/fx";

const toCents = (dollars: number) => Math.round(dollars * 100);

/**
 * Resolve the gross share (base-currency cents) each member owes, from the raw
 * split inputs. Mirrors the split resolvers described in the design.
 */
function resolveParticipants(
  totalBaseCents: number,
  memberIds: string[],
  mode: SplitMode,
  rawValues: number[],
  payerMemberId: string,
): PayShare[] {
  const payerIdx = Math.max(0, memberIds.indexOf(payerMemberId));

  if (mode === "equal") {
    const base = Math.trunc(totalBaseCents / memberIds.length);
    const remainder = totalBaseCents - base * memberIds.length;
    return memberIds.map((memberId, i) => ({
      memberId,
      amountCents: base + (i === payerIdx ? remainder : 0),
    }));
  }

  if (mode === "percent") {
    // rawValues are percentages; allocate cents and give rounding remainder to payer.
    const allocated = memberIds.map((_, i) => Math.round((totalBaseCents * (rawValues[i] || 0)) / 100));
    const drift = totalBaseCents - allocated.reduce((a, b) => a + b, 0);
    allocated[payerIdx] += drift;
    return memberIds.map((memberId, i) => ({ memberId, amountCents: allocated[i] }));
  }

  // unequal: rawValues are dollar amounts per member.
  return memberIds.map((memberId, i) => ({ memberId, amountCents: toCents(rawValues[i] || 0) }));
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function saveExpenseAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const editingId = formData.get("expenseId") ? String(formData.get("expenseId")) : undefined;
  const group = getGroup(groupId);
  if (!group) redirect("/groups");

  const description = String(formData.get("description") || "").trim() || "Untitled";
  const amount = Number(formData.get("amount") || 0);
  const currency = String(formData.get("currency") || group.baseCurrency);
  const fxRate = Number(formData.get("fxRate")) || rateToBase(currency, group.baseCurrency);
  const payerMemberId = String(formData.get("payerMemberId"));
  const mode = (String(formData.get("splitMode") || "equal") as SplitMode);
  const note = String(formData.get("note") || "").trim() || undefined;
  const dateISO = String(formData.get("date") || new Date().toISOString().slice(0, 10));

  const members = getMembers(groupId);
  const memberIds = members.map((m) => m.id);
  const rawValues = memberIds.map((id) => Number(formData.get(`split-${id}`) || 0));

  // Convert the entered amount into base-currency cents before splitting.
  const totalBaseCents = Math.round(toCents(amount) * fxRate);
  const participants = resolveParticipants(totalBaseCents, memberIds, mode, rawValues, payerMemberId);

  const actorMemberId = currentMemberId(groupId);
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

  if (editingId) updateExpense(editingId, payload);
  else addExpense(payload);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(`/groups/${groupId}`);
}

export async function revertExpenseAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const expenseId = String(formData.get("expenseId"));
  const actorMemberId = currentMemberId(groupId);

  // Only the group admin or the member who created the expense may undo it.
  if (!canRevertExpense(expenseId, actorMemberId)) {
    throw new Error("Not allowed: only the group admin or the expense's creator can undo it.");
  }

  revertExpense(expenseId, actorMemberId);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(`/groups/${groupId}`);
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function recordSettlementAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const fromMemberId = String(formData.get("fromMemberId"));
  const toMemberId = String(formData.get("toMemberId"));
  const actorMemberId = currentMemberId(groupId);

  // Only the two parties involved in the payment may record it.
  if (!canSettle(fromMemberId, toMemberId, actorMemberId)) {
    throw new Error("Not allowed: only the payer or payee can record this payment.");
  }

  recordSettlement({
    groupId,
    fromMemberId,
    toMemberId,
    amountCents: Number(formData.get("amountCents")),
    actorMemberId,
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settle`);
  revalidatePath(`/groups/${groupId}/activity`);
  redirect(`/groups/${groupId}`);
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroupAction(formData: FormData) {
  const memberNames = formData.getAll("memberName").map((v) => String(v));
  const group = createGroup({
    name: String(formData.get("name") || ""),
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
    memberNames,
  });
  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function updateGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  updateGroup(groupId, {
    name: String(formData.get("name") || "").trim() || undefined,
    baseCurrency: String(formData.get("baseCurrency") || "USD"),
    simplifyDebts: formData.get("simplifyDebts") === "on",
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(`/groups/${groupId}/settings`);
}

export async function regenerateLinkAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  regenerateShareToken(groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  redirect(`/groups/${groupId}/settings`);
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  deleteGroup(groupId);
  revalidatePath("/groups");
  redirect("/groups");
}

// ---------------------------------------------------------------------------
// Share-link entry
// ---------------------------------------------------------------------------

export async function claimSlotAction(formData: FormData) {
  const groupId = String(formData.get("groupId"));
  const token = String(formData.get("token"));
  const memberId = formData.get("memberId") ? String(formData.get("memberId")) : undefined;
  const newName = formData.get("newName") ? String(formData.get("newName")) : undefined;

  const claimedId = claimSlot({ groupId, memberId, newName });

  // Mark the visitor as authorized for this group via the share token, exactly
  // as src/lib/auth.ts expects on the write path.
  const jar = await cookies();
  jar.set("share_token", token, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set("member_id", claimedId, { httpOnly: true, sameSite: "lax", path: "/" });

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
