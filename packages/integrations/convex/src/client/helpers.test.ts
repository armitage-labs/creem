import { describe, it, expect } from "vitest";
import {
  getEntityId,
  lowerCaseHeaders,
  toHex,
  constantTimeEqual,
  normalizeSignature,
} from "./helpers.js";

describe("getEntityId", () => {
  it("returns a string value directly", () => {
    expect(getEntityId("user_123")).toBe("user_123");
  });

  it("returns null for null/undefined", () => {
    expect(getEntityId(null)).toBeNull();
    expect(getEntityId(undefined)).toBeNull();
  });

  it("extracts id from an object with a string id", () => {
    expect(getEntityId({ id: "cust_abc" })).toBe("cust_abc");
  });

  it("returns null for an object with a non-string id", () => {
    expect(getEntityId({ id: 42 })).toBeNull();
  });

  it("returns null for an object without id", () => {
    expect(getEntityId({ name: "test" })).toBeNull();
  });

  it("returns null for non-object non-string values", () => {
    expect(getEntityId(42)).toBeNull();
    expect(getEntityId(true)).toBeNull();
  });

  it("returns empty string if value is empty string", () => {
    expect(getEntityId("")).toBe("");
  });
});

describe("lowerCaseHeaders", () => {
  it("lowercases all header keys", () => {
    const result = lowerCaseHeaders({
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    });
    expect(result).toEqual({
      "content-type": "application/json",
      "x-custom-header": "value",
    });
  });

  it("preserves header values", () => {
    const result = lowerCaseHeaders({ "Webhook-Signature": "ABC123" });
    expect(result["webhook-signature"]).toBe("ABC123");
  });

  it("handles empty object", () => {
    expect(lowerCaseHeaders({})).toEqual({});
  });

  it("handles already-lowercase keys", () => {
    const result = lowerCaseHeaders({ "webhook-id": "123" });
    expect(result["webhook-id"]).toBe("123");
  });
});

describe("toHex", () => {
  it("converts bytes to hex string", () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
  });

  it("returns empty string for empty array", () => {
    expect(toHex(new Uint8Array([]))).toBe("");
  });

  it("pads single-digit hex values", () => {
    expect(toHex(new Uint8Array([0]))).toBe("00");
    expect(toHex(new Uint8Array([5]))).toBe("05");
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("ab", "abc")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("returns false when one is empty", () => {
    expect(constantTimeEqual("", "a")).toBe(false);
  });

  it("handles long hex strings (typical HMAC comparison)", () => {
    const sig =
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    expect(constantTimeEqual(sig, sig)).toBe(true);
    const tampered = sig.slice(0, -1) + "0";
    expect(constantTimeEqual(sig, tampered)).toBe(false);
  });
});

describe("normalizeSignature", () => {
  it("strips sha256= prefix and lowercases", () => {
    expect(normalizeSignature("sha256=ABCDEF")).toBe("abcdef");
  });

  it("lowercases when no prefix", () => {
    expect(normalizeSignature("ABCDEF")).toBe("abcdef");
  });

  it("trims whitespace", () => {
    expect(normalizeSignature("  sha256=ABC  ")).toBe("abc");
  });

  it("handles empty string", () => {
    expect(normalizeSignature("")).toBe("");
  });

  it("handles sha256= prefix with mixed case hex", () => {
    expect(normalizeSignature("sha256=aAbBcC")).toBe("aabbcc");
  });

  it("does not strip sha256 without = sign", () => {
    // "sha256abc" should NOT strip anything — the prefix is "sha256="
    expect(normalizeSignature("sha256abc")).toBe("sha256abc");
  });
});
