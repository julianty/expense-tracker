import Link from "next/link";
import { redirect } from "next/navigation";
import { getGroupByToken, getMembers } from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";
import { ShareEntryForm } from "./share-entry-form";

export default async function ShareLinkEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const group = await getGroupByToken(token);

  // Already in this group (a signed-in member, or a returning guest whose
  // share_token + member_id cookies still match)? Skip the claim form and go in.
  if (group && (await getActingMemberId(group.id))) {
    redirect(`/groups/${group.id}`);
  }

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

  const members = await getMembers(group.id);

  return (
    <div className="flex min-h-full items-center justify-center bg-[#FAFAFA] px-4 py-12">
      <ShareEntryForm
        groupId={group.id}
        groupName={group.name}
        token={token}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          claimed: !!m.claimedEmail,
        }))}
      />
    </div>
  );
}
