import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { ExpenseForm, type ExpenseFormInitial } from "@/components/expense-form";
import { expenseTotalCents, getExpense, getGroup, getMembers } from "@/lib/store";
import { getRatesToBase } from "@/lib/fx";
import { getActingMemberId } from "@/lib/auth";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const group = await getGroup(id);
  if (!group) notFound();
  const [members, rates] = await Promise.all([getMembers(id), getRatesToBase(group.baseCurrency)]);

  // Default the payer to whoever is adding the expense (their claimed slot or
  // share-link guest slot); the form falls back to the first member for anyone
  // without a resolvable slot. Overridden below when editing.
  const actingMemberId = await getActingMemberId(id);

  // Prefill when editing an existing expense.
  let initial: ExpenseFormInitial = actingMemberId ? { payerMemberId: actingMemberId } : {};
  if (edit) {
    const e = await getExpense(edit);
    if (e && e.groupId === id) {
      const total = expenseTotalCents(e);
      const splitValues: Record<string, string> = {};
      // For "equal +", recover each member's surcharge as their gross minus the
      // equal base — the base is the smallest gross share (a member with no extra).
      const equalExtraBase =
        e.splitMode === "equalExtra" && e.participants.length
          ? Math.min(...e.participants.map((p) => p.amountCents))
          : 0;
      for (const p of e.participants) {
        if (e.splitMode === "percent") {
          splitValues[p.memberId] = total ? ((p.amountCents / total) * 100).toFixed(1) : "0";
        } else if (e.splitMode === "unequal") {
          splitValues[p.memberId] = (p.amountCents / 100).toFixed(2);
        } else if (e.splitMode === "equalExtra") {
          const extra = p.amountCents - equalExtraBase;
          if (extra > 0) splitValues[p.memberId] = (extra / 100).toFixed(2);
        }
      }
      initial = {
        expenseId: e.id,
        description: e.description,
        amount: (Math.round(total / e.fxRate) / 100).toFixed(2),
        currency: e.currency,
        fxRate: String(e.fxRate),
        payerMemberId: e.payments[0]?.memberId,
        splitMode: e.splitMode,
        note: e.note,
        date: e.dateISO.slice(0, 10),
        splitValues,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <ExpenseForm
          groupId={id}
          groupName={group.name}
          baseCurrency={group.baseCurrency}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          rates={rates}
          initial={initial}
        />
      </Card>
    </div>
  );
}
