import Link from "next/link";
import { getGroupByToken, getMembers } from "@/lib/store";
import { ShareEntryForm } from "./share-entry-form";

export default async function ShareLinkEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
