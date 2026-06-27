"use client";

import { useState, type ReactNode } from "react";

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
// Confirm dialog wrapping a server-action form (AlertDialog equivalent)
// ---------------------------------------------------------------------------

type TriggerVariant = "primary" | "outline" | "ghost" | "destructive";

const TRIGGER_STYLES: Record<TriggerVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-[#b06f1f]",
  outline: "border border-border text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  destructive: "border border-[#B91C1C] text-[#B91C1C] hover:bg-owe-bg",
};

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
              <button
                type="submit"
                className={cx(
                  "cursor-pointer rounded-[6px] px-4 py-2 text-sm font-medium transition-colors",
                  TRIGGER_STYLES[confirmVariant],
                )}
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
