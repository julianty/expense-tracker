import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Button, Card, Separator } from "@/components/ui";
import { ConfirmSubmit, CopyButton } from "@/components/client";
import { deleteGroupAction, regenerateLinkAction, updateGroupAction } from "@/app/actions";
import { getGroup, getMembers } from "@/lib/store";
import { CURRENCIES } from "@/lib/format";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getGroup(id);
  if (!group) notFound();
  const members = getMembers(id);
  const shareDisplay = `app.split/g/${group.shareToken}`;

  const inputCls =
    "h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 py-8">
      <Card className="overflow-hidden">
        <div className="p-6">
          <Link href={`/groups/${id}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to {group.name}
          </Link>
          <h1 className="mb-5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">Settings</h1>

          {/* group info */}
          <form action={updateGroupAction}>
            <input type="hidden" name="groupId" value={id} />
            <div className="mb-2.5 text-[13px] font-medium">Group info</div>
            <div className="flex flex-col gap-2.5">
              <input name="name" defaultValue={group.name} className={inputCls} />
              <select
                name="baseCurrency"
                defaultValue={group.baseCurrency}
                className="h-9 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="simplifyDebts"
                  defaultChecked={group.simplifyDebts}
                  className="h-4 w-4 accent-[#C57C24]"
                />
                Simplify debts
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" className="px-4 py-1.5 text-[13px]">
                Save changes
              </Button>
            </div>
          </form>

          <Separator className="my-5" />

          {/* share link */}
          <div className="mb-2.5 text-[13px] font-medium">Share link</div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center overflow-hidden rounded-[6px] border border-border bg-muted px-3 font-mono text-xs text-muted-foreground">
              {shareDisplay}
            </div>
            <CopyButton value={`/g/${group.shareToken}`} label="" icon="⧉" className="px-2.5 py-2" />
          </div>
          <form action={regenerateLinkAction} className="mt-2.5">
            <input type="hidden" name="groupId" value={id} />
            <button
              type="submit"
              className="cursor-pointer text-[13px] font-medium text-owe hover:underline"
            >
              Regenerate link
            </button>
          </form>

          <Separator className="my-5" />

          {/* members */}
          <div className="mb-3 text-[13px] font-medium">Members</div>
          <div className="flex flex-col gap-3">
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <Avatar name={m.displayName} seed={i} />
                <div className="flex-1">
                  <div className="text-sm">{m.displayName}</div>
                  {m.claimedEmail && (
                    <div className="text-xs text-muted-foreground">{m.claimedEmail}</div>
                  )}
                </div>
                {m.claimedEmail ? (
                  <span className="rounded-[6px] bg-owed-bg px-2 py-0.5 text-[11px] font-medium text-owed">
                    claimed
                  </span>
                ) : (
                  <span className="rounded-[6px] bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    unclaimed
                  </span>
                )}
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          {/* danger zone */}
          <div className="mb-1.5 text-[13px] font-medium text-owe">Danger zone</div>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Deleting a group removes all expenses and history. This can&apos;t be undone.
          </p>
          <ConfirmSubmit
            action={deleteGroupAction}
            fields={{ groupId: id }}
            triggerLabel="Delete group"
            triggerVariant="destructive"
            title="Delete this group?"
            description={`'${group.name}' and all its expenses, settlements, and history will be permanently removed. This can't be undone.`}
            confirmLabel="Delete group"
            confirmVariant="destructive"
          />
        </div>
      </Card>
    </div>
  );
}
