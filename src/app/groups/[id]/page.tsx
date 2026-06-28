import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, BalanceChip, Card, LinkButton, Separator } from "@/components/ui";
import { AddExpenseFab, CopyButton, Tabs } from "@/components/client";
import {
  expenseTotalCents,
  getAudit,
  getBalances,
  getExpenses,
  getGroup,
  getMembers,
  type Expense,
} from "@/lib/store";
import { formatCents, formatShortDate, formatDateTime } from "@/lib/format";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const [members, balances, expenses, allAudit] = await Promise.all([
    getMembers(id),
    getBalances(id),
    getExpenses(id),
    getAudit(id),
  ]);
  const audit = allAudit.slice(0, 6);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const idxById = new Map(members.map((m, i) => [m.id, i]));

  // Inner content shared by standalone rows and the items inside a batch.
  const expenseRowInner = (e: Expense) => {
    const payer = memberById.get(e.payments[0]?.memberId);
    return (
      <>
        <Avatar name={payer?.displayName ?? "?"} seed={idxById.get(payer?.id ?? "") ?? 0} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{e.description}</div>
          <div className="mt-px truncate text-xs text-muted-foreground">
            {payer?.displayName} · {formatShortDate(e.dateISO)}
          </div>
        </div>
        <span className="flex shrink-0 flex-col items-end leading-tight tnum">
          {e.currency !== group.baseCurrency && (
            <span className="text-xs text-muted-foreground">
              {formatCents(Math.round(expenseTotalCents(e) / e.fxRate), e.currency)} →
            </span>
          )}
          <span className="text-sm font-medium">
            {formatCents(expenseTotalCents(e), group.baseCurrency)}
          </span>
        </span>
      </>
    );
  };

  // Collapse line items sharing a batchId into one expandable row (kept at the
  // position of the batch's first item; standalone expenses render as before).
  type Row = { kind: "single"; expense: Expense } | { kind: "batch"; batchId: string; items: Expense[] };
  const rows: Row[] = [];
  const batchAt = new Map<string, number>();
  for (const e of expenses) {
    if (e.batchId) {
      const at = batchAt.get(e.batchId);
      if (at == null) {
        batchAt.set(e.batchId, rows.length);
        rows.push({ kind: "batch", batchId: e.batchId, items: [e] });
      } else {
        (rows[at] as { items: Expense[] }).items.push(e);
      }
    } else {
      rows.push({ kind: "single", expense: e });
    }
  }

  const expensesTab = (
    <div className="mt-1.5 flex flex-col">
      {expenses.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No expenses yet. Add the first one.
        </p>
      )}
      {rows.map((row, idx) => {
        const border = idx < rows.length - 1 ? "border-b border-border" : "";
        if (row.kind === "single") {
          return (
            <Link
              key={row.expense.id}
              href={`/groups/${id}/expense/${row.expense.id}`}
              className={`flex items-center gap-3 py-3.5 ${border}`}
            >
              {expenseRowInner(row.expense)}
            </Link>
          );
        }
        const batchTotal = row.items.reduce((acc, e) => acc + expenseTotalCents(e), 0);
        const n = row.items.length;
        const title = row.items.map((e) => e.description).slice(0, 2).join(", ");
        return (
          <details key={row.batchId} className={`group/batch ${border}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{title || "Itemized expense"}</div>
                <div className="mt-px truncate text-xs text-muted-foreground">
                  {n} items · {formatShortDate(row.items[0].dateISO)}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium tnum">
                {formatCents(batchTotal, group.baseCurrency)}
              </span>
              <span className="shrink-0 text-muted-foreground transition-transform group-open/batch:rotate-90">
                ▸
              </span>
            </summary>
            <div className="ml-4 border-l border-border pl-3">
              {row.items.map((e) => (
                <Link
                  key={e.id}
                  href={`/groups/${id}/expense/${e.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  {expenseRowInner(e)}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );

  const activityTab = (
    <div className="mt-1.5 flex flex-col">
      {audit.map((a, idx) => {
        const actor = memberById.get(a.actorMemberId);
        return (
          <div
            key={a.id}
            className={`flex gap-3 py-3.5 ${idx < audit.length - 1 ? "border-b border-border" : ""}`}
          >
            <Avatar name={actor?.displayName ?? "?"} seed={idxById.get(a.actorMemberId) ?? 0} />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">{actor?.displayName}</span> {a.action}
                {a.amountCents != null && (
                  <>
                    {" · "}
                    <span className="tnum">{formatCents(a.amountCents, group.baseCurrency)}</span>
                  </>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.createdISO)}</div>
            </div>
          </div>
        );
      })}
      <Link
        href={`/groups/${id}/activity`}
        className="py-3 text-center text-[13px] font-medium text-accent"
      >
        View full activity
      </Link>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[500px] px-4 py-8 sm:px-6">
      <Card className="relative overflow-hidden">
        {/* extra bottom padding so the floating + button never covers content */}
        <div className="px-4 pb-24 pt-6 sm:px-6">
          <Link
            href="/groups"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Your groups
          </Link>
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-2xl font-medium tracking-[-0.01em]">{group.name}</span>
              <span className="shrink-0 rounded-[6px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {group.baseCurrency}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <CopyButton value={`/g/${group.shareToken}`} />
              <Link
                href={`/groups/${id}/settings`}
                className="inline-flex items-center rounded-[6px] border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                ⚙
              </Link>
            </div>
          </div>

          {/* balances */}
          <Card className="mt-[18px] p-4 shadow-none">
            <div className="mb-3.5 text-[13px] font-medium">Balances</div>
            <div className="flex flex-col gap-3.5">
              {members.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.displayName} seed={i} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.displayName}</span>
                  <span className="shrink-0">
                    <BalanceChip balanceCents={balances.get(m.id) ?? 0} currency={group.baseCurrency} />
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <LinkButton href={`/groups/${id}/settle`} variant="outline" className="w-full py-2">
              Settle up
            </LinkButton>
          </Card>

          {/* tabs */}
          <div className="mt-5">
            <Tabs
              tabs={[
                { label: "Expenses", content: expensesTab },
                { label: "Activity", content: activityTab },
              ]}
            />
          </div>
        </div>

        {/* FAB → single or itemized expense */}
        <AddExpenseFab groupId={id} />
      </Card>
    </div>
  );
}
