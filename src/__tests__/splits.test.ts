import { resolveParticipants, reconstructParticipants, toCents } from "@/lib/splits";
import { buildExpenseShares } from "@/lib/ledger";

const ids = ["alex", "bo", "cam"];

describe("toCents", () => {
  it("converts dollars to integer cents", () => {
    expect(toCents(84)).toBe(8400);
    expect(toCents(56.3)).toBe(5630);
    expect(toCents(0.1 + 0.2)).toBe(30); // float-safe
  });
});

describe("resolveParticipants — equal", () => {
  it("divides evenly and sums to total", () => {
    const out = resolveParticipants(8400, ids, "equal", [], "alex");
    expect(out.map((p) => p.amountCents)).toEqual([2800, 2800, 2800]);
    expect(out.reduce((a, p) => a + p.amountCents, 0)).toBe(8400);
  });

  it("gives the remainder penny to the payer", () => {
    const out = resolveParticipants(5630, ids, "equal", [], "cam");
    // 5630 / 3 = 1876 r 2 → cam (payer) gets +2
    const byId = Object.fromEntries(out.map((p) => [p.memberId, p.amountCents]));
    expect(byId).toEqual({ alex: 1876, bo: 1876, cam: 1878 });
    expect(out.reduce((a, p) => a + p.amountCents, 0)).toBe(5630);
  });
});

describe("resolveParticipants — percent", () => {
  it("allocates by percentage", () => {
    const out = resolveParticipants(10000, ids, "percent", [50, 25, 25], "alex");
    expect(out.map((p) => p.amountCents)).toEqual([5000, 2500, 2500]);
  });

  it("absorbs rounding drift into the payer", () => {
    // 33.333% of 100c rounds to 33 for each → 99; payer absorbs the +1.
    const out = resolveParticipants(100, ids, "percent", [33.333, 33.333, 33.334], "alex");
    const byId = Object.fromEntries(out.map((p) => [p.memberId, p.amountCents]));
    expect(byId.alex).toBe(34);
    expect(out.reduce((a, p) => a + p.amountCents, 0)).toBe(100);
  });
});

describe("resolveParticipants — unequal", () => {
  it("uses raw dollar amounts per member", () => {
    const out = resolveParticipants(3000, ids, "unequal", [10, 20, 0], "alex");
    expect(out.map((p) => p.amountCents)).toEqual([1000, 2000, 0]);
  });
});

describe("reconstructParticipants (round-trips buildExpenseShares)", () => {
  it("recovers gross amounts from stored net shares + payments", () => {
    const participants = resolveParticipants(8400, ids, "equal", [], "alex");
    const total = participants.reduce((a, p) => a + p.amountCents, 0);

    const shares = buildExpenseShares({
      payerMemberIds: ["alex"],
      payerAmountsCents: [total],
      debtorMemberIds: participants.map((p) => p.memberId),
      debtorAmountsCents: participants.map((p) => p.amountCents),
    });
    const payments = [{ memberId: "alex", amountCents: total }];

    const recovered = reconstructParticipants(shares, payments);
    const expected = Object.fromEntries(participants.map((p) => [p.memberId, p.amountCents]));
    const actual = Object.fromEntries(recovered.map((p) => [p.memberId, p.amountCents]));
    expect(actual).toEqual(expected);
  });

  it("omits a pure payer who owes nothing", () => {
    // Alex pays $20 for Bo only; Alex owes nothing of it.
    const shares = buildExpenseShares({
      payerMemberIds: ["alex"],
      payerAmountsCents: [2000],
      debtorMemberIds: ["bo"],
      debtorAmountsCents: [2000],
    });
    const payments = [{ memberId: "alex", amountCents: 2000 }];
    const recovered = reconstructParticipants(shares, payments);
    expect(recovered).toEqual([{ memberId: "bo", amountCents: 2000 }]);
  });
});
