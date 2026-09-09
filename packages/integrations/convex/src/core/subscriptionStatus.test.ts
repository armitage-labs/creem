import { describe, it, expect } from "vitest";
import {
  isActiveSubscriptionStatus,
  isTerminalSubscriptionStatus,
} from "./subscriptionStatus.js";

describe("isActiveSubscriptionStatus", () => {
  it("grants access for active-like statuses", () => {
    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
    expect(isActiveSubscriptionStatus("scheduled_cancel")).toBe(true);
  });

  it("keeps access during the past_due dunning grace period", () => {
    // past_due is a retry window, not a loss of access — the payment recovery
    // banner nudges the customer while the subscription still works.
    expect(isActiveSubscriptionStatus("past_due")).toBe(true);
  });

  it("denies access for suspended and terminal statuses", () => {
    // The whole point of gating on status rather than existence: these
    // subscriptions are still returned by the queries but must not grant access.
    expect(isActiveSubscriptionStatus("unpaid")).toBe(false);
    expect(isActiveSubscriptionStatus("paused")).toBe(false);
    expect(isActiveSubscriptionStatus("canceled")).toBe(false);
    expect(isActiveSubscriptionStatus("expired")).toBe(false);
  });

  it("denies access for unknown, null, and undefined statuses", () => {
    expect(isActiveSubscriptionStatus("something_new")).toBe(false);
    expect(isActiveSubscriptionStatus(null)).toBe(false);
    expect(isActiveSubscriptionStatus(undefined)).toBe(false);
  });
});

describe("isTerminalSubscriptionStatus", () => {
  it("treats canceled and expired as terminal", () => {
    expect(isTerminalSubscriptionStatus("canceled")).toBe(true);
    expect(isTerminalSubscriptionStatus("expired")).toBe(true);
  });

  it("does not treat recoverable statuses as terminal", () => {
    // These rows stay open so payment-recovery UI can still act on them.
    expect(isTerminalSubscriptionStatus("unpaid")).toBe(false);
    expect(isTerminalSubscriptionStatus("past_due")).toBe(false);
    expect(isTerminalSubscriptionStatus("paused")).toBe(false);
    expect(isTerminalSubscriptionStatus("active")).toBe(false);
    expect(isTerminalSubscriptionStatus(null)).toBe(false);
  });
});
