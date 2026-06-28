import {
  isAllowedReceipt,
  extensionFor,
  receiptObjectPath,
  MAX_RECEIPT_BYTES,
} from "@/lib/receipts";

describe("isAllowedReceipt", () => {
  it("accepts a normal image under the size limit", () => {
    expect(isAllowedReceipt("image/jpeg", 500_000)).toEqual({ ok: true });
    expect(isAllowedReceipt("image/png", 1)).toEqual({ ok: true });
  });

  it("rejects empty files", () => {
    expect(isAllowedReceipt("image/jpeg", 0).ok).toBe(false);
  });

  it("rejects files over the size limit", () => {
    const res = isAllowedReceipt("image/jpeg", MAX_RECEIPT_BYTES + 1);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/too large/i);
  });

  it("rejects non-image types", () => {
    expect(isAllowedReceipt("application/pdf", 1000).ok).toBe(false);
    expect(isAllowedReceipt("text/plain", 1000).ok).toBe(false);
  });
});

describe("extensionFor", () => {
  it("uses the filename extension when valid", () => {
    expect(extensionFor("photo.png", "image/png")).toBe("png");
    expect(extensionFor("scan.WEBP", "image/webp")).toBe("webp");
  });

  it("normalises jpeg → jpg", () => {
    expect(extensionFor("IMG.JPEG", "image/jpeg")).toBe("jpg");
  });

  it("falls back to the MIME type when the filename has no usable extension", () => {
    expect(extensionFor("receipt", "image/jpeg")).toBe("jpg");
    expect(extensionFor("noext", "image/heic")).toBe("heic");
  });

  it("falls back to bin for unknown types", () => {
    expect(extensionFor("weird.xyz", "application/octet-stream")).toBe("bin");
  });
});

describe("receiptObjectPath", () => {
  it("prefixes with the group id and uses a safe extension", () => {
    const path = receiptObjectPath("tahoe", "My Receipt.JPG", "image/jpeg");
    expect(path).toMatch(/^tahoe\/[a-z0-9]{16}\.jpg$/);
  });

  it("produces unique paths for the same inputs", () => {
    const a = receiptObjectPath("g1", "r.png", "image/png");
    const b = receiptObjectPath("g1", "r.png", "image/png");
    expect(a).not.toBe(b);
  });
});
