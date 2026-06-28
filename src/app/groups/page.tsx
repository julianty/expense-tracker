import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarStack, BalanceChip, Card, LinkButton } from "@/components/ui";
import { getBalances, getGroups, getMembers } from "@/lib/store";
import { getActingMemberId } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { signOutAction } from "@/app/auth-actions";

export default async function GroupsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const groups = await getGroups(user.id);
  const rows = await Promise.all(
    groups.map(async (g) => ({
      group: g,
      members: await getMembers(g.id),
      youBalance: (await getBalances(g.id)).get(await getActingMemberId(g.id)) ?? 0,
    })),
  );

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-8 sm:px-6">
      <Card className="overflow-hidden">
        <div className="px-4 pb-5 pt-6 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium tracking-[-0.01em]">Your groups</h1>
            <div className="flex items-center gap-2">
              <LinkButton href="/groups/new" variant="outline" className="px-3 py-1.5 text-[13px]">
                New group
              </LinkButton>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="cursor-pointer rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={`Signed in as ${user.email}`}
                >
                  Sign out
                </button>
              </form>
            </div>
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
