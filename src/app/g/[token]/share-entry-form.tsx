"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { claimSlotAction } from "@/app/actions";
import { isSlotSelectable, hasReclaimableSlot, type SlotFlags } from "@/lib/membership";

interface SlotMember extends SlotFlags {
  id: string;
  displayName: string;
}

export function ShareEntryForm({
  groupId,
  groupName,
  token,
  members,
  error,
}: {
  groupId: string;
  groupName: string;
  token: string;
  members: SlotMember[];
  error?: string;
}) {
  const ADD_NEW = "__add_new__";
  const NONE = "";
  const firstUnclaimed = members.find((m) => !m.claimed)?.id ?? ADD_NEW;
  const [selected, setSelected] = useState(firstUnclaimed);
  const [returning, setReturning] = useState(false);
  const addingNew = selected === ADD_NEW;

  // The "Returning user?" path only helps if some claimed slot is re-takeable.
  const hasReclaimable = hasReclaimableSlot(members);

  function handleSlotClick(m: SlotMember) {
    if (isSlotSelectable(m, returning)) setSelected(m.id);
  }

  function handleReturningToggle() {
    setReturning(true);
    // Require explicit selection — no pre-select prevents accidental mis-claim.
    setSelected(NONE);
  }

  const selectedMember = members.find((m) => m.id === selected);
  const canSubmit = selected !== NONE || addingNew;

  return (
    <form
      action={claimSlotAction}
      className="w-[320px] rounded-[12px] border border-border bg-background p-6"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="token" value={token} />
      {!addingNew && <input type="hidden" name="memberId" value={selected} />}

      <div className="text-lg font-medium">{groupName}</div>
      <p className="mb-[18px] mt-1 text-sm text-muted-foreground">
        {returning ? "Click your name to rejoin." : "Who are you in this group?"}
      </p>

      {error && (
        <div className="mb-3 rounded-[6px] border border-[#B91C1C]/30 bg-owe-bg px-3 py-2 text-[13px] text-[#B91C1C]">
          {error}
        </div>
      )}

      <label className="mb-1.5 block text-[13px] font-medium">Your slot</label>
      <div className="overflow-hidden rounded-lg border border-border">
        {members.map((m, i) => {
          const selectable = isSlotSelectable(m, returning);
          const isSelected = selected === m.id;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => handleSlotClick(m)}
              disabled={!selectable}
              className={`flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-[13px] last:border-b-0 transition-colors ${
                isSelected ? "bg-muted" : selectable ? "hover:bg-muted" : ""
              } ${selectable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            >
              <Avatar name={m.displayName} seed={i} size={22} />
              <span className="flex-1">{m.displayName}</span>
              {m.locked ? (
                <span className="text-xs text-muted-foreground">account</span>
              ) : (
                m.claimed && !returning && (
                  <span className="text-xs text-muted-foreground">taken</span>
                )
              )}
              {isSelected && <span className="text-accent">✓</span>}
            </button>
          );
        })}
        {!returning && (
          <button
            type="button"
            onClick={() => setSelected(ADD_NEW)}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-accent transition-colors ${
              addingNew ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            + Add myself…
          </button>
        )}
      </div>

      {addingNew && !returning && (
        <input
          name="newName"
          placeholder="Your name"
          required
          className="mt-2.5 h-9 w-full rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      )}

      {returning && (
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          Members linked to an account can&apos;t be re-claimed here — sign in to that account instead.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-[18px] h-[38px] w-full rounded-[6px] bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-[#b06f1f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {returning
          ? selectedMember
            ? `Rejoin as ${selectedMember.displayName}`
            : "Select your name above"
          : "Join group"}
      </button>

      {!returning && hasReclaimable && (
        <button
          type="button"
          onClick={handleReturningToggle}
          className="mt-3 w-full text-center text-[12px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Returning user? Click here
        </button>
      )}
    </form>
  );
}
