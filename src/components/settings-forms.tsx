"use client";

import { SubmitButton } from "@/components/client";
import {
  addMemberAction,
  regenerateLinkAction,
  updateGroupAction,
} from "@/app/actions";
import { CURRENCIES } from "@/lib/format";

export function GroupInfoForm({
  groupId,
  name,
  baseCurrency,
  simplifyDebts,
}: {
  groupId: string;
  name: string;
  baseCurrency: string;
  simplifyDebts: boolean;
}) {
  const inputCls =
    "h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form action={updateGroupAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <div className="mb-2.5 text-[13px] font-medium">Group info</div>
      <div className="flex flex-col gap-2.5">
        <input name="name" defaultValue={name} className={inputCls} />
        <select
          name="baseCurrency"
          defaultValue={baseCurrency}
          className="h-9 w-full rounded-[6px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="simplifyDebts"
            defaultChecked={simplifyDebts}
            className="h-4 w-4 accent-[#C57C24]"
          />
          Simplify debts
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitButton
          pendingLabel="Saving…"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f] disabled:pointer-events-none disabled:opacity-50"
        >
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddMemberForm({ groupId }: { groupId: string }) {
  return (
    <form action={addMemberAction} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input
        name="memberName"
        placeholder="Add a member…"
        required
        className="h-9 flex-1 rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <SubmitButton
        pendingLabel="Adding…"
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        Add
      </SubmitButton>
    </form>
  );
}

export function RegenerateLinkButton({ groupId }: { groupId: string }) {
  return (
    <form action={regenerateLinkAction} className="mt-2.5">
      <input type="hidden" name="groupId" value={groupId} />
      <SubmitButton
        pendingLabel="Regenerating…"
        className="cursor-pointer text-[13px] font-medium text-owe hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        Regenerate link
      </SubmitButton>
    </form>
  );
}
