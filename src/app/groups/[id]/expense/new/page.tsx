import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { ExpenseForm, type ExpenseFormInitial } from "@/components/expense-form";
import { expenseTotalCents, getExpense, getGroup, getMembers } from "@/lib/store";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const group = getGroup(id);
  if (!group) notFound();
  const members = getMembers(id);

  // Prefill when editing an existing expense.
  let initial: ExpenseFormInitial = {};
  if (edit) {
    const e = getExpense(edit);
    if (e && e.groupId === id) {
      const total = expenseTotalCents(e);
      const splitValues: Record<string, string> = {};
      for (const p of e.participants) {
        if (e.splitMode === "percent") {
          splitValues[p.memberId] = total ? ((p.amountCents / total) * 100).toFixed(1) : "0";
        } else if (e.splitMode === "unequal") {
          splitValues[p.memberId] = (p.amountCents / 100).toFixed(2);
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
    <div className="mx-auto w-full max-w-[480px] px-6 py-8">
      <Card className="overflow-hidden">
        <ExpenseForm
          groupId={id}
          groupName={group.name}
          baseCurrency={group.baseCurrency}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          initial={initial}
        />
      </Card>
    </div>
  );
}
