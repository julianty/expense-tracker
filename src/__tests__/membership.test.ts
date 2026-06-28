import {
  slotFlags,
  isSlotSelectable,
  hasReclaimableSlot,
  canTakeSlot,
  canReleaseSlot,
} from "@/lib/membership";

describe("slotFlags", () => {
  it("free slot: not claimed, not locked", () => {
    expect(slotFlags({ accountLinked: false })).toEqual({ claimed: false, locked: false });
  });

  it("guest-taken slot: claimed but not locked", () => {
    expect(slotFlags({ claimedAtISO: "2026-06-28T00:00:00.000Z", accountLinked: false })).toEqual({
      claimed: true,
      locked: false,
    });
  });

  it("account-linked slot: claimed and locked", () => {
    // accountLinked alone marks it taken+locked even without a claimedAt timestamp.
    expect(slotFlags({ accountLinked: true })).toEqual({ claimed: true, locked: true });
  });
});

describe("isSlotSelectable", () => {
  const free = { claimed: false, locked: false };
  const guest = { claimed: true, locked: false };
  const account = { claimed: true, locked: true };

  it("normal mode: only free slots are selectable", () => {
    expect(isSlotSelectable(free, false)).toBe(true);
    expect(isSlotSelectable(guest, false)).toBe(false);
    expect(isSlotSelectable(account, false)).toBe(false);
  });

  it("returning mode: guest-taken slots become selectable", () => {
    expect(isSlotSelectable(guest, true)).toBe(true);
  });

  it("returning mode: account-linked slots stay locked (contains impersonation)", () => {
    expect(isSlotSelectable(account, true)).toBe(false);
  });

  it("returning mode: free slots remain selectable", () => {
    expect(isSlotSelectable(free, true)).toBe(true);
  });
});

describe("hasReclaimableSlot", () => {
  it("true when a guest-taken slot exists", () => {
    expect(
      hasReclaimableSlot([
        { claimed: false, locked: false },
        { claimed: true, locked: false },
      ]),
    ).toBe(true);
  });

  it("false when the only taken slots are account-linked", () => {
    expect(
      hasReclaimableSlot([
        { claimed: false, locked: false },
        { claimed: true, locked: true },
      ]),
    ).toBe(false);
  });

  it("false for an all-free group", () => {
    expect(hasReclaimableSlot([{ claimed: false, locked: false }])).toBe(false);
  });
});

describe("canTakeSlot", () => {
  it("an unlinked slot is open to anyone (guest or account)", () => {
    expect(canTakeSlot(null, undefined)).toBe(true);
    expect(canTakeSlot(null, "user-1")).toBe(true);
  });

  it("an account-linked slot is takeable only by that same account", () => {
    expect(canTakeSlot("user-1", "user-1")).toBe(true);
    expect(canTakeSlot("user-1", "user-2")).toBe(false);
    expect(canTakeSlot("user-1", undefined)).toBe(false); // a guest can't take it
  });
});

describe("canReleaseSlot", () => {
  it("nobody can release an untaken slot", () => {
    expect(canReleaseSlot({ taken: false, isAdmin: true, isSelf: true })).toBe(false);
  });

  it("the admin can release any taken slot", () => {
    expect(canReleaseSlot({ taken: true, isAdmin: true, isSelf: false })).toBe(true);
  });

  it("a member can release their own taken slot", () => {
    expect(canReleaseSlot({ taken: true, isAdmin: false, isSelf: true })).toBe(true);
  });

  it("an unrelated non-admin cannot release someone else's slot", () => {
    expect(canReleaseSlot({ taken: true, isAdmin: false, isSelf: false })).toBe(false);
  });
});
