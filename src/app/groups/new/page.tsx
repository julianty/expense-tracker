"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { createGroupAction } from "@/app/actions";
import { CURRENCIES } from "@/lib/format";

export default function NewGroupPage() {
  const [members, setMembers] = useState<string[]>(["Alex", "Bo"]);
  const [simplify, setSimplify] = useState(true);

  const setName = (i: number, v: string) =>
    setMembers((m) => m.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => setMembers((m) => m.filter((_, idx) => idx !== i));

  return (
    <div className="mx-auto w-full max-w-[480px] px-6 py-8">
      <Card className="overflow-hidden">
        <form action={createGroupAction} className="p-6">
          <Link href="/groups" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to groups
          </Link>
          <h1 className="mb-5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">New group</h1>

          <div className="flex flex-col gap-[18px]">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Group name</label>
              <input
                name="name"
                placeholder="e.g. Tahoe trip"
                className="h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Base currency</label>
              <select
                name="baseCurrency"
                defaultValue="USD"
                className="h-9 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start justify-between gap-3.5">
              <div>
                <div className="text-sm font-medium">Simplify debts</div>
                <div className="mt-0.5 max-w-[280px] text-[13px] text-muted-foreground">
                  Reduce the number of payments needed to settle up.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimplify((s) => !s)}
                className="relative h-6 w-[42px] shrink-0 rounded-full transition-colors"
                style={{ background: simplify ? "#C57C24" : "#E4E4E7" }}
                aria-pressed={simplify}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                  style={{ left: simplify ? 20 : 2 }}
                />
              </button>
              {simplify && <input type="hidden" name="simplifyDebts" value="on" />}
            </div>

            <div>
              <label className="mb-2.5 block text-[13px] font-medium">Members</label>
              <div className="flex flex-col gap-2.5">
                {members.map((name, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Avatar name={name || "?"} seed={i} />
                    <input
                      name="memberName"
                      value={name}
                      onChange={(e) => setName(i, e.target.value)}
                      placeholder="Name"
                      className="h-9 flex-1 rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="cursor-pointer text-base text-muted-foreground hover:text-foreground"
                      aria-label="Remove member"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMembers((m) => [...m, ""])}
                className="mt-2.5 cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                + Add member
              </button>
            </div>

            <div className="flex justify-end border-t border-border pt-[18px]">
              <button
                type="submit"
                className="cursor-pointer rounded-[6px] bg-accent px-[18px] py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
              >
                Create group
              </button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
