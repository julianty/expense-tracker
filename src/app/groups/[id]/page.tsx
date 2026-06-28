import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, BalanceChip, Card, LinkButton, Separator } from "@/components/ui";
import { CopyButton, Tabs } from "@/components/client";
import {
  expenseTotalCents,
  getAudit,
  getBalances,
  getExpenses,
  getGroup,
  getMembers,
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

  const expensesTab = (
    <div className="mt-1.5 flex flex-col">
      {expenses.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No expenses yet. Add the first one.
        </p>
      )}
      {expenses.map((e, idx) => {
        const payer = memberById.get(e.payments[0]?.memberId);
        return (
          <Link
            key={e.id}
            href={`/groups/${id}/expense/${e.id}`}
            className={`flex items-center gap-3 py-3.5 ${
              idx < expenses.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <Avatar
              name={payer?.displayName ?? "?"}
              seed={idxById.get(payer?.id ?? "") ?? 0}
            />
            <div className="flex-1">
              <div className="text-sm">{e.description}</div>
              <div className="mt-px text-xs text-muted-foreground">
                {payer?.displayName} · {formatShortDate(e.dateISO)}
              </div>
            </div>
            <span className="text-sm font-medium tnum">
              {formatCents(expenseTotalCents(e), group.baseCurrency)}
            </span>
          </Link>
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
    <div className="mx-auto w-full max-w-[500px] px-6 py-8">
      <Card className="relative overflow-hidden">
        {/* extra bottom padding so the floating + button never covers content */}
        <div className="px-6 pb-24 pt-6">
          {/* header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Link href="/groups" className="text-2xl font-medium tracking-[-0.01em] hover:opacity-70">
                {group.name}
              </Link>
              <span className="rounded-[6px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {group.baseCurrency}
              </span>
            </div>
            <div className="flex gap-2">
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
                  <span className="flex-1 text-sm">{m.displayName}</span>
                  <BalanceChip balanceCents={balances.get(m.id) ?? 0} currency={group.baseCurrency} />
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

        {/* FAB */}
        <Link
          href={`/groups/${id}/expense/new`}
          className="absolute bottom-5 right-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-[28px] leading-none text-accent-foreground shadow-lg transition-colors hover:bg-[#b06f1f]"
          aria-label="Add expense"
        >
          +
        </Link>
      </Card>
    </div>
  );
}
