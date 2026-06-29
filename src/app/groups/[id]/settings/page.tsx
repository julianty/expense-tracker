import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Separator } from "@/components/ui";
import { ConfirmSubmit, CopyButton, MemberRow } from "@/components/client";
import { deleteGroupAction } from "@/app/actions";
import { AddMemberForm, GroupInfoForm, RegenerateLinkButton } from "@/components/settings-forms";
import { getGroup, getMembers, isAdmin } from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();
  const members = await getMembers(id);
  const actingMemberId = await getActingMemberId(id);
  const canManage = await isAdmin(id, actingMemberId);
  const shareDisplay = `app.split/g/${group.shareToken}`;

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <Link href={`/groups/${id}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to {group.name}
          </Link>
          <h1 className="mb-5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">Settings</h1>

          {/* group info */}
          <GroupInfoForm
            groupId={id}
            name={group.name}
            baseCurrency={group.baseCurrency}
            simplifyDebts={group.simplifyDebts}
          />

          <Separator className="my-5" />

          {/* share link */}
          <div className="mb-2.5 text-[13px] font-medium">Share link</div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center overflow-hidden rounded-[6px] border border-border bg-muted px-3 font-mono text-xs text-muted-foreground">
              {shareDisplay}
            </div>
            <CopyButton value={`/g/${group.shareToken}`} label="" icon="⧉" className="px-2.5 py-2" />
          </div>
          <RegenerateLinkButton groupId={id} />

          <Separator className="my-5" />

          {/* members */}
          <div className="mb-3 text-[13px] font-medium">Members</div>
          <div className="flex flex-col gap-3">
            {members.map((m, i) => (
              <MemberRow
                key={m.id}
                seed={i}
                groupId={id}
                canManage={canManage}
                isSelf={m.id === actingMemberId}
                member={{
                  id: m.id,
                  displayName: m.displayName,
                  claimedEmail: m.claimedEmail,
                  taken: !!m.claimedAtISO || m.accountLinked,
                  accountLinked: m.accountLinked,
                }}
              />
            ))}
          </div>

          <AddMemberForm groupId={id} />

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
