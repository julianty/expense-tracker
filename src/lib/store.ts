/**
 * Data layer — Prisma/Supabase.
 *
 * Every read/write goes through Prisma against the Supabase Postgres DB. Balances
 * and simplified payments are always DERIVED here from the stored zero-sum
 * `ExpenseShare` rows (never stored), exactly as the architecture requires.
 *
 * Persistence-first note: real Supabase auth isn't wired yet, so the "acting
 * member" is still resolved with `currentMemberId` (the first slot of a group).
 * Swap that for `requireAuth()` (src/lib/auth.ts) when auth lands — nothing else
 * in this module needs to change.
 */

import { prisma } from "./prisma";
import {
  buildExpenseShares,
  computeBalances,
  simplifyDebts,
  type BalanceMap,
  type Payment,
} from "./ledger";
import { reconstructParticipants } from "./splits";

// ---------------------------------------------------------------------------
// Types (the shapes the UI consumes; mapped from Prisma models)
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
  currency: string;
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
  /** Supabase user id that created the group (the admin). Null if created without auth. */
  createdByUserId: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

type PrismaExpenseWithRels = {
  id: string;
  groupId: string;
  description: string;
  note: string | null;
  date: Date;
  currency: string;
  fxRate: { toString(): string };
  imageUrl: string | null;
  splitMode: string;
  createdByMemberId: string;
  deletedAt: Date | null;
  payments: { memberId: string; amountCents: number }[];
  shares: { memberId: string; amountCents: number }[];
};

function mapExpense(e: PrismaExpenseWithRels): Expense {
  const payments: PayShare[] = e.payments.map((p) => ({ memberId: p.memberId, amountCents: p.amountCents }));
  // Gross "participants" (what each member owes) = netShare + amountPaid.
  const participants = reconstructParticipants(e.shares, payments);

  return {
    id: e.id,
    groupId: e.groupId,
    description: e.description,
    note: e.note ?? undefined,
    dateISO: e.date.toISOString(),
    currency: e.currency,
    fxRate: Number(e.fxRate.toString()),
    imageUrl: e.imageUrl ?? undefined,
    createdByMemberId: e.createdByMemberId,
    payments,
    participants,
    splitMode: (e.splitMode as SplitMode) ?? "equal",
    deleted: e.deletedAt != null,
  };
}

const EXPENSE_INCLUDE = {
  payments: { select: { memberId: true, amountCents: true } },
  shares: { select: { memberId: true, amountCents: true } },
} as const;

// ---------------------------------------------------------------------------
// Acting member (persistence-first stand-in for the auth gate)
// ---------------------------------------------------------------------------

export async function currentMemberId(groupId: string): Promise<string> {
  const m = await prisma.groupMember.findFirst({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return m?.id ?? "";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getGroups(): Promise<Group[]> {
  return prisma.group.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getGroup(id: string): Promise<Group | undefined> {
  return (await prisma.group.findUnique({ where: { id } })) ?? undefined;
}

export async function getGroupByToken(token: string): Promise<Group | undefined> {
  return (await prisma.group.findUnique({ where: { shareToken: token } })) ?? undefined;
}

export async function getMembers(groupId: string): Promise<Member[]> {
  const rows = await prisma.groupMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    include: { claimedBy: { select: { email: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    groupId: m.groupId,
    displayName: m.displayName,
    claimedEmail: m.claimedBy?.email ?? undefined,
  }));
}

export async function getMember(id: string): Promise<Member | undefined> {
  const m = await prisma.groupMember.findUnique({
    where: { id },
    include: { claimedBy: { select: { email: true } } },
  });
  if (!m) return undefined;
  return {
    id: m.id,
    groupId: m.groupId,
    displayName: m.displayName,
    claimedEmail: m.claimedBy?.email ?? undefined,
  };
}

export async function getExpenses(groupId: string): Promise<Expense[]> {
  const rows = await prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    orderBy: { date: "desc" },
    include: EXPENSE_INCLUDE,
  });
  return rows.map(mapExpense);
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  const e = await prisma.expense.findUnique({ where: { id }, include: EXPENSE_INCLUDE });
  return e ? mapExpense(e) : undefined;
}

/** Pure helper — total = sum of payments. */
export function expenseTotalCents(e: Expense): number {
  return e.payments.reduce((acc, p) => acc + p.amountCents, 0);
}

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  const rows = await prisma.settlement.findMany({ where: { groupId } });
  return rows.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amountCents: s.amountCents,
    dateISO: s.date.toISOString(),
  }));
}

export async function getAudit(groupId: string): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    actorMemberId: a.actorMemberId,
    action: a.action,
    amountCents: a.amountCents ?? undefined,
    kind: a.kind as AuditEntry["kind"],
    entityType: (a.entityType as AuditEntry["entityType"]) ?? undefined,
    entityId: a.entityId ?? undefined,
    createdISO: a.createdAt.toISOString(),
  }));
}

/** Net balance per member: positive = owes the group, negative = is owed. */
export async function getBalances(groupId: string): Promise<BalanceMap> {
  const [expenses, settlements, members] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: { id: true, shares: { select: { memberId: true, amountCents: true } } },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { fromMemberId: true, toMemberId: true, amountCents: true },
    }),
    prisma.groupMember.findMany({ where: { groupId }, select: { id: true } }),
  ]);

  const balances = computeBalances(
    expenses.map((e) => ({ id: e.id, shares: e.shares })),
    settlements,
  );
  for (const m of members) if (!balances.has(m.id)) balances.set(m.id, 0);
  return balances;
}

export async function getSimplifiedPayments(groupId: string): Promise<Payment[]> {
  return simplifyDebts(await getBalances(groupId));
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** Admin = the member slot claimed by the user who created the group. */
export async function isAdmin(groupId: string, memberId: string): Promise<boolean> {
  if (!memberId) return false;
  const [group, member] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { createdByUserId: true } }),
    prisma.groupMember.findUnique({ where: { id: memberId }, select: { claimedByUserId: true } }),
  ]);
  return (
    !!group?.createdByUserId &&
    !!member?.claimedByUserId &&
    group.createdByUserId === member.claimedByUserId
  );
}

/** Who may undo/revert an expense: the group admin, or the member who created it. */
export async function canRevertExpense(expenseId: string, memberId: string): Promise<boolean> {
  if (!memberId) return false;
  const e = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { groupId: true, createdByMemberId: true },
  });
  if (!e) return false;
  if (e.createdByMemberId === memberId) return true;
  return isAdmin(e.groupId, memberId);
}

/** Who may record a settlement: only the two parties involved (payer or payee). */
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

/** Build the zero-sum net shares stored in the DB from a single payer + gross shares. */
function netSharesFor(input: ExpenseInput): { total: number; shares: PayShare[] } {
  const total = input.participants.reduce((acc, p) => acc + p.amountCents, 0);
  const shares = buildExpenseShares({
    payerMemberIds: [input.payerMemberId],
    payerAmountsCents: [total],
    debtorMemberIds: input.participants.map((p) => p.memberId),
    debtorAmountsCents: input.participants.map((p) => p.amountCents),
  });
  return { total, shares };
}

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  const { total, shares } = netSharesFor(input);
  const created = await prisma.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: {
        groupId: input.groupId,
        description: input.description,
        note: input.note,
        date: new Date(input.dateISO),
        currency: input.currency,
        fxRate: input.fxRate,
        splitMode: input.splitMode,
        createdByMemberId: input.actorMemberId,
        payments: { create: [{ memberId: input.payerMemberId, amountCents: total }] },
        shares: { create: shares.map((s) => ({ memberId: s.memberId, amountCents: s.amountCents })) },
      },
      include: EXPENSE_INCLUDE,
    });
    await writeAudit(tx, input.groupId, input.actorMemberId, `added '${input.description}'`, "create", total, "expense", e.id);
    return e;
  });
  return mapExpense(created);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense | undefined> {
  const { total, shares } = netSharesFor(input);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.expensePayment.deleteMany({ where: { expenseId: id } });
    await tx.expenseShare.deleteMany({ where: { expenseId: id } });
    const e = await tx.expense.update({
      where: { id },
      data: {
        description: input.description,
        note: input.note,
        date: new Date(input.dateISO),
        currency: input.currency,
        fxRate: input.fxRate,
        splitMode: input.splitMode,
        payments: { create: [{ memberId: input.payerMemberId, amountCents: total }] },
        shares: { create: shares.map((s) => ({ memberId: s.memberId, amountCents: s.amountCents })) },
      },
      include: EXPENSE_INCLUDE,
    });
    await writeAudit(tx, input.groupId, input.actorMemberId, `edited '${input.description}'`, "edit", total, "expense", e.id);
    return e;
  });
  return mapExpense(updated);
}

export async function revertExpense(id: string, actorMemberId: string): Promise<void> {
  const e = await prisma.expense.findUnique({
    where: { id },
    select: { groupId: true, description: true, deletedAt: true, payments: { select: { amountCents: true } } },
  });
  if (!e || e.deletedAt) return;
  const total = e.payments.reduce((acc, p) => acc + p.amountCents, 0);
  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, e.groupId, actorMemberId, `reverted '${e.description}'`, "revert", total, "expense", id);
  });
}

export async function recordSettlement(opts: {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  actorMemberId: string;
}): Promise<Settlement> {
  const to = await prisma.groupMember.findUnique({
    where: { id: opts.toMemberId },
    select: { displayName: true },
  });
  const s = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        groupId: opts.groupId,
        fromMemberId: opts.fromMemberId,
        toMemberId: opts.toMemberId,
        amountCents: opts.amountCents,
      },
    });
    await writeAudit(
      tx,
      opts.groupId,
      opts.actorMemberId,
      `paid ${to?.displayName ?? "someone"}`,
      "settle",
      opts.amountCents,
      "settlement",
      created.id,
    );
    return created;
  });
  return {
    id: s.id,
    groupId: s.groupId,
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amountCents: s.amountCents,
    dateISO: s.date.toISOString(),
  };
}

export interface CreateGroupInput {
  name: string;
  baseCurrency: string;
  simplifyDebts: boolean;
  memberNames: string[];
  /** Supabase user creating the group, if signed in. */
  createdByUserId?: string | null;
}

export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const names = input.memberNames.map((n) => n.trim()).filter(Boolean);
  return prisma.group.create({
    data: {
      name: input.name.trim() || "Untitled group",
      baseCurrency: input.baseCurrency,
      shareToken: randomToken(),
      simplifyDebts: input.simplifyDebts,
      createdByUserId: input.createdByUserId ?? null,
      members: { create: names.map((displayName) => ({ displayName })) },
    },
  });
}

export async function updateGroup(
  id: string,
  patch: Partial<Pick<Group, "name" | "baseCurrency" | "simplifyDebts">>,
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.name != null) data.name = patch.name;
  if (patch.baseCurrency != null) data.baseCurrency = patch.baseCurrency;
  if (patch.simplifyDebts != null) data.simplifyDebts = patch.simplifyDebts;
  await prisma.group.update({ where: { id }, data });
}

export async function regenerateShareToken(id: string): Promise<string> {
  const token = randomToken();
  await prisma.group.update({ where: { id }, data: { shareToken: token } });
  return token;
}

export async function deleteGroup(id: string): Promise<void> {
  // Group relations cascade (members, expenses, settlements, audit logs).
  await prisma.group.delete({ where: { id } });
}

/** Claim an existing slot, or create a new one. Returns the acting memberId. */
export async function claimSlot(opts: {
  groupId: string;
  memberId?: string;
  newName?: string;
}): Promise<string> {
  if (opts.memberId) {
    const m = await prisma.groupMember.findUnique({ where: { id: opts.memberId }, select: { id: true } });
    if (m) return m.id;
  }
  const m = await prisma.groupMember.create({
    data: { groupId: opts.groupId, displayName: opts.newName?.trim() || "Guest" },
  });
  return m.id;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function writeAudit(
  tx: Tx,
  groupId: string,
  actorMemberId: string,
  action: string,
  kind: AuditEntry["kind"],
  amountCents?: number,
  entityType?: AuditEntry["entityType"],
  entityId?: string,
) {
  await tx.auditLog.create({
    data: { groupId, actorMemberId, action, kind, amountCents, entityType, entityId },
  });
}

function randomToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
