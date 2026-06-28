import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { recordSettlementAction } from "@/app/actions";
import { canSettle, getGroup, getMembers, getSimplifiedPayments } from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";
import { formatCents } from "@/lib/format";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const [payments, me, members] = await Promise.all([
    getSimplifiedPayments(id),
    getActingMemberId(id),
    getMembers(id),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const idxById = new Map(members.map((m, i) => [m.id, i]));

  return (
    <div className="mx-auto w-full max-w-[460px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <Link href={`/groups/${id}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to {group.name}
          </Link>
          <h1 className="mb-1.5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">Settle up</h1>
          <p className="mb-[18px] text-sm text-muted-foreground">
            {payments.length === 0
              ? "Everyone's settled up — nothing to pay."
              : group.simplifyDebts
                ? `${payments.length} payment${payments.length > 1 ? "s" : ""} clear all balances.`
                : `${payments.length} payment${payments.length > 1 ? "s" : ""} to settle up.`}
          </p>

          <div className="flex flex-col gap-3">
            {payments.map((p, i) => {
              const from = memberById.get(p.fromMemberId);
              const to = memberById.get(p.toMemberId);
              const amount = formatCents(p.amountCents, group.baseCurrency);
              const mayRecord = canSettle(p.fromMemberId, p.toMemberId, me);
              return (
                <Card key={i} className="flex items-center gap-3 p-3 shadow-none sm:p-4">
                  <div className="flex shrink-0 items-center gap-2">
                    <Avatar name={from?.displayName ?? "?"} seed={idxById.get(p.fromMemberId) ?? 0} />
                    <span className="text-muted-foreground">→</span>
                    <Avatar name={to?.displayName ?? "?"} seed={idxById.get(p.toMemberId) ?? 0} />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {from?.displayName} pays {to?.displayName}{" "}
                    <span className="font-medium tnum">{amount}</span>
                  </div>
                  {mayRecord ? (
                    <ConfirmSubmit
                      action={recordSettlementAction}
                      fields={{
                        groupId: id,
                        fromMemberId: p.fromMemberId,
                        toMemberId: p.toMemberId,
                        amountCents: String(p.amountCents),
                      }}
                      triggerLabel="Record"
                      triggerVariant="outline"
                      triggerClassName="shrink-0 px-3 py-1.5 text-xs"
                      title="Record this payment?"
                      description={`${from?.displayName} paid ${to?.displayName} ${amount}. This updates everyone's balances and adds an entry to the activity log.`}
                      confirmLabel="Confirm"
                    />
                  ) : (
                    <span
                      className="shrink-0 cursor-not-allowed rounded-[6px] border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-60"
                      title="Only the payer or payee can record this payment"
                    >
                      Record
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
