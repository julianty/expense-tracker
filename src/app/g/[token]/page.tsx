import Link from "next/link";
import { cookies } from "next/headers";
import { getGroupByToken, getMembers } from "@/lib/store";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { slotFlags } from "@/lib/membership";
import { ShareEntryForm } from "./share-entry-form";

export default async function ShareLinkEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reselect?: string; error?: string }>;
}) {
  const [{ token }, { reselect, error }] = await Promise.all([params, searchParams]);
  const group = await getGroupByToken(token);

  if (!group) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-4 py-12">
        <div className="w-[320px] rounded-[12px] border border-border bg-background p-6 text-center">
          <div className="text-lg font-medium">Invalid link</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This share link doesn&apos;t match any group. Ask the group owner for a fresh one.
          </p>
          <Link href="/" className="mt-4 inline-block text-[13px] font-medium text-accent underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // Check if this visitor is already identified in this group.
  let existingName: string | null = null;
  const user = await getSessionUser();
  if (user) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId: group.id, claimedByUserId: user.id },
      select: { displayName: true },
    });
    if (member) existingName = member.displayName;
  } else {
    const jar = await cookies();
    const cookieToken = jar.get("share_token")?.value;
    const cookieMemberId = jar.get("member_id")?.value;
    if (cookieToken === group.shareToken && cookieMemberId) {
      const member = await prisma.groupMember.findFirst({
        where: { id: cookieMemberId, groupId: group.id },
        select: { displayName: true },
      });
      if (member) existingName = member.displayName;
    }
  }

  // Already identified — show a "you're in as X" screen unless they asked to reselect.
  if (existingName && !reselect) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-4 py-12">
        <div className="w-[320px] rounded-[12px] border border-border bg-background p-6 text-center">
          <div className="text-lg font-medium">{group.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re in this group as <span className="font-medium text-foreground">{existingName}</span>.
          </p>
          <Link
            href={`/groups/${group.id}`}
            className="mt-4 flex h-[38px] items-center justify-center rounded-[6px] bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
          >
            Go to group
          </Link>
          <Link
            href={`/g/${token}?reselect=1`}
            className="mt-3 block text-[12px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Not {existingName}? Re-select
          </Link>
        </div>
      </div>
    );
  }

  const members = await getMembers(group.id);

  return (
    <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-4 py-12">
      <ShareEntryForm
        groupId={group.id}
        groupName={group.name}
        token={token}
        error={error}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          ...slotFlags(m),
        }))}
      />
    </div>
  );
}
