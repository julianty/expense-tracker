import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, LinkButton, Separator } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { revertExpenseAction } from "@/app/actions";
import {
  canRevertExpense,
  expenseTotalCents,
  getExpense,
  getGroup,
  getMembers,
} from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";
import { getSignedReceiptUrl } from "@/lib/storage";
import { formatCents, formatLongDate } from "@/lib/format";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const [group, expense, members] = await Promise.all([getGroup(id), getExpense(expenseId), getMembers(id)]);
  if (!group || !expense || expense.groupId !== id) notFound();

  const memberById = new Map(members.map((m) => [m.id, m]));
  const idxById = new Map(members.map((m, i) => [m.id, i]));

  const total = expenseTotalCents(expense);
  const me = await getActingMemberId(id);
  const mayUndo = await canRevertExpense(expense.id, me);
  const payer = memberById.get(expense.payments[0]?.memberId);
  // Debtors = participants who aren't the payer (net owed to payer).
  const debtors = expense.participants.filter((p) => p.memberId !== payer?.id && p.amountCents > 0);
  // Signed URL for a private receipt; null if no receipt or storage not configured.
  const receiptUrl = expense.imageUrl ? await getSignedReceiptUrl(expense.imageUrl) : null;

  return (
    <div className="mx-auto w-full max-w-[460px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <Link href={`/groups/${id}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to {group.name}
          </Link>

          <div className="mb-0.5 mt-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0 truncate text-xl font-medium">{expense.description}</div>
            <div className="shrink-0 text-xl font-medium tnum">{formatCents(total, group.baseCurrency)}</div>
          </div>
          <div className="text-[13px] text-muted-foreground">{formatLongDate(expense.dateISO)}</div>
          {expense.currency !== group.baseCurrency && (
            <div className="mt-1 text-[13px] text-muted-foreground">
              Entered in {expense.currency} · rate {expense.fxRate}
            </div>
          )}

          <Separator className="my-[18px]" />

          <div className="mb-3 text-[13px] font-medium">Paid by</div>
          <div className="flex items-center gap-2.5 text-sm">
            <Avatar name={payer?.displayName ?? "?"} seed={idxById.get(payer?.id ?? "") ?? 0} />
            {payer?.displayName}
            <span className="ml-auto font-medium tnum">{formatCents(total, group.baseCurrency)}</span>
          </div>

          <div className="mb-3 mt-5 text-[13px] font-medium">Owes</div>
          <div className="flex flex-col gap-3">
            {debtors.map((d) => {
              const m = memberById.get(d.memberId);
              return (
                <div key={d.memberId} className="flex items-center gap-2.5 text-sm">
                  <Avatar name={m?.displayName ?? "?"} seed={idxById.get(d.memberId) ?? 0} />
                  {m?.displayName}
                  <span className="ml-auto text-owe tnum">
                    {formatCents(d.amountCents, group.baseCurrency)}
                  </span>
                </div>
              );
            })}
          </div>

          {expense.note && (
            <p className="mt-4 rounded-[6px] bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              {expense.note}
            </p>
          )}

          {/* receipt */}
          {receiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptUrl}
              alt="Receipt"
              className="my-[18px] max-h-80 w-full rounded-lg border border-border object-contain"
            />
          ) : (
            <div
              className="my-[18px] flex h-24 items-center justify-center rounded-lg border border-border font-mono text-xs text-muted-foreground"
              style={{
                background:
                  "repeating-linear-gradient(45deg,#FAFAFA,#FAFAFA 10px,#F4F4F5 10px,#F4F4F5 20px)",
              }}
            >
              {expense.imageUrl ? "Receipt attached — storage not configured" : "No receipt attached"}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-[18px]">
            <LinkButton
              href={`/groups/${id}/expense/new?edit=${expense.id}`}
              variant="outline"
              className="px-4 py-2"
            >
              Edit
            </LinkButton>
            {mayUndo ? (
              <ConfirmSubmit
                action={revertExpenseAction}
                fields={{ groupId: id, expenseId: expense.id }}
                triggerLabel="Undo"
                triggerVariant="destructive"
                title="Undo this expense?"
                description={`'${expense.description}' (${formatCents(
                  total,
                  group.baseCurrency,
                )}) will be removed and everyone's balances recomputed. A revert entry is added to the activity log.`}
                confirmLabel="Undo expense"
                confirmVariant="destructive"
              />
            ) : (
              <span className="px-4 py-2 text-xs text-muted-foreground">
                Only {memberById.get(expense.createdByMemberId)?.displayName} or an admin can undo
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
