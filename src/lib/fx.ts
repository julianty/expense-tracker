/**
 * FX rates.
 *
 * In production this is one cached call/day to frankfurter.app / open.er-api.com
 * (see the kickoff brief). No network is available in this environment, so we
 * return a static daily table. The per-expense rate stays user-editable — that's
 * the contract the Add-expense form depends on.
 */

const TABLE: Record<string, Record<string, number>> = {
  USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157.2, CAD: 1.37, AUD: 1.51 },
  EUR: { USD: 1.09, EUR: 1, GBP: 0.86, JPY: 170.9, CAD: 1.49, AUD: 1.64 },
  GBP: { USD: 1.27, EUR: 1.16, GBP: 1, JPY: 198.8, CAD: 1.73, AUD: 1.91 },
};

/** Rate that converts 1 unit of `from` into `to`. Falls back to 1. */
export function dailyRate(from: string, to: string): number {
  if (from === to) return 1;
  const direct = TABLE[from]?.[to];
  if (direct != null) return direct;
  const inverse = TABLE[to]?.[from];
  if (inverse != null) return Number((1 / inverse).toFixed(4));
  return 1;
}

/**
 * Rate to apply to an expense entered in `currency`, converting it INTO the
 * group's base currency.
 */
export function rateToBase(currency: string, base: string): number {
  return dailyRate(currency, base);
}
