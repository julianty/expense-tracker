import {
  computeBalances,
  assertBalancesZeroSum,
  splitEvenly,
  buildExpenseShares,
  toBaseCents,
  simplifyDebts,
  type ExpenseRow,
  type SettlementRow,
} from "@/lib/ledger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExpense(
  id: string,
  shares: Array<{ memberId: string; amountCents: number }>,
  deleted = false,
): ExpenseRow {
  return { id, shares, deleted };
}

// ---------------------------------------------------------------------------
// splitEvenly
// ---------------------------------------------------------------------------

describe("splitEvenly", () => {
  it("splits evenly when divisible", () => {
    expect(splitEvenly(300, 3)).toEqual([100, 100, 100]);
  });

  it("assigns remainder penny to payer (index 0 by default)", () => {
    const result = splitEvenly(100, 3);
    expect(result).toEqual([34, 33, 33]); // 34+33+33 = 100
    expect(result.reduce((a, b) => a + b)).toBe(100);
  });

  it("assigns remainder to specified payerIndex", () => {
    const result = splitEvenly(100, 3, 2);
    expect(result).toEqual([33, 33, 34]);
    expect(result.reduce((a, b) => a + b)).toBe(100);
  });

  it("handles single member", () => {
    expect(splitEvenly(999, 1)).toEqual([999]);
  });

  it("throws on count <= 0", () => {
    expect(() => splitEvenly(100, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildExpenseShares — zero-sum invariant
// ---------------------------------------------------------------------------

describe("buildExpenseShares", () => {
  it("builds correct shares for a simple 3-way equal split", () => {
    // Alex pays $30, split equally among Alex, Bo, Cam
    const shares = buildExpenseShares({
      payerMemberIds: ["alex"],
      payerAmountsCents: [3000],
      debtorMemberIds: ["alex", "bo", "cam"],
      debtorAmountsCents: [1000, 1000, 1000],
    });

    const net = new Map(shares.map((s) => [s.memberId, s.amountCents]));
    // alex paid 3000 and owes 1000 → net -2000 (alex is owed)
    expect(net.get("alex")).toBe(-2000);
    expect(net.get("bo")).toBe(1000);
    expect(net.get("cam")).toBe(1000);

    // Invariant
    expect(shares.reduce((a, s) => a + s.amountCents, 0)).toBe(0);
  });

  it("throws when payer total ≠ debtor total", () => {
    expect(() =>
      buildExpenseShares({
        payerMemberIds: ["alex"],
        payerAmountsCents: [3000],
        debtorMemberIds: ["bo"],
        debtorAmountsCents: [2999], // off by 1 cent
      }),
    ).toThrow();
  });

  it("collapses a member who is both payer and debtor", () => {
    // Alex and Bo split $60 equally, Alex pays it all
    const shares = buildExpenseShares({
      payerMemberIds: ["alex"],
      payerAmountsCents: [6000],
      debtorMemberIds: ["alex", "bo"],
      debtorAmountsCents: [3000, 3000],
    });

    // Only 2 rows: alex (-3000) and bo (+3000)
    expect(shares).toHaveLength(2);
    const net = new Map(shares.map((s) => [s.memberId, s.amountCents]));
    expect(net.get("alex")).toBe(-3000);
    expect(net.get("bo")).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// toBaseCents — FX conversion
// ---------------------------------------------------------------------------

describe("toBaseCents", () => {
  it("converts EUR → USD at 1.08 rate", () => {
    // €10.00 = 1000 EUR cents × 1.08 = 1080 USD cents
    expect(toBaseCents(1000, 1.08)).toBe(1080);
  });

  it("rounds correctly", () => {
    // 3 cents × 1.5 = 4.5 → rounds to 5
    expect(toBaseCents(3, 1.5)).toBe(5);
    // 333 cents × 1.08 = 359.64 → rounds to 360
    expect(toBaseCents(333, 1.08)).toBe(360);
  });

  it("is a no-op at rate 1.0", () => {
    expect(toBaseCents(4299, 1.0)).toBe(4299);
  });
});

// ---------------------------------------------------------------------------
// computeBalances
// ---------------------------------------------------------------------------

describe("computeBalances", () => {
  it("returns empty map for no expenses", () => {
    const balances = computeBalances([], []);
    expect(balances.size).toBe(0);
  });

  it("computes simple 3-way split correctly", () => {
    const expenses: ExpenseRow[] = [
      makeExpense("e1", [
        { memberId: "alex", amountCents: -2000 }, // alex paid $30, owes $10
        { memberId: "bo", amountCents: 1000 },
        { memberId: "cam", amountCents: 1000 },
      ]),
    ];
    const balances = computeBalances(expenses, []);
    expect(balances.get("alex")).toBe(-2000);
    expect(balances.get("bo")).toBe(1000);
    expect(balances.get("cam")).toBe(1000);
    assertBalancesZeroSum(balances);
  });

  it("skips deleted expenses", () => {
    const expenses: ExpenseRow[] = [
      makeExpense(
        "e1",
        [
          { memberId: "alex", amountCents: -2000 },
          { memberId: "bo", amountCents: 2000 },
        ],
        true, // deleted
      ),
    ];
    const balances = computeBalances(expenses, []);
    expect(balances.size).toBe(0);
  });

  it("settlements reduce balances", () => {
    const expenses: ExpenseRow[] = [
      makeExpense("e1", [
        { memberId: "alex", amountCents: -1000 },
        { memberId: "bo", amountCents: 1000 },
      ]),
    ];
    const settlements: SettlementRow[] = [
      { fromMemberId: "bo", toMemberId: "alex", amountCents: 1000 },
    ];
    const balances = computeBalances(expenses, settlements);
    expect(balances.get("alex")).toBe(0);
    expect(balances.get("bo")).toBe(0);
    assertBalancesZeroSum(balances);
  });

  it("enforces zero-sum invariant across multiple expenses", () => {
    const expenses: ExpenseRow[] = [
      makeExpense("e1", [
        { memberId: "alex", amountCents: -3000 },
        { memberId: "bo", amountCents: 1500 },
        { memberId: "cam", amountCents: 1500 },
      ]),
      makeExpense("e2", [
        { memberId: "bo", amountCents: -2000 },
        { memberId: "alex", amountCents: 1000 },
        { memberId: "cam", amountCents: 1000 },
      ]),
    ];
    const balances = computeBalances(expenses, []);
    assertBalancesZeroSum(balances);
  });

  it("handles multi-currency by assuming pre-converted cents", () => {
    // EUR expense converted to USD base before storage
    // €10 at 1.08 = $10.80 = 1080 USD cents
    const expenses: ExpenseRow[] = [
      makeExpense("e1", [
        { memberId: "alex", amountCents: -1080 }, // paid in USD equiv
        { memberId: "bo", amountCents: 540 },
        { memberId: "cam", amountCents: 540 },
      ]),
    ];
    const balances = computeBalances(expenses, []);
    expect(balances.get("alex")).toBe(-1080);
    expect(balances.get("bo")).toBe(540);
    expect(balances.get("cam")).toBe(540);
    assertBalancesZeroSum(balances);
  });
});

// ---------------------------------------------------------------------------
// simplifyDebts
// ---------------------------------------------------------------------------

describe("simplifyDebts", () => {
  it("returns no payments when all balances are zero", () => {
    const balances = new Map([
      ["alex", 0],
      ["bo", 0],
    ]);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it("produces one payment for simple two-person debt", () => {
    const balances = new Map([
      ["alex", -1000], // owed $10
      ["bo", 1000],    // owes $10
    ]);
    const payments = simplifyDebts(balances);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      fromMemberId: "bo",
      toMemberId: "alex",
      amountCents: 1000,
    });
  });

  it("minimises transactions for 3-person case", () => {
    // Standard example: alex -$20, bo +$10, cam +$10
    const balances = new Map([
      ["alex", -2000],
      ["bo", 1000],
      ["cam", 1000],
    ]);
    const payments = simplifyDebts(balances);
    expect(payments).toHaveLength(2);
    const total = payments.reduce((a, p) => a + p.amountCents, 0);
    expect(total).toBe(2000); // total transferred = total owed
    // All payments go to alex
    for (const p of payments) expect(p.toMemberId).toBe("alex");
  });

  it("handles chain debt", () => {
    // alex owes bo $10, bo owes cam $10 → simplify to alex pays cam $10
    const balances = new Map([
      ["alex", 1000],
      ["bo", 0],
      ["cam", -1000],
    ]);
    const payments = simplifyDebts(balances);
    // bo is already settled, so we just need alex → cam
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      fromMemberId: "alex",
      toMemberId: "cam",
      amountCents: 1000,
    });
  });

  it("produces fewer or equal payments vs naive approach (4-person)", () => {
    // 4 people: a=-300, b=+100, c=+100, d=+100
    const balances = new Map([
      ["a", -300],
      ["b", 100],
      ["c", 100],
      ["d", 100],
    ]);
    const payments = simplifyDebts(balances);
    expect(payments.length).toBeLessThanOrEqual(3);
    // Net should still zero out
    const net = new Map<string, number>();
    for (const p of payments) {
      net.set(p.fromMemberId, (net.get(p.fromMemberId) ?? 0) - p.amountCents);
      net.set(p.toMemberId, (net.get(p.toMemberId) ?? 0) + p.amountCents);
    }
    for (const [id, balance] of balances.entries()) {
      expect((net.get(id) ?? 0) + balance).toBe(0);
    }
  });

  it("revert = removing expense restores prior balances", () => {
    const shared: ExpenseRow[] = [
      makeExpense("e1", [
        { memberId: "alex", amountCents: -1000 },
        { memberId: "bo", amountCents: 1000 },
      ]),
    ];
    const before = computeBalances(shared, []);
    // "Revert" by marking deleted and recomputing
    shared[0].deleted = true;
    const after = computeBalances(shared, []);
    expect(after.size).toBe(0);
    // before had non-zero balances
    expect(before.get("alex")).toBe(-1000);
  });
});
