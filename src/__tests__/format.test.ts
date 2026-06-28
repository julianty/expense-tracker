import {
  formatCents,
  formatCentsAbs,
  formatMoneyNumber,
  currencySymbol,
  initials,
  avatarColors,
} from "@/lib/format";

describe("formatCents", () => {
  it("formats with two decimals", () => {
    expect(formatCents(8400)).toBe("$84.00");
    expect(formatCents(5630)).toBe("$56.30");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("adds thousands separators", () => {
    expect(formatCents(1000000)).toBe("$10,000.00");
    expect(formatCents(310000)).toBe("$3,100.00");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("keeps the sign on negatives", () => {
    expect(formatCents(-1450)).toBe("-$14.50");
    expect(formatCents(-1000000)).toBe("-$10,000.00");
  });

  it("uses the right currency symbol", () => {
    expect(formatCents(9000, "EUR")).toBe("€90.00");
    expect(formatCents(9000, "GBP")).toBe("£90.00");
    expect(formatCents(9000, "JPY")).toBe("¥90.00");
    expect(formatCents(9000, "XYZ")).toBe("XYZ 90.00"); // unknown → code + space
  });
});

describe("formatCentsAbs", () => {
  it("drops the sign", () => {
    expect(formatCentsAbs(-1450)).toBe("$14.50");
    expect(formatCentsAbs(1450)).toBe("$14.50");
  });
});

describe("formatMoneyNumber", () => {
  it("formats a plain number with commas + 2dp", () => {
    expect(formatMoneyNumber(10000)).toBe("10,000.00");
    expect(formatMoneyNumber(5)).toBe("5.00");
    expect(formatMoneyNumber(1234.5)).toBe("1,234.50");
  });
});

describe("currencySymbol", () => {
  it("maps known currencies and falls back for unknown", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("CAD")).toBe("CA$");
    expect(currencySymbol("ZZZ")).toBe("ZZZ ");
  });
});

describe("initials", () => {
  it("takes two letters from a single name", () => {
    expect(initials("Alex")).toBe("AL");
    expect(initials("Bo")).toBe("BO");
  });
  it("takes first + last initial for multi-word names", () => {
    expect(initials("Mary Jane")).toBe("MJ");
    expect(initials("a b c")).toBe("AC");
  });
  it("handles a single character", () => {
    expect(initials("x")).toBe("X");
  });
});

describe("avatarColors", () => {
  it("is deterministic and cycles through the palette", () => {
    expect(avatarColors(0)).toEqual(avatarColors(5));
    expect(avatarColors(1)).not.toEqual(avatarColors(0));
  });
  it("handles negative seeds without crashing", () => {
    expect(avatarColors(-1)).toHaveProperty("bg");
  });
});
