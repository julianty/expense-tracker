/**
 * Ledger — core financial logic for the Splitwise clone.
 *
 * Design rules (from architecture doc):
 * - Always work in integer cents (no floats).
 * - Each expense is stored as ExpenseShare rows that SUM TO ZERO.
 *   Negative = owed to you; Positive = you owe.
 * - Multi-currency: each row is pre-converted to base currency using its fxRate.
 * - Balances are DERIVED (computed), never stored.
 * - Revert = subtract a single expense's shares from the running totals.
 * - Simplify debts = greedy matching (biggest creditor vs biggest debtor).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseShareRow {
  memberId: string;
  /** Net cents in group base currency. Negative = creditor, Positive = debtor */
  amountCents: number;
}

export interface ExpenseRow {
  id: string;
  shares: ExpenseShareRow[];
  /** True if this expense has been soft-deleted / reverted */
  deleted?: boolean;
}

export interface SettlementRow {
  fromMemberId: string;
  toMemberId: string;
  /** Amount paid in group base currency cents */
  amountCents: number;
}

/** Net balance per member (positive = owes money, negative = is owed money) */
export type BalanceMap = Map<string, number>;

/** A single recommended payment to settle debts */
export interface Payment {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

// ---------------------------------------------------------------------------
// Balance computation
// ---------------------------------------------------------------------------

/**
 * Compute net balances across all active expenses and settlements.
 *
 * Positive balance  → member owes this much to the group.
 * Negative balance  → member is owed this much by the group.
 *
 * Invariant: sum of all balances === 0.
 */
export function computeBalances(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
): BalanceMap {
  const balances: BalanceMap = new Map();

  const add = (memberId: string, delta: number) => {
    balances.set(memberId, (balances.get(memberId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    if (expense.deleted) continue;
    for (const share of expense.shares) {
      add(share.memberId, share.amountCents);
    }
  }

  for (const s of settlements) {
    // fromMember paid toMember → fromMember's debt decreases, toMember's credit decreases
    add(s.fromMemberId, -s.amountCents);
    add(s.toMemberId, s.amountCents);
  }

  return balances;
}

/**
 * Verify the zero-sum invariant on a balance map.
 * Throws if the ledger is out of balance (should never happen in production).
 */
export function assertBalancesZeroSum(balances: BalanceMap): void {
  let total = 0;
  for (const v of balances.values()) total += v;
  if (total !== 0) {
    throw new Error(`Ledger invariant violated: balances sum to ${total}, expected 0`);
  }
}

// ---------------------------------------------------------------------------
// Penny rounding
// ---------------------------------------------------------------------------

/**
 * Distribute totalCents across `count` members as evenly as possible.
 * The remainder penny is given to member at index `payerIndex` (deterministic).
 *
 * @returns Array of integer cent amounts, length === count, sums to totalCents.
 */
export function splitEvenly(
  totalCents: number,
  count: number,
  payerIndex = 0,
): number[] {
  if (count <= 0) throw new Error("count must be > 0");
  const base = Math.trunc(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === payerIndex ? remainder : 0));
}

// ---------------------------------------------------------------------------
// ExpenseShare builder
// ---------------------------------------------------------------------------

export interface SplitInput {
  payerMemberIds: string[];
  /** Payment amounts in base currency cents (parallel to payerMemberIds) */
  payerAmountsCents: number[];
  debtorMemberIds: string[];
  /** Already-resolved share amounts in base currency cents (parallel to debtorMemberIds) */
  debtorAmountsCents: number[];
}

/**
 * Build ExpenseShare rows from a resolved split.
 * Validates that the zero-sum invariant holds.
 *
 * Convention:
 *   - Payers get NEGATIVE rows (they are owed back).
 *   - Debtors get POSITIVE rows (they owe).
 *   - If a member is both a payer and a debtor, the rows are merged.
 */
export function buildExpenseShares(input: SplitInput): ExpenseShareRow[] {
  const net = new Map<string, number>();

  const add = (id: string, delta: number) =>
    net.set(id, (net.get(id) ?? 0) + delta);

  for (let i = 0; i < input.payerMemberIds.length; i++) {
    add(input.payerMemberIds[i], -input.payerAmountsCents[i]);
  }
  for (let i = 0; i < input.debtorMemberIds.length; i++) {
    add(input.debtorMemberIds[i], input.debtorAmountsCents[i]);
  }

  const shares: ExpenseShareRow[] = [];
  for (const [memberId, amountCents] of net.entries()) {
    if (amountCents !== 0) shares.push({ memberId, amountCents });
  }

  // Validate invariant
  const sum = shares.reduce((acc, s) => acc + s.amountCents, 0);
  if (sum !== 0) {
    throw new Error(
      `buildExpenseShares: shares sum to ${sum} cents, must be 0. ` +
      `Check that payer totals equal debtor totals.`,
    );
  }

  return shares;
}

// ---------------------------------------------------------------------------
// FX conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert an amount in a foreign currency to base-currency cents.
 * Always rounds to the nearest integer cent.
 */
export function toBaseCents(amountCents: number, fxRate: number): number {
  return Math.round(amountCents * fxRate);
}

// ---------------------------------------------------------------------------
// Greedy debt simplification
// ---------------------------------------------------------------------------

/**
 * Compute the minimum set of payments to settle all debts.
 *
 * Algorithm: O(n log n) greedy — repeatedly match the biggest creditor with
 * the biggest debtor until everyone is zeroed out.
 * This is what Splitwise effectively ships; provably-minimal is NP-hard.
 */
export function simplifyDebts(balances: BalanceMap): Payment[] {
  // Creditors: negative balance (owed money)
  // Debtors: positive balance (owe money)
  const creditors: Array<{ memberId: string; amount: number }> = [];
  const debtors: Array<{ memberId: string; amount: number }> = [];

  for (const [memberId, balance] of balances.entries()) {
    if (balance < 0) creditors.push({ memberId, amount: -balance });
    else if (balance > 0) debtors.push({ memberId, amount: balance });
  }

  // Sort descending so we always process the largest amounts first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const payments: Payment[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) {
      payments.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountCents: amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return payments;
}
