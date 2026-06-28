/**
 * Display helpers — money formatting, avatar identity, currency list.
 * All amounts are stored as integer cents; never format with floats elsewhere.
 */

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code + " ";
}

/** Format integer cents as a currency string, e.g. 8400 → "$84.00", 1000000 → "$10,000.00". */
export function formatCents(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const num = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currencySymbol(currency)}${num}`;
}

/** Format a plain number with thousands separators and exactly 2 decimals. */
export function formatMoneyNumber(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format without sign (caller adds "Owed"/"Owes" labels). */
export function formatCentsAbs(cents: number, currency = "USD"): string {
  return formatCents(Math.abs(cents), currency);
}

/** Two-letter initials from a display name, e.g. "Alex" → "AL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar palette, cycled by member index (matches design). */
const AVATAR_PALETTES = [
  { bg: "#E8EDF2", fg: "#3F5366" },
  { bg: "#F0EAE2", fg: "#6B5A45" },
  { bg: "#E7EFEA", fg: "#3F5E4C" },
  { bg: "#F2E8EE", fg: "#6B4557" },
  { bg: "#EAE8F2", fg: "#4C4566" },
];

export function avatarColors(seed: number): { bg: string; fg: string } {
  return AVATAR_PALETTES[((seed % AVATAR_PALETTES.length) + AVATAR_PALETTES.length) % AVATAR_PALETTES.length];
}

/** Short date label, e.g. "Jun 14". */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Long date label, e.g. "Jun 14, 2026". */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Date + time, e.g. "Jun 14, 9:21 PM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
