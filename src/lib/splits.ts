/**
 * Pure split math — no DB, no framework. Shared by the save-expense action
 * (resolving a split into per-member gross amounts) and the data layer
 * (reconstructing gross amounts from stored zero-sum shares).
 *
 * All amounts are integer cents in the group's base currency.
 */

import type { SplitMode } from "./store";

export interface Allocation {
  memberId: string;
  amountCents: number;
}

/** Dollars (possibly fractional) → integer cents. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Resolve a split into the gross amount each member owes (summing to the total).
 *
 * - equal:   ignores rawValues; divides evenly, remainder penny to the payer.
 * - percent: rawValues are percentages; rounding drift goes to the payer.
 * - unequal: rawValues are dollar amounts per member.
 */
export function resolveParticipants(
  totalBaseCents: number,
  memberIds: string[],
  mode: SplitMode,
  rawValues: number[],
  payerMemberId: string,
): Allocation[] {
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
    const allocated = memberIds.map((_, i) => Math.round((totalBaseCents * (rawValues[i] || 0)) / 100));
    const drift = totalBaseCents - allocated.reduce((a, b) => a + b, 0);
    allocated[payerIdx] += drift;
    return memberIds.map((memberId, i) => ({ memberId, amountCents: allocated[i] }));
  }

  // unequal
  return memberIds.map((memberId, i) => ({ memberId, amountCents: toCents(rawValues[i] || 0) }));
}

/**
 * Inverse of storing an expense: rebuild each member's gross owed amount from the
 * stored zero-sum net shares and the payments, where grossOwed = netShare + amountPaid.
 * Members with a zero gross are omitted.
 */
export function reconstructParticipants(
  shares: Allocation[],
  payments: Allocation[],
): Allocation[] {
  const gross = new Map<string, number>();
  for (const s of shares) gross.set(s.memberId, (gross.get(s.memberId) ?? 0) + s.amountCents);
  for (const p of payments) gross.set(p.memberId, (gross.get(p.memberId) ?? 0) + p.amountCents);

  const out: Allocation[] = [];
  for (const [memberId, amountCents] of gross) {
    if (amountCents !== 0) out.push({ memberId, amountCents });
  }
  return out;
}
