import { decodeJwtClaims, isExpired } from "@/lib/jwt";

/** Build a JWT-shaped token (header.payload.sig) with a base64url payload. */
function makeToken(payload: object): string {
  const b64url = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${b64url}.signature`;
}

describe("decodeJwtClaims", () => {
  it("decodes sub, email, and exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const claims = decodeJwtClaims(makeToken({ sub: "user-123", email: "a@b.com", exp }));
    expect(claims).toEqual({ sub: "user-123", email: "a@b.com", exp });
  });

  it("defaults email to empty string when absent", () => {
    const claims = decodeJwtClaims(makeToken({ sub: "u", exp: 9999999999 }));
    expect(claims).toEqual({ sub: "u", email: "", exp: 9999999999 });
  });

  it("returns null when sub or exp is missing", () => {
    expect(decodeJwtClaims(makeToken({ email: "x", exp: 1 }))).toBeNull();
    expect(decodeJwtClaims(makeToken({ sub: "u" }))).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims("")).toBeNull();
    expect(decodeJwtClaims("a.!!!notbase64!!!.c")).toBeNull();
  });
});

describe("isExpired", () => {
  const base = 1_000_000_000_000; // fixed "now" in ms
  it("is false for a future exp", () => {
    expect(isExpired({ exp: base / 1000 + 60 }, base)).toBe(false);
  });
  it("is true at/after exp", () => {
    expect(isExpired({ exp: base / 1000 }, base)).toBe(true);
    expect(isExpired({ exp: base / 1000 - 1 }, base)).toBe(true);
  });
});
