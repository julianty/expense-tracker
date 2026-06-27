/**
 * In-memory demo store.
 *
 * The real app persists through Prisma + Supabase (see prisma/schema.prisma and
 * src/lib/auth.ts). There is no database configured in this environment, so this
 * module stands in for the persistence layer: it holds seeded demo data and runs
 * every balance through the real ledger logic in `./ledger`.
 *
 * Shapes mirror the Prisma models closely, so swapping these functions for
 * Prisma queries later is mechanical. Balances and simplified payments are always
 * DERIVED here (never stored), exactly as the architecture requires.
 */

import {
  buildExpenseShares,
  computeBalances,
  simplifyDebts,
  splitEvenly,
  type BalanceMap,
  type Payment,
} from "./ledger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitMode = "equal" | "unequal" | "percent";

export interface Member {
  id: string;
  groupId: string;
  displayName: string;
  /** Email of the real account that claimed this slot, if any. */
  claimedEmail?: string;
}

export interface PayShare {
  memberId: string;
  /** Integer cents, already converted to the group's base currency. */
  amountCents: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  note?: string;
  dateISO: string;
  /** Currency the expense was entered in (may differ from group base). */
  currency: string;
  /** Rate to base currency at entry time (1 if same currency). */
  fxRate: number;
  imageUrl?: string;
  createdByMemberId: string;
  /** Who paid, in base-currency cents. Sums to the expense total. */
  payments: PayShare[];
  /** Who owes (gross share), in base-currency cents. Sums to the expense total. */
  participants: PayShare[];
  splitMode: SplitMode;
  deleted?: boolean;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  dateISO: string;
}

export interface AuditEntry {
  id: string;
  groupId: string;
  actorMemberId: string;
  /** Human-readable summary, e.g. "added 'Dinner'". */
  action: string;
  amountCents?: number;
  kind: "create" | "settle" | "revert" | "edit";
  entityType?: "expense" | "settlement";
  entityId?: string;
  createdISO: string;
}

export interface Group {
  id: string;
  name: string;
  baseCurrency: string;
  shareToken: string;
  simplifyDebts: boolean;
  /** The member slot that owns the group (admin; can revert anyone). */
  createdByMemberId: string;
}

interface DB {
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  audit: AuditEntry[];
  seq: number;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function seed(): DB {
  const db: DB = {
    groups: [],
    members: [],
    expenses: [],
    settlements: [],
    audit: [],
    seq: 1,
  };

  // --- Tahoe trip (the demo / hub group) ---
  const tahoe: Group = {
    id: "tahoe",
    name: "Tahoe trip",
    baseCurrency: "USD",
    shareToken: "x7Qa9k2mDt",
    simplifyDebts: true,
    createdByMemberId: "m-alex",
  };
  db.groups.push(tahoe);
  db.members.push(
    { id: "m-alex", groupId: "tahoe", displayName: "Alex", claimedEmail: "alex@example.com" },
    { id: "m-bo", groupId: "tahoe", displayName: "Bo" },
    { id: "m-cam", groupId: "tahoe", displayName: "Cam" },
  );

  const equalParticipants = (groupId: string, total: number, memberIds: string[], payerId: string): PayShare[] => {
    const payerIdx = Math.max(0, memberIds.indexOf(payerId));
    const amounts = splitEvenly(total, memberIds.length, payerIdx);
    return memberIds.map((memberId, i) => ({ memberId, amountCents: amounts[i] }));
  };

  const tahoeMembers = ["m-alex", "m-bo", "m-cam"];
  db.expenses.push(
    {
      id: "e-dinner",
      groupId: "tahoe",
      description: "Dinner",
      dateISO: "2026-06-14T21:21:00",
      currency: "USD",
      fxRate: 1,
      createdByMemberId: "m-alex",
      payments: [{ memberId: "m-alex", amountCents: 8400 }],
      participants: equalParticipants("tahoe", 8400, tahoeMembers, "m-alex"),
      splitMode: "equal",
    },
    {
      id: "e-lift",
      groupId: "tahoe",
      description: "Lift tickets",
      dateISO: "2026-06-13T11:10:00",
      currency: "USD",
      fxRate: 1,
      createdByMemberId: "m-bo",
      payments: [{ memberId: "m-bo", amountCents: 21000 }],
      participants: equalParticipants("tahoe", 21000, tahoeMembers, "m-bo"),
      splitMode: "equal",
    },
    {
      id: "e-groceries",
      groupId: "tahoe",
      description: "Groceries",
      dateISO: "2026-06-12T17:30:00",
      currency: "USD",
      fxRate: 1,
      createdByMemberId: "m-cam",
      payments: [{ memberId: "m-cam", amountCents: 5630 }],
      participants: equalParticipants("tahoe", 5630, tahoeMembers, "m-cam"),
      splitMode: "equal",
    },
  );
  db.audit.push(
    {
      id: "a-1",
      groupId: "tahoe",
      actorMemberId: "m-alex",
      action: "added 'Dinner'",
      amountCents: 8400,
      kind: "create",
      entityType: "expense",
      entityId: "e-dinner",
      createdISO: "2026-06-14T21:21:00",
    },
    {
      id: "a-2",
      groupId: "tahoe",
      actorMemberId: "m-bo",
      action: "added 'Lift tickets'",
      amountCents: 21000,
      kind: "create",
      entityType: "expense",
      entityId: "e-lift",
      createdISO: "2026-06-13T11:10:00",
    },
    {
      id: "a-3",
      groupId: "tahoe",
      actorMemberId: "m-cam",
      action: "added 'Groceries'",
      amountCents: 5630,
      kind: "create",
      entityType: "expense",
      entityId: "e-groceries",
      createdISO: "2026-06-12T17:30:00",
    },
  );

  // --- Apartment 4B ---
  db.groups.push({
    id: "apt4b",
    name: "Apartment 4B",
    baseCurrency: "USD",
    shareToken: "p3Lm8nQr5w",
    simplifyDebts: true,
    createdByMemberId: "m-jo",
  });
  const aptMembers = [
    { id: "m-jo", displayName: "Jo", claimedEmail: "jo@example.com" },
    { id: "m-mi", displayName: "Mi" },
    { id: "m-ro", displayName: "Ro" },
    { id: "m-sky", displayName: "Sky" },
    { id: "m-tay", displayName: "Tay" },
  ];
  for (const m of aptMembers) {
    db.members.push({ id: m.id, groupId: "apt4b", displayName: m.displayName, claimedEmail: m.claimedEmail });
  }
  const aptIds = aptMembers.map((m) => m.id);
  db.expenses.push({
    id: "e-rent",
    groupId: "apt4b",
    description: "Rent — June",
    dateISO: "2026-06-01T09:00:00",
    currency: "USD",
    fxRate: 1,
    createdByMemberId: "m-mi",
    payments: [{ memberId: "m-mi", amountCents: 310000 }],
    participants: equalParticipants("apt4b", 310000, aptIds, "m-mi"),
    splitMode: "equal",
  });
  db.audit.push({
    id: "a-4",
    groupId: "apt4b",
    actorMemberId: "m-mi",
    action: "added 'Rent — June'",
    amountCents: 310000,
    kind: "create",
    entityType: "expense",
    entityId: "e-rent",
    createdISO: "2026-06-01T09:00:00",
  });

  // --- Book club (settled, no open balances) ---
  db.groups.push({
    id: "bookclub",
    name: "Book club",
    baseCurrency: "USD",
    shareToken: "k9Zt2vBc4x",
    simplifyDebts: false,
    createdByMemberId: "m-sam",
  });
  db.members.push(
    { id: "m-sam", groupId: "bookclub", displayName: "Sam", claimedEmail: "sam@example.com" },
    { id: "m-dee", groupId: "bookclub", displayName: "Dee" },
  );

  return db;
}

// ---------------------------------------------------------------------------
// Singleton (survives dev hot-reload)
// ---------------------------------------------------------------------------

const globalForStore = globalThis as unknown as { __splitStore?: DB };
const db: DB = (globalForStore.__splitStore ??= seed());

function nextId(prefix: string): string {
  return `${prefix}-${db.seq++}-${Date.now().toString(36)}`;
}

/**
 * In the real app the acting member comes from the auth gate (session OR share
 * token). For the demo we treat the first member slot of each group as "you".
 */
export function currentMemberId(groupId: string): string {
  const m = db.members.find((x) => x.groupId === groupId);
  return m?.id ?? "";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getGroups(): Group[] {
  return db.groups;
}

export function getGroup(id: string): Group | undefined {
  return db.groups.find((g) => g.id === id);
}

export function getGroupByToken(token: string): Group | undefined {
  return db.groups.find((g) => g.shareToken === token);
}

export function getMembers(groupId: string): Member[] {
  return db.members.filter((m) => m.groupId === groupId);
}

export function getMember(id: string): Member | undefined {
  return db.members.find((m) => m.id === id);
}

/** Stable index of a member within its group — used for avatar colors. */
export function memberIndex(groupId: string, memberId: string): number {
  return getMembers(groupId).findIndex((m) => m.id === memberId);
}

export function getExpenses(groupId: string): Expense[] {
  return db.expenses
    .filter((e) => e.groupId === groupId && !e.deleted)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function getExpense(id: string): Expense | undefined {
  return db.expenses.find((e) => e.id === id);
}

export function expenseTotalCents(e: Expense): number {
  return e.payments.reduce((acc, p) => acc + p.amountCents, 0);
}

export function getSettlements(groupId: string): Settlement[] {
  return db.settlements.filter((s) => s.groupId === groupId);
}

export function getAudit(groupId: string): AuditEntry[] {
  return db.audit
    .filter((a) => a.groupId === groupId)
    .sort((a, b) => b.createdISO.localeCompare(a.createdISO));
}

/** Net balance per member: positive = owes the group, negative = is owed. */
export function getBalances(groupId: string): BalanceMap {
  const expenseRows = getExpenses(groupId).map((e) => ({
    id: e.id,
    shares: buildExpenseShares({
      payerMemberIds: e.payments.map((p) => p.memberId),
      payerAmountsCents: e.payments.map((p) => p.amountCents),
      debtorMemberIds: e.participants.map((p) => p.memberId),
      debtorAmountsCents: e.participants.map((p) => p.amountCents),
    }),
  }));
  const settlementRows = getSettlements(groupId).map((s) => ({
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amountCents: s.amountCents,
  }));

  // Ensure every member appears, even at zero balance.
  const balances = computeBalances(expenseRows, settlementRows);
  for (const m of getMembers(groupId)) {
    if (!balances.has(m.id)) balances.set(m.id, 0);
  }
  return balances;
}

export function getSimplifiedPayments(groupId: string): Payment[] {
  return simplifyDebts(getBalances(groupId));
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** The group admin is the member slot that created the group. */
export function isAdmin(groupId: string, memberId: string): boolean {
  const g = getGroup(groupId);
  return !!g && !!memberId && g.createdByMemberId === memberId;
}

/**
 * Who may undo/revert an expense: the group admin, or the member who created it.
 */
export function canRevertExpense(expenseId: string, memberId: string): boolean {
  const e = getExpense(expenseId);
  if (!e || !memberId) return false;
  return isAdmin(e.groupId, memberId) || e.createdByMemberId === memberId;
}

/**
 * Who may record a settlement: only the two parties involved (payer or payee).
 */
export function canSettle(fromMemberId: string, toMemberId: string, memberId: string): boolean {
  return !!memberId && (memberId === fromMemberId || memberId === toMemberId);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  groupId: string;
  description: string;
  note?: string;
  dateISO: string;
  currency: string;
  fxRate: number;
  payerMemberId: string;
  /** Gross share per member in base-currency cents, summing to the total. */
  participants: PayShare[];
  splitMode: SplitMode;
  actorMemberId: string;
}

export function addExpense(input: ExpenseInput): Expense {
  const total = input.participants.reduce((acc, p) => acc + p.amountCents, 0);
  const expense: Expense = {
    id: nextId("e"),
    groupId: input.groupId,
    description: input.description,
    note: input.note,
    dateISO: input.dateISO,
    currency: input.currency,
    fxRate: input.fxRate,
    createdByMemberId: input.actorMemberId,
    payments: [{ memberId: input.payerMemberId, amountCents: total }],
    participants: input.participants,
    splitMode: input.splitMode,
  };
  db.expenses.push(expense);
  pushAudit(input.groupId, input.actorMemberId, `added '${input.description}'`, "create", total, "expense", expense.id);
  return expense;
}

export function updateExpense(id: string, input: ExpenseInput): Expense | undefined {
  const e = getExpense(id);
  if (!e) return undefined;
  const total = input.participants.reduce((acc, p) => acc + p.amountCents, 0);
  e.description = input.description;
  e.note = input.note;
  e.dateISO = input.dateISO;
  e.currency = input.currency;
  e.fxRate = input.fxRate;
  e.payments = [{ memberId: input.payerMemberId, amountCents: total }];
  e.participants = input.participants;
  e.splitMode = input.splitMode;
  pushAudit(input.groupId, input.actorMemberId, `edited '${input.description}'`, "edit", total, "expense", e.id);
  return e;
}

export function revertExpense(id: string, actorMemberId: string): void {
  const e = getExpense(id);
  if (!e || e.deleted) return;
  e.deleted = true;
  pushAudit(
    e.groupId,
    actorMemberId,
    `reverted '${e.description}'`,
    "revert",
    expenseTotalCents(e),
    "expense",
    e.id,
  );
}

export function recordSettlement(opts: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  actorMemberId: string;
}): Settlement {
  const s: Settlement = {
    id: nextId("s"),
    groupId: opts.groupId,
    fromMemberId: opts.fromMemberId,
    toMemberId: opts.toMemberId,
    amountCents: opts.amountCents,
    dateISO: new Date().toISOString(),
  };
  db.settlements.push(s);
  const to = getMember(opts.toMemberId)?.displayName ?? "someone";
  pushAudit(opts.groupId, opts.actorMemberId, `paid ${to}`, "settle", opts.amountCents, "settlement", s.id);
  return s;
}

export interface CreateGroupInput {
  name: string;
  baseCurrency: string;
  simplifyDebts: boolean;
  memberNames: string[];
}

export function createGroup(input: CreateGroupInput): Group {
  const groupId = nextId("g");
  const memberIds = input.memberNames
    .map((n) => n.trim())
    .filter(Boolean)
    .map((displayName) => {
      const m: Member = { id: nextId("m"), groupId, displayName };
      db.members.push(m);
      return m.id;
    });
  const group: Group = {
    id: groupId,
    name: input.name.trim() || "Untitled group",
    baseCurrency: input.baseCurrency,
    shareToken: randomToken(),
    simplifyDebts: input.simplifyDebts,
    createdByMemberId: memberIds[0] ?? "",
  };
  db.groups.push(group);
  return group;
}

export function updateGroup(
  id: string,
  patch: Partial<Pick<Group, "name" | "baseCurrency" | "simplifyDebts">>,
): void {
  const g = getGroup(id);
  if (!g) return;
  Object.assign(g, patch);
}

export function regenerateShareToken(id: string): string | undefined {
  const g = getGroup(id);
  if (!g) return undefined;
  g.shareToken = randomToken();
  return g.shareToken;
}

export function deleteGroup(id: string): void {
  db.groups = db.groups.filter((g) => g.id !== id);
  db.members = db.members.filter((m) => m.groupId !== id);
  db.expenses = db.expenses.filter((e) => e.groupId !== id);
  db.settlements = db.settlements.filter((s) => s.groupId !== id);
  db.audit = db.audit.filter((a) => a.groupId !== id);
}

/** Claim an existing slot, or create + claim a new one. Returns memberId. */
export function claimSlot(opts: {
  groupId: string;
  memberId?: string;
  newName?: string;
  email?: string;
}): string {
  if (opts.memberId) {
    const m = getMember(opts.memberId);
    if (m) {
      m.claimedEmail = opts.email ?? m.claimedEmail ?? "guest@share-link";
      return m.id;
    }
  }
  const m: Member = {
    id: nextId("m"),
    groupId: opts.groupId,
    displayName: opts.newName?.trim() || "Guest",
    claimedEmail: opts.email ?? "guest@share-link",
  };
  db.members.push(m);
  return m.id;
}

function pushAudit(
  groupId: string,
  actorMemberId: string,
  action: string,
  kind: AuditEntry["kind"],
  amountCents?: number,
  entityType?: AuditEntry["entityType"],
  entityId?: string,
) {
  db.audit.push({
    id: nextId("a"),
    groupId,
    actorMemberId,
    action,
    amountCents,
    kind,
    entityType,
    entityId,
    createdISO: new Date().toISOString(),
  });
}

function randomToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
