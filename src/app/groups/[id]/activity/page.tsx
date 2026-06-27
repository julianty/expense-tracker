import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { revertExpenseAction } from "@/app/actions";
import {
  canRevertExpense,
  currentMemberId,
  getAudit,
  getExpense,
  getGroup,
  getMember,
  memberIndex,
} from "@/lib/store";
import { formatCents, formatDateTime } from "@/lib/format";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getGroup(id);
  if (!group) notFound();
  const audit = getAudit(id);
  const me = currentMemberId(id);

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 py-8">
      <Card className="overflow-hidden">
        <div className="p-6">
          <Link href={`/groups/${id}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to {group.name}
          </Link>
          <h1 className="mb-3.5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">Activity</h1>

          <div className="flex flex-col">
            {audit.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            )}
            {audit.map((a, idx) => {
              const actor = getMember(a.actorMemberId);
              // Can revert a non-reverted expense creation that's still live.
              const liveExpense =
                a.kind === "create" && a.entityType === "expense" && a.entityId
                  ? getExpense(a.entityId)
                  : undefined;
              const canRevert =
                liveExpense && !liveExpense.deleted && canRevertExpense(liveExpense.id, me);

              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 py-3.5 ${
                    idx < audit.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <Avatar name={actor?.displayName ?? "?"} seed={memberIndex(id, a.actorMemberId)} />
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
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(a.createdISO)}
                    </div>
                  </div>

                  {a.kind === "revert" && (
                    <span className="rounded-[6px] bg-owe-bg px-2 py-0.5 text-[11px] font-medium text-owe">
                      revert
                    </span>
                  )}
                  {canRevert && (
                    <ConfirmSubmit
                      action={revertExpenseAction}
                      fields={{ groupId: id, expenseId: a.entityId! }}
                      triggerLabel="Revert"
                      triggerVariant="ghost"
                      triggerClassName="px-2 py-1 text-xs"
                      title="Revert this entry?"
                      description={`This reverses '${liveExpense?.description}' and recomputes everyone's balances. The revert itself is logged.`}
                      confirmLabel="Revert"
                      confirmVariant="destructive"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
