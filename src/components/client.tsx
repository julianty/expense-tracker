"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { renameMemberAction, unclaimMemberAction } from "@/app/actions";
import { canReleaseSlot } from "@/lib/membership";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Tabs — underline style from the design
// ---------------------------------------------------------------------------

export function Tabs({
  tabs,
}: {
  tabs: Array<{ label: string; content: ReactNode }>;
}) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-6 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={cx(
              "-mb-px cursor-pointer pb-2.5 text-sm font-medium transition-colors",
              i === active
                ? "border-b-2 border-accent text-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs[active].content}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit button with pending state — reflects the enclosing <form action> while
// the server action is in flight (React's useFormStatus). Keeps each call site's
// own styling via `className`; shows a spinner + optional `pendingLabel`.
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
}: {
  children: ReactNode;
  /** Label shown while the action is pending (defaults to `children`). */
  pendingLabel?: ReactNode;
  /** Extra disable condition beyond the in-flight state (e.g. validation). */
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending && <Spinner />}
        {pending ? pendingLabel ?? children : children}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Add-expense FAB — opens a small menu to pick a single or itemized expense
// ---------------------------------------------------------------------------

export function AddExpenseFab({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-5 right-5">
      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-[62px] right-0 z-50 w-48 overflow-hidden rounded-[10px] border border-border bg-background shadow-lg">
            <Link
              href={`/groups/${groupId}/expense/new`}
              className="block px-3.5 py-2.5 text-sm hover:bg-muted"
            >
              Single expense
            </Link>
            <Link
              href={`/groups/${groupId}/expense/itemized`}
              className="block border-t border-border px-3.5 py-2.5 text-sm hover:bg-muted"
            >
              Itemized expense
            </Link>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add expense"
        aria-expanded={open}
        className="relative z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-[28px] leading-none text-accent-foreground shadow-lg transition-transform hover:bg-[#b06f1f]"
        style={{ transform: open ? "rotate(45deg)" : undefined }}
      >
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------

export function CopyButton({
  value,
  label = "Copy link",
  icon = "⧉",
  className,
}: {
  value: string;
  label?: string;
  icon?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const text = value.startsWith("/") ? window.location.origin + value : value;
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
        className,
      )}
    >
      <span className="text-[13px]">{icon}</span>
      {copied ? "Copied!" : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sign-out button with pending state
// ---------------------------------------------------------------------------

export function SignOutButton({
  action,
  email,
}: {
  action: (formData: FormData) => void | Promise<void>;
  email: string;
}) {
  return (
    <form action={action} title={`Signed in as ${email}`}>
      <SubmitButton
        pendingLabel="Signing out…"
        className="cursor-pointer rounded-[6px] px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        Sign out
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog wrapping a server-action form (AlertDialog equivalent)
// ---------------------------------------------------------------------------

type TriggerVariant = "primary" | "outline" | "ghost" | "destructive";

const TRIGGER_STYLES: Record<TriggerVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-[#b06f1f]",
  outline: "border border-border text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  destructive: "border border-[#B91C1C] text-[#B91C1C] hover:bg-owe-bg",
};

// ---------------------------------------------------------------------------
// Member row — rename (admin) + release/unclaim (admin or self) on settings
// ---------------------------------------------------------------------------

export interface ManageMember {
  id: string;
  displayName: string;
  claimedEmail?: string;
  /** True once a guest or account has taken the slot. */
  taken: boolean;
  /** True when a real account is linked (releasing requires admin). */
  accountLinked: boolean;
}

export function MemberRow({
  member,
  groupId,
  seed,
  canManage,
  isSelf,
}: {
  member: ManageMember;
  groupId: string;
  seed: number;
  /** Viewer is the group admin. */
  canManage: boolean;
  /** Viewer currently acts as this member. */
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const canRelease = canReleaseSlot({ taken: member.taken, isAdmin: canManage, isSelf });

  const badge = member.accountLinked
    ? { label: "account", cls: "bg-owed-bg text-owed" }
    : member.taken
      ? { label: "guest", cls: "bg-owed-bg text-owed" }
      : { label: "unclaimed", cls: "bg-muted text-muted-foreground" };

  if (editing) {
    return (
      <form
        action={renameMemberAction}
        className="flex items-center gap-2"
        onSubmit={() => setEditing(false)}
      >
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="memberId" value={member.id} />
        <Avatar name={member.displayName} seed={seed} />
        <input
          name="displayName"
          defaultValue={member.displayName}
          autoFocus
          required
          className="h-9 flex-1 rounded-[6px] border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <SubmitButton
          pendingLabel="Saving…"
          className="cursor-pointer rounded-[6px] bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-foreground hover:bg-[#b06f1f] disabled:pointer-events-none disabled:opacity-50"
        >
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="cursor-pointer px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={member.displayName} seed={seed} />
      <div className="flex-1">
        <div className="text-sm">{member.displayName}</div>
        {member.claimedEmail && (
          <div className="text-xs text-muted-foreground">{member.claimedEmail}</div>
        )}
      </div>

      <span className={cx("rounded-[6px] px-2 py-0.5 text-[11px] font-medium", badge.cls)}>
        {badge.label}
      </span>

      {canManage && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cursor-pointer rounded-[6px] px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Rename
        </button>
      )}

      {canRelease && (
        <ConfirmSubmit
          action={unclaimMemberAction}
          fields={{ groupId, memberId: member.id }}
          triggerLabel={isSelf && !canManage ? "Leave" : "Release"}
          triggerVariant="ghost"
          triggerClassName="px-2 py-1 text-[12px]"
          title={isSelf && !canManage ? "Leave this slot?" : `Release ${member.displayName}?`}
          description={
            member.accountLinked
              ? `This unlinks the account from ${member.displayName}. The slot and its expense history are kept, and it can be claimed again from the share link.`
              : `This frees up ${member.displayName} so someone else can claim it. The slot and its expense history are kept.`
          }
          confirmLabel={isSelf && !canManage ? "Leave" : "Release"}
        />
      )}
    </div>
  );
}

export function ConfirmSubmit({
  action,
  fields,
  triggerLabel,
  triggerVariant = "outline",
  triggerClassName,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  triggerLabel: ReactNode;
  triggerVariant?: TriggerVariant;
  triggerClassName?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: TriggerVariant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] px-4 py-2 text-sm font-medium transition-colors",
          TRIGGER_STYLES[triggerVariant],
          triggerClassName,
        )}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-[12px] border border-border bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-medium">{title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            <form action={action} className="mt-4 flex justify-end gap-2.5">
              {Object.entries(fields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-[6px] px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <SubmitButton
                className={cx(
                  "cursor-pointer rounded-[6px] px-4 py-2 text-sm font-medium transition-colors",
                  TRIGGER_STYLES[confirmVariant],
                )}
              >
                {confirmLabel}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
