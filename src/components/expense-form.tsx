"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { saveExpenseAction } from "@/app/actions";
import { CURRENCIES, currencySymbol, formatCents, formatMoneyNumber } from "@/lib/format";
import { isAllowedReceipt, MAX_RECEIPT_BYTES } from "@/lib/receipts";
import type { SplitMode } from "@/lib/store";

interface MemberLite {
  id: string;
  displayName: string;
}

export interface ExpenseFormInitial {
  expenseId?: string;
  description?: string;
  amount?: string;
  currency?: string;
  fxRate?: string;
  payerMemberId?: string;
  splitMode?: SplitMode;
  note?: string;
  date?: string; // yyyy-mm-dd
  /** Per-member raw split values keyed by member id (dollars or %). */
  splitValues?: Record<string, string>;
}

const MODES: Array<{ key: SplitMode; label: string }> = [
  { key: "equal", label: "Equal" },
  { key: "equalExtra", label: "Equal +" },
  { key: "unequal", label: "Unequal" },
  { key: "percent", label: "%" },
];

export function ExpenseForm({
  groupId,
  groupName,
  baseCurrency,
  members,
  rates,
  initial = {},
}: {
  groupId: string;
  groupName: string;
  baseCurrency: string;
  members: MemberLite[];
  /** Live "base units per 1 unit of currency" map, fetched server-side. */
  rates: Record<string, number>;
  initial?: ExpenseFormInitial;
}) {
  const rateFor = (c: string) => rates[c] ?? 1;

  const [amount, setAmount] = useState(initial.amount ?? "");
  const [amountFocused, setAmountFocused] = useState(false);
  const [currency, setCurrency] = useState(initial.currency ?? baseCurrency);
  const [fxRate, setFxRate] = useState(
    initial.fxRate ?? String(rateFor(initial.currency ?? baseCurrency)),
  );
  const [payerId, setPayerId] = useState(initial.payerMemberId ?? members[0]?.id ?? "");
  const [mode, setMode] = useState<SplitMode>(initial.splitMode ?? "equal");
  const [splitValues, setSplitValues] = useState<Record<string, string>>(initial.splitValues ?? {});
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  function onReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptName(null);
      setReceiptError(null);
      return;
    }
    const check = isAllowedReceipt(file.type, file.size);
    if (!check.ok) {
      // Reject before upload so an oversized phone photo never hits the server.
      e.target.value = "";
      setReceiptName(null);
      setReceiptError(check.reason ?? "Invalid file");
      return;
    }
    setReceiptName(file.name);
    setReceiptError(null);
  }

  const maxMb = Math.round(MAX_RECEIPT_BYTES / (1024 * 1024));

  const rate = Number(fxRate) || 1;
  const enteredCents = Math.round((Number(amount) || 0) * 100);
  const baseTotalCents = Math.round(enteredCents * rate);
  const isForeign = currency !== baseCurrency;

  function onCurrencyChange(next: string) {
    setCurrency(next);
    setFxRate(String(rateFor(next)));
  }

  // Per-member base-currency cents to display, by mode.
  const computed = useMemo(() => {
    const ids = members.map((m) => m.id);
    if (mode === "equal") {
      const base = Math.trunc(baseTotalCents / ids.length);
      const remainder = baseTotalCents - base * ids.length;
      const payerIdx = Math.max(0, ids.indexOf(payerId));
      return ids.map((id, i) => ({ id, cents: base + (i === payerIdx ? remainder : 0) }));
    }
    if (mode === "equalExtra") {
      const extras = ids.map((id) => Math.round((Number(splitValues[id]) || 0) * 100));
      const pool = baseTotalCents - extras.reduce((a, b) => a + b, 0);
      const base = Math.trunc(pool / ids.length);
      const remainder = pool - base * ids.length;
      const payerIdx = Math.max(0, ids.indexOf(payerId));
      return ids.map((id, i) => ({ id, cents: base + extras[i] + (i === payerIdx ? remainder : 0) }));
    }
    if (mode === "percent") {
      return ids.map((id) => ({
        id,
        cents: Math.round((baseTotalCents * (Number(splitValues[id]) || 0)) / 100),
      }));
    }
    // unequal: values are base dollars
    return ids.map((id) => ({ id, cents: Math.round((Number(splitValues[id]) || 0) * 100) }));
  }, [members, mode, baseTotalCents, payerId, splitValues]);

  const allocated = computed.reduce((acc, c) => acc + c.cents, 0);
  const leftoverCents = baseTotalCents - allocated;
  const percentSum = members.reduce((acc, m) => acc + (Number(splitValues[m.id]) || 0), 0);

  const extrasCents = members.reduce(
    (acc, m) => acc + Math.round((Number(splitValues[m.id]) || 0) * 100),
    0,
  );

  let balanceState: { ok: boolean; label: string };
  if (mode === "equal") {
    balanceState = { ok: true, label: "Splits balance ✓" };
  } else if (mode === "equalExtra") {
    const ok = extrasCents <= baseTotalCents;
    balanceState = ok
      ? { ok: true, label: "Splits balance ✓" }
      : { ok: false, label: "Extras exceed total" };
  } else if (mode === "percent") {
    const ok = Math.abs(percentSum - 100) < 0.001;
    balanceState = ok
      ? { ok: true, label: "Splits balance ✓" }
      : { ok: false, label: `${(100 - percentSum).toFixed(1)}% ${percentSum > 100 ? "over" : "left"}` };
  } else {
    const ok = leftoverCents === 0 && baseTotalCents > 0;
    balanceState = ok
      ? { ok: true, label: "Splits balance ✓" }
      : {
          ok: false,
          label: `${formatCents(Math.abs(leftoverCents), baseCurrency)} ${
            leftoverCents < 0 ? "over" : "left"
          }`,
        };
  }

  const inputCls =
    "h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form action={saveExpenseAction} className="p-4 sm:p-6">
      <input type="hidden" name="groupId" value={groupId} />
      {initial.expenseId && <input type="hidden" name="expenseId" value={initial.expenseId} />}
      <input type="hidden" name="splitMode" value={mode} />
      <input type="hidden" name="fxRate" value={fxRate} />
      <input type="hidden" name="payerMemberId" value={payerId} />

      <Link href={`/groups/${groupId}`} className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to {groupName}
      </Link>
      <h1 className="mb-5 mt-2.5 text-2xl font-medium tracking-[-0.01em]">
        {initial.expenseId ? "Edit expense" : "Add expense"}
      </h1>

      <div className="flex flex-col gap-[18px]">
        {/* description */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Description</label>
          <input
            name="description"
            defaultValue={initial.description}
            placeholder="What was this for?"
            className={inputCls}
            required
          />
        </div>

        {/* amount + currency */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Amount</label>
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                {currencySymbol(currency)}
              </span>
              {/* Raw numeric submitted; the visible field shows thousands + 2dp when unfocused. */}
              <input type="hidden" name="amount" value={amount} />
              <input
                type="text"
                inputMode="decimal"
                value={amountFocused || !amount ? amount : formatMoneyNumber(Number(amount))}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                placeholder="0.00"
                className="h-11 w-full rounded-[6px] border border-border pl-9 pr-3 text-xl font-medium outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                required
              />
            </div>
            <select
              name="currency"
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="h-11 w-24 rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* FX rate row (only when currency differs from base) */}
        {isForeign && (
          <div className="flex items-center justify-between rounded-[6px] bg-muted px-3 py-2.5">
            <span className="text-[13px] text-muted-foreground">
              Today&apos;s rate: 1 {currency} =
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.0001"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                className="w-24 rounded-[6px] border border-border bg-background px-2.5 py-1 text-[13px] outline-none focus:border-accent"
              />
              <span className="text-[13px] text-muted-foreground">{baseCurrency}</span>
            </div>
          </div>
        )}

        {/* payer */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">Who paid?</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* split mode */}
        <div>
          <label className="mb-2 block text-[13px] font-medium">Split</label>
          <div className="flex gap-1 rounded-[6px] bg-muted p-[3px]">
            {MODES.map((m) => (
              <button
                type="button"
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 cursor-pointer rounded-[5px] py-1.5 text-center text-[13px] font-medium transition-colors ${
                  mode === m.key ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-3.5 flex flex-col gap-2.5">
            {members.map((m, i) => {
              const cents = computed.find((c) => c.id === m.id)?.cents ?? 0;
              return (
                <div key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar name={m.displayName} seed={i} size={26} />
                  <span className="flex-1">{m.displayName}</span>
                  {mode === "equal" && (
                    <span className="text-muted-foreground tnum">
                      {formatCents(cents, baseCurrency)}
                    </span>
                  )}
                  {mode === "equalExtra" && (
                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          +{currencySymbol(baseCurrency)}
                        </span>
                        <input
                          name={`split-${m.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={splitValues[m.id] ?? ""}
                          onChange={(e) =>
                            setSplitValues((v) => ({ ...v, [m.id]: e.target.value }))
                          }
                          placeholder="0.00"
                          className="h-8 w-full rounded-[6px] border border-border pl-9 pr-2 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <span className="w-20 text-right text-muted-foreground tnum">
                        {formatCents(cents, baseCurrency)}
                      </span>
                    </div>
                  )}
                  {mode === "unequal" && (
                    <div className="relative w-28">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {currencySymbol(baseCurrency)}
                      </span>
                      <input
                        name={`split-${m.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitValues[m.id] ?? ""}
                        onChange={(e) =>
                          setSplitValues((v) => ({ ...v, [m.id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className="h-8 w-full rounded-[6px] border border-border pl-7 pr-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  )}
                  {mode === "percent" && (
                    <div className="flex items-center gap-2">
                      <div className="relative w-20">
                        <input
                          name={`split-${m.id}`}
                          type="number"
                          step="0.1"
                          min="0"
                          value={splitValues[m.id] ?? ""}
                          onChange={(e) =>
                            setSplitValues((v) => ({ ...v, [m.id]: e.target.value }))
                          }
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

          <div className="mt-3">
            <span
              className={`inline-block rounded-[6px] px-2.5 py-1 text-[13px] font-medium ${
                balanceState.ok ? "bg-owed-bg text-owed" : "bg-owe-bg text-owe"
              }`}
            >
              {balanceState.label}
            </span>
          </div>
        </div>

        {/* date + receipt */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-medium">Date</label>
            <input
              name="date"
              type="date"
              defaultValue={initial.date ?? new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-medium">Receipt</label>
            <label
              className={`flex h-9 cursor-pointer items-center justify-center truncate rounded-[6px] border px-2 text-[13px] hover:bg-muted ${
                receiptError ? "border-[#B91C1C] text-owe" : "border-border text-muted-foreground"
              }`}
            >
              <span className="truncate">{receiptName ?? "Attach receipt"}</span>
              <input
                type="file"
                name="receipt"
                accept="image/*"
                className="hidden"
                onChange={onReceiptChange}
              />
            </label>
            <p className={`mt-1 text-[11px] ${receiptError ? "text-owe" : "text-muted-foreground"}`}>
              {receiptError ?? `Images up to ${maxMb} MB`}
            </p>
          </div>
        </div>

        {/* note */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            name="note"
            defaultValue={initial.note}
            placeholder="Add a note…"
            rows={2}
            className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border pt-[18px]">
          <Link
            href={`/groups/${groupId}`}
            className="px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <SubmitButton
            disabled={!!receiptError}
            pendingLabel="Saving…"
            className="cursor-pointer rounded-[6px] bg-accent px-[18px] py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f] disabled:pointer-events-none disabled:opacity-50"
          >
            Save expense
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
