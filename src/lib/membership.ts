/**
 * Pure membership/claim rules — shared by the entry picker (client), the
 * share-link page (server), the settings member list, and the `claimSlot`
 * write guard. Kept dependency-free so the rules live in one tested place.
 *
 * Two independent facts about a slot drive everything:
 *   - `claimedAtISO` present  → the slot is TAKEN (by a guest OR an account)
 *   - `accountLinked`         → a real account owns it; share-link guests may
 *                               never take it over (it's LOCKED)
 */

export interface SlotState {
  /** When the slot was first taken (guest or account). Absent = free. */
  claimedAtISO?: string;
  /** True when a real account is linked to the slot. */
  accountLinked: boolean;
}

export interface SlotFlags {
  /** Taken by a guest or an account — not pickable in normal mode. */
  claimed: boolean;
  /** Account-linked — not pickable even in returning mode. */
  locked: boolean;
}

/** Derive the picker flags for a slot from its stored state. */
export function slotFlags(s: SlotState): SlotFlags {
  return { claimed: !!s.claimedAtISO || s.accountLinked, locked: s.accountLinked };
}

/**
 * Whether a slot can be selected in the entry picker.
 * Normal mode: only free slots. Returning mode: also guest-taken slots, but
 * never account-linked ones (those are released by signing in to that account).
 */
export function isSlotSelectable(flags: SlotFlags, returning: boolean): boolean {
  return !flags.claimed || (returning && !flags.locked);
}

/** Whether the "Returning user?" affordance is useful (some slot is re-takeable). */
export function hasReclaimableSlot(flags: SlotFlags[]): boolean {
  return flags.some((f) => f.claimed && !f.locked);
}

/**
 * Server guard for (re)claiming an existing slot: an account-linked slot may
 * only be taken by that same account; everything else is open to share-link
 * guests. Mirrors the lock the picker enforces in the UI.
 */
export function canTakeSlot(
  slotUserId: string | null,
  actingUserId: string | null | undefined,
): boolean {
  return !slotUserId || slotUserId === actingUserId;
}

/** Whether a viewer may release/unclaim a slot: the admin, or its current holder. */
export function canReleaseSlot(opts: { taken: boolean; isAdmin: boolean; isSelf: boolean }): boolean {
  return opts.taken && (opts.isAdmin || opts.isSelf);
}
