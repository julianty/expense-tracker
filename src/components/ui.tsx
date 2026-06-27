/**
 * Lightweight UI primitives matching 01-design-system.md.
 *
 * These mirror the shadcn components named in the design (Card, Button, Avatar,
 * Badge, Separator) with the same tokens, but without pulling the full registry
 * so the app builds offline. Swap for real shadcn later if desired.
 */

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { avatarColors, formatCentsAbs, initials } from "@/lib/format";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-[12px] border border-border bg-background shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-border", className)} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "outline" | "ghost" | "destructive";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-[#b06f1f]",
  outline: "border border-border text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  destructive: "border border-[#B91C1C] text-[#B91C1C] hover:bg-owe-bg",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[6px] text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={cx(buttonBase, "px-4 py-2", BUTTON_STYLES[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  children,
  href,
}: {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className={cx(buttonBase, "px-4 py-2", BUTTON_STYLES[variant], className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({
  name,
  seed,
  size = 32,
  ring = false,
}: {
  name: string;
  seed: number;
  size?: number;
  ring?: boolean;
}) {
  const { bg, fg } = avatarColors(seed);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.36),
        border: ring ? "2px solid #fff" : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping stack of member avatars, with an optional "+N" overflow chip. */
export function AvatarStack({
  members,
  max = 4,
}: {
  members: Array<{ displayName: string }>;
  max?: number;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div className="flex">
      {shown.map((m, i) => (
        <span key={i} style={{ marginRight: -8 }}>
          <Avatar name={m.displayName} seed={i} size={26} ring />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-medium text-muted-foreground"
          style={{ background: "#F4F4F5", border: "2px solid #fff" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balance chip — green owed / red owe / neutral settled. Never amber.
// ---------------------------------------------------------------------------

/**
 * @param balanceCents positive = the member owes; negative = the member is owed.
 */
export function BalanceChip({
  balanceCents,
  currency,
  className,
}: {
  balanceCents: number;
  currency: string;
  className?: string;
}) {
  const base = "inline-block rounded-[6px] px-2.5 py-1 text-xs font-medium tnum";
  if (balanceCents === 0) {
    return <span className={cx(base, "bg-muted text-muted-foreground", className)}>Settled</span>;
  }
  if (balanceCents < 0) {
    return (
      <span className={cx(base, "bg-owed-bg text-owed", className)}>
        Owed {formatCentsAbs(balanceCents, currency)}
      </span>
    );
  }
  return (
    <span className={cx(base, "bg-owe-bg text-owe", className)}>
      Owes {formatCentsAbs(balanceCents, currency)}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-block rounded-[6px] bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
