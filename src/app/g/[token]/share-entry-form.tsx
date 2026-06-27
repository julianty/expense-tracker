"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { claimSlotAction } from "@/app/actions";

interface SlotMember {
  id: string;
  displayName: string;
  claimed: boolean;
}

export function ShareEntryForm({
  groupId,
  groupName,
  token,
  members,
}: {
  groupId: string;
  groupName: string;
  token: string;
  members: SlotMember[];
}) {
  const ADD_NEW = "__add_new__";
  const firstUnclaimed = members.find((m) => !m.claimed)?.id ?? ADD_NEW;
  const [selected, setSelected] = useState(firstUnclaimed);
  const addingNew = selected === ADD_NEW;

  return (
    <form
      action={claimSlotAction}
      className="w-[320px] rounded-[12px] border border-border bg-background p-6"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="token" value={token} />
      {!addingNew && <input type="hidden" name="memberId" value={selected} />}

      <div className="text-lg font-medium">{groupName}</div>
      <p className="mb-[18px] mt-1 text-sm text-muted-foreground">Who are you in this group?</p>

      <label className="mb-1.5 block text-[13px] font-medium">Your slot</label>
      <div className="overflow-hidden rounded-lg border border-border">
        {members.map((m, i) => (
          <button
            type="button"
            key={m.id}
            onClick={() => setSelected(m.id)}
            disabled={m.claimed}
            className={`flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-[13px] last:border-b-0 transition-colors ${
              selected === m.id ? "bg-muted" : "hover:bg-muted"
            } ${m.claimed ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <Avatar name={m.displayName} seed={i} size={22} />
            <span className="flex-1">{m.displayName}</span>
            {m.claimed && <span className="text-xs text-muted-foreground">claimed</span>}
            {selected === m.id && <span className="text-accent">✓</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected(ADD_NEW)}
          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-accent transition-colors ${
            addingNew ? "bg-muted" : "hover:bg-muted"
          }`}
        >
          + Add myself…
        </button>
      </div>

      {addingNew && (
        <input
          name="newName"
          placeholder="Your name"
          required
          className="mt-2.5 h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      )}

      <button
        type="submit"
        className="mt-[18px] h-[38px] w-full cursor-pointer rounded-[6px] bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f]"
      >
        Join group
      </button>
    </form>
  );
}
