import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { ItemizedExpenseForm } from "@/components/itemized-expense-form";
import { getGroup, getMembers } from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";

export default async function ItemizedExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();
  const [members, actingMemberId] = await Promise.all([getMembers(id), getActingMemberId(id)]);

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <ItemizedExpenseForm
          groupId={id}
          groupName={group.name}
          baseCurrency={group.baseCurrency}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          defaultPayerId={actingMemberId}
        />
      </Card>
    </div>
  );
}
