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

  it("peek returns the saved intent without consuming it", () => {
    pendingCheckout.save({ productId: "prod_peek", units: 2 });

    // React StrictMode invokes effects twice; the first read must not destroy
    // the intent before the second invocation can act on it.
    expect(pendingCheckout.peek()).toEqual({
      productId: "prod_peek",
      units: 2,
    });
    expect(pendingCheckout.peek()).toEqual({
      productId: "prod_peek",
      units: 2,
    });
    expect(sessionStorage.getItem("creem:pending-checkout")).not.toBeNull();
  });

  it("peek returns null when nothing is saved", () => {
    expect(pendingCheckout.peek()).toBeNull();
  });
});
