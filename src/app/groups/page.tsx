import Link from "next/link";
import { AvatarStack, BalanceChip, Card, LinkButton } from "@/components/ui";
import { currentMemberId, getBalances, getGroups, getMembers } from "@/lib/store";

export default async function GroupsPage() {
  const groups = await getGroups();
  const rows = await Promise.all(
    groups.map(async (g) => ({
      group: g,
      members: await getMembers(g.id),
      youBalance: (await getBalances(g.id)).get(await currentMemberId(g.id)) ?? 0,
    })),
  );

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 py-8">
      <Card className="overflow-hidden">
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium tracking-[-0.01em]">Your groups</h1>
            <LinkButton href="/groups/new" variant="outline" className="px-3 py-1.5 text-[13px]">
              New group
            </LinkButton>
          </div>

          {groups.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No groups yet. Create one to start splitting expenses.
            </p>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              {rows.map(({ group: g, members, youBalance }) => {
                return (
                  <Link key={g.id} href={`/groups/${g.id}`}>
                    <Card className="flex items-center justify-between p-4 transition-shadow hover:shadow-md">
                      <div>
                        <div className="text-base font-medium">{g.name}</div>
                        <div className="mt-2">
                          <AvatarStack members={members} />
                        </div>
                      </div>
                      <BalanceChip balanceCents={youBalance} currency={g.baseCurrency} />
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
