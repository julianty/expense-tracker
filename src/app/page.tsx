import Link from "next/link";
import { Avatar, BalanceChip, Card, LinkButton } from "@/components/ui";
import { getBalances, getGroup, getMembers } from "@/lib/store";

export default function LandingPage() {
  const demo = getGroup("tahoe");
  const members = demo ? getMembers(demo.id) : [];
  const balances = demo ? getBalances(demo.id) : new Map<string, number>();

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 py-6">
      <Card className="overflow-hidden">
        {/* top nav */}
        <div className="flex items-center justify-between border-b border-border px-7 py-[18px]">
          <div className="text-[17px] font-medium">Splitwise-lite</div>
          <div className="flex items-center gap-2.5">
            <LinkButton href="/login" variant="outline" className="px-3.5 py-2">
              Sign in
            </LinkButton>
            <LinkButton href="/groups" className="px-3.5 py-2">
              Try the demo
            </LinkButton>
          </div>
        </div>

        {/* hero + preview */}
        <div className="grid gap-8 px-7 pb-10 pt-11 md:grid-cols-[1fr_300px]">
          <div>
            <h1 className="text-[36px] font-medium leading-[1.15] tracking-[-0.02em]">
              Split expenses without the spreadsheet.
            </h1>
            <p className="mt-3.5 max-w-[380px] text-base leading-relaxed text-muted-foreground">
              Track who paid, who owes, and settle up in a tap. Multi-currency, simplified debts,
              shareable by link — no account needed for guests.
            </p>
            <div className="mt-6 flex gap-2.5">
              <LinkButton href="/groups" className="px-[18px] py-2.5">
                Try the demo
              </LinkButton>
              <LinkButton href="/login" variant="outline" className="px-[18px] py-2.5">
                Sign in
              </LinkButton>
            </div>
          </div>

          {/* demo preview card */}
          {demo && (
            <Link href={`/groups/${demo.id}`}>
              <Card className="relative p-4 transition-shadow hover:shadow-md">
                <span className="absolute right-3 top-3 rounded-[6px] bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  demo
                </span>
                <div className="text-[15px] font-medium">{demo.name}</div>
                <div className="mt-px text-xs text-muted-foreground">
                  {members.length} members · {demo.baseCurrency}
                </div>
                <div className="my-3.5 h-px bg-border" />
                <div className="flex flex-col gap-3">
                  {members.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <Avatar name={m.displayName} seed={i} size={28} />
                      <span className="flex-1 text-[13px]">{m.displayName}</span>
                      <BalanceChip
                        balanceCents={balances.get(m.id) ?? 0}
                        currency={demo.baseCurrency}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
