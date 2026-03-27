import { describe, expect, it } from "vitest";
import {
  hasBillingAction,
  isOneTimeBilling,
  isEnterpriseBilling,
  shouldShowBillingCycleToggle,
  isTerminalPaymentStatus,
} from "./selectors.js";
import type { BillingSnapshot } from "./types.js";

const makeSnapshot = (
  overrides: Partial<BillingSnapshot> = {},
): BillingSnapshot => ({
  resolvedAt: new Date().toISOString(),
  activePlanId: null,
  activeCategory: "paid",
  billingType: "recurring",
  availableBillingCycles: [],
  payment: null,
  availableActions: [],
  ...overrides,
});

describe("hasBillingAction", () => {
  it("returns true when action is present", () => {
    const snapshot = makeSnapshot({ availableActions: ["checkout", "portal"] });
    expect(hasBillingAction(snapshot, "checkout")).toBe(true);
    expect(hasBillingAction(snapshot, "portal")).toBe(true);
  });

  it("returns false when action is absent", () => {
    const snapshot = makeSnapshot({ availableActions: ["checkout"] });
    expect(hasBillingAction(snapshot, "cancel")).toBe(false);
  });
});

describe("isOneTimeBilling", () => {
  it("returns true for onetime billing type", () => {
    expect(isOneTimeBilling(makeSnapshot({ billingType: "onetime" }))).toBe(
      true,
    );
  });

  it("returns false for recurring billing type", () => {
    expect(isOneTimeBilling(makeSnapshot({ billingType: "recurring" }))).toBe(
      false,
    );
  });
});

describe("isEnterpriseBilling", () => {
  it("returns true for enterprise category", () => {
    expect(
      isEnterpriseBilling(makeSnapshot({ activeCategory: "enterprise" })),
    ).toBe(true);
  });

  it("returns false for paid category", () => {
    expect(isEnterpriseBilling(makeSnapshot({ activeCategory: "paid" }))).toBe(
      false,
    );
  });
});

describe("shouldShowBillingCycleToggle", () => {
  it("returns true when recurring with multiple cycles and switch_interval action", () => {
    const snapshot = makeSnapshot({
      billingType: "recurring",
      availableBillingCycles: ["every-month", "every-year"],
      availableActions: ["switch_interval", "portal"],
    });
    expect(shouldShowBillingCycleToggle(snapshot)).toBe(true);
  });

  it("returns false when only one cycle available", () => {
    const snapshot = makeSnapshot({
      billingType: "recurring",
      availableBillingCycles: ["every-month"],
      availableActions: ["switch_interval"],
    });
    expect(shouldShowBillingCycleToggle(snapshot)).toBe(false);
  });

  it("returns false when onetime billing type", () => {
    const snapshot = makeSnapshot({
      billingType: "onetime",
      availableBillingCycles: ["every-month", "every-year"],
      availableActions: ["switch_interval"],
    });
    expect(shouldShowBillingCycleToggle(snapshot)).toBe(false);
  });

  it("returns false when switch_interval action is not available", () => {
    const snapshot = makeSnapshot({
      billingType: "recurring",
      availableBillingCycles: ["every-month", "every-year"],
      availableActions: ["portal"],
    });
    expect(shouldShowBillingCycleToggle(snapshot)).toBe(false);
  });
});

describe("isTerminalPaymentStatus", () => {
  it("returns true for paid", () => {
    expect(isTerminalPaymentStatus("paid")).toBe(true);
  });

  it("returns true for refunded", () => {
    expect(isTerminalPaymentStatus("refunded")).toBe(true);
  });

  it("returns true for partially_refunded", () => {
    expect(isTerminalPaymentStatus("partially_refunded")).toBe(true);
  });

  it("returns false for pending", () => {
    expect(isTerminalPaymentStatus("pending")).toBe(false);
  });
});
