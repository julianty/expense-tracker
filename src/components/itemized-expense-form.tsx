"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { saveExpenseBatchAction } from "@/app/actions";
import { currencySymbol, formatCents } from "@/lib/format";
import { resolveParticipants, toCents } from "@/lib/splits";
import type { SplitMode } from "@/lib/store";

interface MemberLite {
  id: string;
  displayName: string;
}

const MODES: Array<{ key: SplitMode; label: string }> = [
  { key: "equal", label: "Equal" },
  { key: "equalExtra", label: "Equal +" },
  { key: "unequal", label: "Unequal" },
  { key: "percent", label: "%" },
];

interface Item {
  /** Stable local key for React lists. */
  key: string;
  description: string;
  amount: string;
  payerMemberId: string;
  splitMode: SplitMode;
  splitValues: Record<string, string>;
}

let counter = 0;
function newItem(payerMemberId: string): Item {
  counter += 1;
  return { key: `i${counter}`, description: "", amount: "", payerMemberId, splitMode: "equal", splitValues: {} };
}

export function ItemizedExpenseForm({
  groupId,
  groupName,
  baseCurrency,
  members,
  defaultPayerId,
}: {
  groupId: string;
  groupName: string;
  baseCurrency: string;
  members: MemberLite[];
  defaultPayerId: string;
}) {
  const payerSeed = defaultPayerId || members[0]?.id || "";
  const memberIds = members.map((m) => m.id);

  const [label, setLabel] = useState("");
  const [items, setItems] = useState<Item[]>([newItem(payerSeed), newItem(payerSeed)]);

  function patchItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function setSplitValue(key: string, memberId: string, value: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.key === key ? { ...it, splitValues: { ...it.splitValues, [memberId]: value } } : it,
      ),
    );
  }

  // Per-item resolved allocation + validity, in base-currency cents.
  function resolveItem(it: Item) {
    const totalCents = toCents(Number(it.amount) || 0);
    const rawValues = memberIds.map((id) => Number(it.splitValues[id]) || 0);
    const allocation = resolveParticipants(totalCents, memberIds, it.splitMode, rawValues, it.payerMemberId);
    const centsById = new Map(allocation.map((a) => [a.memberId, a.amountCents]));

    let ok = totalCents > 0;
    let label = "Balanced ✓";
    if (it.splitMode === "equalExtra") {
      const extras = rawValues.reduce((a, b) => a + toCents(b), 0);
      ok = ok && extras <= totalCents;
      if (!ok && totalCents > 0) label = "Extras exceed total";
    } else if (it.splitMode === "percent") {
      const sum = rawValues.reduce((a, b) => a + b, 0);
      ok = ok && Math.abs(sum - 100) < 0.001;
      if (!ok && totalCents > 0) label = `${(100 - sum).toFixed(1)}% ${sum > 100 ? "over" : "left"}`;
    } else if (it.splitMode === "unequal") {
      const sum = rawValues.reduce((a, b) => a + toCents(b), 0);
      ok = ok && sum === totalCents;
      if (!ok && totalCents > 0) {
        const diff = totalCents - sum;
        label = `${formatCents(Math.abs(diff), baseCurrency)} ${diff < 0 ? "over" : "left"}`;
      }
    }
    return { centsById, ok, label, totalCents };
  }

  const resolved = items.map(resolveItem);
  const filled = items.filter((_, i) => resolved[i].totalCents > 0);
  const grandTotal = resolved.reduce((acc, r) => acc + (r.totalCents > 0 ? r.totalCents : 0), 0);
  const allValid = filled.length > 0 && items.every((_, i) => resolved[i].totalCents === 0 || resolved[i].ok);

  // What the server action parses (amounts/splits resolved server-side).
  const payload = JSON.stringify(
    filled.map((it) => ({
      description: it.description,
      amount: it.amount,
      payerMemberId: it.payerMemberId,
      splitMode: it.splitMode,
      splitValues: it.splitValues,
    })),
  );

  const inputCls =
    "h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form action={saveExpenseBatchAction} className="p-4 sm:p-6">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="label" value={label || groupName} />
      <input type="hidden" name="items" value={payload} />

      <Link href={`/groups/${groupId}`} className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to {groupName}
      </Link>
      <h1 className="mb-1 mt-2.5 text-2xl font-medium tracking-[-0.01em]">Itemized expense</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        Each line becomes its own expense, grouped together. Entered in {baseCurrency}.
      </p>

      <div className="flex flex-col gap-[18px]">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dinner at Luigi's"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
        </div>

        {items.map((it, idx) => {
          const r = resolved[idx];
          return (
            <div key={it.key} className="rounded-[8px] border border-border p-3.5">
              <div className="mb-3 flex items-center gap-2.5">
                <input
                  value={it.description}
                  onChange={(e) => patchItem(it.key, { description: e.target.value })}
                  placeholder={`Item ${idx + 1}`}
                  className="h-9 flex-1 rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="relative w-28">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol(baseCurrency)}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={it.amount}
                    onChange={(e) => patchItem(it.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                    placeholder="0.00"
                    className="h-9 w-full rounded-[6px] border border-border pl-7 pr-2 text-sm font-medium outline-none focus:border-accent"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                    aria-label="Remove item"
                    className="cursor-pointer rounded-[6px] px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-[13px] text-muted-foreground">Paid by</span>
                <select
                  value={it.payerMemberId}
                  onChange={(e) => patchItem(it.key, { payerMemberId: e.target.value })}
                  className="h-8 flex-1 rounded-[6px] border border-border bg-background px-2.5 text-sm outline-none focus:border-accent"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3 flex gap-1 rounded-[6px] bg-muted p-[3px]">
                {MODES.map((m) => (
                  <button
                    type="button"
                    key={m.key}
                    onClick={() => patchItem(it.key, { splitMode: m.key })}
                    className={`flex-1 cursor-pointer rounded-[5px] py-1 text-center text-[12px] font-medium transition-colors ${
                      it.splitMode === m.key ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {members.map((m, mi) => {
                  const cents = r.centsById.get(m.id) ?? 0;
                  return (
                    <div key={m.id} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={m.displayName} seed={mi} size={24} />
                      <span className="flex-1 truncate">{m.displayName}</span>
                      {it.splitMode === "equal" && (
                        <span className="text-muted-foreground tnum">{formatCents(cents, baseCurrency)}</span>
                      )}
                      {(it.splitMode === "equalExtra" || it.splitMode === "unequal") && (
                        <div className="flex items-center gap-2">
                          <div className="relative w-24">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              {it.splitMode === "equalExtra" ? `+${currencySymbol(baseCurrency)}` : currencySymbol(baseCurrency)}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.splitValues[m.id] ?? ""}
                              onChange={(e) => setSplitValue(it.key, m.id, e.target.value)}
                              placeholder="0.00"
                              className={`h-8 w-full rounded-[6px] border border-border ${
                                it.splitMode === "equalExtra" ? "pl-9" : "pl-7"
                              } pr-2 text-sm outline-none focus:border-accent`}
                            />
                          </div>
                          {it.splitMode === "equalExtra" && (
                            <span className="w-20 text-right text-muted-foreground tnum">
                              {formatCents(cents, baseCurrency)}
                            </span>
                          )}
                        </div>
                      )}
                      {it.splitMode === "percent" && (
                        <div className="flex items-center gap-2">
                          <div className="relative w-20">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={it.splitValues[m.id] ?? ""}
                              onChange={(e) => setSplitValue(it.key, m.id, e.target.value)}
                              placeholder="0"
                              className="h-8 w-full rounded-[6px] border border-border pl-2.5 pr-5 text-sm outline-none focus:border-accent"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              %
                            </span>
                          </div>
                          <span className="w-20 text-right text-muted-foreground tnum">
                            {formatCents(cents, baseCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {it.splitMode !== "equal" && r.totalCents > 0 && (
                <div className="mt-2.5">
                  <span
                    className={`inline-block rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${
                      r.ok ? "bg-owed-bg text-owed" : "bg-owe-bg text-owe"
                    }`}
                  >
                    {r.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem(payerSeed)])}
          className="cursor-pointer rounded-[6px] border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          + Add item
        </button>

        <div className="flex items-center justify-between border-t border-border pt-3.5 text-sm">
          <span className="text-muted-foreground">
            {filled.length} item{filled.length === 1 ? "" : "s"}
          </span>
          <span className="font-medium tnum">{formatCents(grandTotal, baseCurrency)}</span>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Link
            href={`/groups/${groupId}`}
            className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <SubmitButton
            disabled={!allValid}
            pendingLabel="Saving…"
            className="cursor-pointer rounded-[6px] bg-accent px-[18px] py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f] disabled:pointer-events-none disabled:opacity-50"
          >
            Save {filled.length > 0 ? `${filled.length} item${filled.length === 1 ? "" : "s"}` : "items"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
