/**
 * FX rates.
 *
 * Production behaviour (the kickoff brief): one cached call/day to a free API,
 * with the per-expense rate staying user-editable. `getRatesToBase` performs that
 * cached fetch server-side; the static `dailyRate` table is the offline fallback.
 */

// Offline fallback table: TABLE[from][to] = units of `to` per 1 unit of `from`.
const TABLE: Record<string, Record<string, number>> = {
  USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 157.2, CAD: 1.37, AUD: 1.51 },
  EUR: { USD: 1.09, EUR: 1, GBP: 0.86, JPY: 170.9, CAD: 1.49, AUD: 1.64 },
  GBP: { USD: 1.27, EUR: 1.16, GBP: 1, JPY: 198.8, CAD: 1.73, AUD: 1.91 },
};

const FX_API_URL = process.env.FX_API_URL || "https://api.frankfurter.dev";
const SUPPORTED = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

/** Static fallback: units of `to` per 1 unit of `from`. */
export function dailyRate(from: string, to: string): number {
  if (from === to) return 1;
  const direct = TABLE[from]?.[to];
  if (direct != null) return direct;
  const inverse = TABLE[to]?.[from];
  if (inverse != null) return Number((1 / inverse).toFixed(4));
  return 1;
}

/**
 * Rate to apply to an expense entered in `currency`, converting it INTO `base`
 * (i.e. base-currency units per 1 unit of `currency`). Static fallback only.
 */
export function rateToBase(currency: string, base: string): number {
  return dailyRate(currency, base);
}

// ---------------------------------------------------------------------------
// Live daily fetch (server-side, cached one call per base per UTC day)
// ---------------------------------------------------------------------------

type RatesToBase = Record<string, number>; // currency -> base units per 1 unit

interface CacheEntry {
  date: string; // UTC yyyy-mm-dd
  rates: RatesToBase;
}

const globalForFx = globalThis as unknown as { __fxCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (globalForFx.__fxCache ??= new Map());

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function staticRatesToBase(base: string): RatesToBase {
  const out: RatesToBase = {};
  for (const c of SUPPORTED) out[c] = rateToBase(c, base);
  return out;
}

/**
 * Map of `currency -> base units per 1 unit of that currency` for the given base
 * currency. Fetched once per base per day from the FX API; falls back to the
 * static table on any error. Always includes `base -> 1`.
 */
export async function getRatesToBase(base: string): Promise<RatesToBase> {
  const today = todayUTC();
  const cached = cache.get(base);
  if (cached && cached.date === today) return cached.rates;

  const symbols = SUPPORTED.filter((c) => c !== base).join(",");
  try {
    const res = await fetch(`${FX_API_URL}/v1/latest?base=${base}&symbols=${symbols}`, {
      // Let the daily cache key handle freshness; avoid Next caching surprises.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`FX API ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (!data.rates) throw new Error("FX API: no rates");

    // API gives `currency per 1 base`; we want `base per 1 currency` = 1/that.
    const rates: RatesToBase = { [base]: 1 };
    for (const [c, perBase] of Object.entries(data.rates)) {
      if (perBase > 0) rates[c] = Number((1 / perBase).toFixed(6));
    }
    // Backfill any supported currency the API didn't return, from the static table.
    for (const c of SUPPORTED) if (rates[c] == null) rates[c] = rateToBase(c, base);

    cache.set(base, { date: today, rates });
    return rates;
  } catch {
    const rates = staticRatesToBase(base);
    // Cache the fallback for the day too, so we don't hammer a failing API.
    cache.set(base, { date: today, rates });
    return rates;
  }
}
