// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { pendingCheckout } from "./pendingCheckout.js";

describe("pendingCheckout", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("save stores intent in sessionStorage", () => {
    pendingCheckout.save({ productId: "prod_123" });
    const raw = sessionStorage.getItem("creem:pending-checkout");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ productId: "prod_123" });
  });

  it("save stores intent with units", () => {
    pendingCheckout.save({ productId: "prod_abc", units: 5 });
    const raw = sessionStorage.getItem("creem:pending-checkout");
    expect(JSON.parse(raw!)).toEqual({ productId: "prod_abc", units: 5 });
  });

  it("load returns the saved intent and clears storage", () => {
    pendingCheckout.save({ productId: "prod_xyz" });
    const intent = pendingCheckout.load();
    expect(intent).toEqual({ productId: "prod_xyz" });
    // Should be cleared after load
    expect(sessionStorage.getItem("creem:pending-checkout")).toBeNull();
  });

  it("load returns null when nothing is saved", () => {
    expect(pendingCheckout.load()).toBeNull();
  });

  it("clear removes the saved intent", () => {
    pendingCheckout.save({ productId: "prod_del" });
    pendingCheckout.clear();
    expect(sessionStorage.getItem("creem:pending-checkout")).toBeNull();
  });

  it("clear is safe when nothing is saved", () => {
    expect(() => pendingCheckout.clear()).not.toThrow();
  });
});
