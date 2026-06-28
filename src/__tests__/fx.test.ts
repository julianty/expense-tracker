import { dailyRate, rateToBase, getRatesToBase } from "@/lib/fx";

describe("dailyRate (static fallback table)", () => {
  it("is 1 for same currency", () => {
    expect(dailyRate("USD", "USD")).toBe(1);
  });

  it("uses a direct rate when present", () => {
    expect(dailyRate("USD", "EUR")).toBe(0.92);
  });

  it("inverts when only the reverse is present", () => {
    // USD->JPY = 157.2, so JPY->USD = 1/157.2
    expect(dailyRate("JPY", "USD")).toBeCloseTo(1 / 157.2, 4);
  });

  it("rateToBase is base units per 1 unit of currency", () => {
    expect(rateToBase("EUR", "USD")).toBe(dailyRate("EUR", "USD"));
  });
});

describe("getRatesToBase (cached daily fetch)", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("falls back to the static table when the API fails", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network"))) as unknown as typeof fetch;
    const rates = await getRatesToBase("USD");
    // Map is "base units per 1 unit of currency": 1 EUR = 1.09 USD, etc.
    expect(rates.USD).toBe(1);
    expect(rates.EUR).toBe(1.09); // from static table (EUR→USD)
    expect(rates.GBP).toBe(1.27);
  });

  it("inverts API rates to base-per-currency on success", async () => {
    // API returns `currency per 1 base`; we want base per 1 currency.
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ rates: { EUR: 0.5 } }),
      }),
    ) as unknown as typeof fetch;

    const rates = await getRatesToBase("GBP"); // base not used by earlier test
    expect(rates.GBP).toBe(1);
    expect(rates.EUR).toBe(2); // 1 / 0.5
    // unspecified currencies are backfilled from the static table
    expect(rates.USD).toBeCloseTo(dailyRate("USD", "GBP"), 4);
  });
});
