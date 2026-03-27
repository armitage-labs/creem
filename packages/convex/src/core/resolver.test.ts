import { describe, expect, it } from "vitest";
import { resolveBillingSnapshot } from "./resolver.js";

describe("resolveBillingSnapshot", () => {
  it("maps recurring subscription intervals and seat actions", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "pro",
            category: "paid",
            billingType: "recurring",
            billingCycles: ["every-month", "every-year"],
            pricingModel: "seat",
            creemProductIds: {
              monthly: "prod_monthly",
              yearly: "prod_yearly",
            },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_monthly",
        status: "active",
        recurringInterval: "every-month",
        seats: 5,
      },
    });

    expect(snapshot.activePlanId).toBe("pro");
    expect(snapshot.recurringCycle).toBe("every-month");
    expect(snapshot.availableActions).toContain("switch_interval");
    expect(snapshot.availableActions).toContain("update_seats");
  });

  it("supports one-time payments", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "credits",
            category: "paid",
            billingType: "onetime",
            creemProductIds: { default: "prod_credits" },
          },
        ],
      },
      payment: {
        status: "pending",
        productId: "prod_credits",
      },
    });

    expect(snapshot.billingType).toBe("onetime");
    expect(snapshot.payment?.status).toBe("pending");
    expect(snapshot.availableActions).toEqual(["checkout"]);
  });

  it("maps trialing subscription to trial category with trialEnd in metadata", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "basic",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_basic" },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_basic",
        status: "trialing",
        recurringInterval: "every-month",
        trialEnd: "2026-03-04T08:23:39.000Z",
      },
    });

    expect(snapshot.activeCategory).toBe("trial");
    expect(snapshot.subscriptionState).toBe("trialing");
    expect(snapshot.metadata?.trialEnd).toBe("2026-03-04T08:23:39.000Z");
    expect(snapshot.availableActions).toContain("cancel");
  });

  it("falls back to custom category when no catalog mapping exists", () => {
    const snapshot = resolveBillingSnapshot({
      currentSubscription: {
        status: "unpaid",
      },
    });

    expect(snapshot.activeCategory).toBe("custom");
    expect(snapshot.availableActions).toEqual(["portal"]);
  });

  it("maps scheduled_cancel to paid with cancel + reactivate actions", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "pro",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_1" },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_1",
        status: "scheduled_cancel",
        recurringInterval: "every-month",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: "2026-03-01T00:00:00.000Z",
      },
    });

    expect(snapshot.activeCategory).toBe("paid");
    expect(snapshot.subscriptionState).toBe("scheduled_cancel");
    expect(snapshot.availableActions).toContain("cancel");
    expect(snapshot.availableActions).toContain("reactivate");
    expect(snapshot.availableActions).toContain("portal");
    expect(snapshot.metadata?.cancelAtPeriodEnd).toBe(true);
  });

  it("maps past_due subscription to paid category", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "basic",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_basic" },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_basic",
        status: "past_due",
        recurringInterval: "every-month",
      },
    });

    expect(snapshot.activeCategory).toBe("paid");
    expect(snapshot.subscriptionState).toBe("past_due");
    expect(snapshot.availableActions).toContain("portal");
  });

  it("maps enterprise plan to contact_sales action only", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "enterprise",
            category: "enterprise",
            billingType: "custom",
            creemProductIds: { default: "prod_ent" },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_ent",
        status: "active",
        recurringInterval: "every-month",
      },
    });

    expect(snapshot.activeCategory).toBe("enterprise");
    expect(snapshot.availableActions).toEqual(["contact_sales"]);
  });

  it("returns checkout action when no subscription exists", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "pro",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_1" },
          },
        ],
      },
    });

    expect(snapshot.availableActions).toEqual(["checkout"]);
    expect(snapshot.activePlanId).toBeNull();
  });

  it("maps canceled subscription to paid with reactivate action", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        plans: [
          {
            planId: "pro",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_1" },
          },
        ],
      },
      currentSubscription: {
        productId: "prod_1",
        status: "canceled",
        recurringInterval: "every-month",
      },
    });

    expect(snapshot.activeCategory).toBe("paid");
    expect(snapshot.availableActions).toContain("reactivate");
    expect(snapshot.availableActions).toContain("portal");
  });

  it("uses defaultPlanId as fallback when no subscription product matches", () => {
    const snapshot = resolveBillingSnapshot({
      catalog: {
        version: "1",
        defaultPlanId: "free",
        plans: [
          {
            planId: "free",
            category: "free",
            billingType: "custom",
          },
          {
            planId: "pro",
            category: "paid",
            billingType: "recurring",
            creemProductIds: { "every-month": "prod_1" },
          },
        ],
      },
    });

    expect(snapshot.activePlanId).toBe("free");
    expect(snapshot.activeCategory).toBe("free");
  });

  it("infers onetime billing type from payment when no plan exists", () => {
    const snapshot = resolveBillingSnapshot({
      payment: {
        status: "pending",
        productId: "prod_unknown",
      },
    });

    expect(snapshot.billingType).toBe("onetime");
    expect(snapshot.activePlanId).toBeNull();
    expect(snapshot.availableActions).toEqual(["checkout"]);
  });

  it("infers recurring billing type from subscription when no plan exists", () => {
    const snapshot = resolveBillingSnapshot({
      currentSubscription: {
        status: "active",
        recurringInterval: "every-year",
      },
    });

    expect(snapshot.billingType).toBe("recurring");
    expect(snapshot.recurringCycle).toBe("every-year");
    expect(snapshot.availableBillingCycles).toEqual(["every-year"]);
  });

  it("normalizes unknown recurring interval to custom", () => {
    const snapshot = resolveBillingSnapshot({
      currentSubscription: {
        status: "active",
        recurringInterval: "every-two-weeks",
      },
    });

    expect(snapshot.recurringCycle).toBe("custom");
  });
});
