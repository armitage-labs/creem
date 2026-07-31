import { describe, it, expect } from "vitest";
import { resolveBillingSnapshot } from "./resolver.js";
import type { PlanCatalog, SubscriptionSnapshot } from "./types.js";

const catalog: PlanCatalog = {
  version: "1",
  defaultPlanId: "free",
  plans: [
    { planId: "free", category: "free" },
    {
      planId: "basic",
      category: "paid",
      billingType: "recurring",
      billingCycles: ["every-month", "every-year"],
      creemProductIds: {
        "every-month": "prod_basic_m",
        "every-year": "prod_basic_y",
      },
    },
    {
      planId: "addon",
      category: "paid",
      billingType: "recurring",
      creemProductIds: { "every-month": "prod_addon_m" },
      metadata: { kind: "addon" },
    },
  ],
};

describe("resolveBillingSnapshot", () => {
  it("returns empty arrays with no subscriptions or orders", () => {
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      now: "2025-01-01T00:00:00Z",
    });
    expect(result.subscriptions).toHaveLength(0);
    expect(result.orders).toHaveLength(0);
    expect(result.appPlanAssignments).toHaveLength(0);
    expect(result.access).toHaveLength(0);
    expect(result.paymentRecoveryState).toBe("none");
    expect(result.availableBillingActions).toContain("checkout");
    expect(result.entityId).toBe("e1");
    expect(result.catalogVersion).toBe("1");
  });

  it("does not grant entitlements for a trial that has already lapsed", () => {
    // The snapshot is built from ALL subscriptions, including expired trials,
    // and Creem does not necessarily flip the status the moment a trial ends.
    // Gating on status alone would keep a lapsed trial entitled indefinitely.
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      now: "2025-01-02T00:00:00Z",
      subscriptions: [
        {
          id: "sub_1",
          productId: "prod_basic_m",
          status: "trialing",
          trialEnd: "2025-01-01T00:00:00Z",
        },
      ],
    });

    expect(result.access).toHaveLength(0);
    expect(result.availableBillingActions).toContain("checkout");
    expect(result.availableBillingActions).not.toContain("cancel");
  });

  it("grants entitlements for a trial that is still running", () => {
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      now: "2025-01-02T00:00:00Z",
      subscriptions: [
        {
          id: "sub_1",
          productId: "prod_basic_m",
          status: "trialing",
          trialEnd: "2025-02-01T00:00:00Z",
        },
      ],
    });

    expect(result.access).toHaveLength(1);
    expect(result.access[0]).toMatchObject({
      kind: "subscription",
      subscriptionId: "sub_1",
      status: "trialing",
    });
    expect(result.availableBillingActions).toContain("cancel");
  });

  it("maps subscriptions with plan IDs from catalog", () => {
    const subs: SubscriptionSnapshot[] = [
      {
        id: "sub_1",
        productId: "prod_basic_m",
        status: "active",
        recurringInterval: "every-month",
        units: 5,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2025-02-01T00:00:00Z",
      },
      {
        id: "sub_2",
        productId: "prod_addon_m",
        status: "active",
        recurringInterval: "every-month",
      },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
      now: "2025-01-15T00:00:00Z",
    });
    expect(result.subscriptions).toHaveLength(2);

    const basic = result.subscriptions.find((s) => s.planId === "basic");
    expect(basic).toBeDefined();
    expect(basic!.productId).toBe("prod_basic_m");
    expect(basic!.subscriptionId).toBe("sub_1");
    expect(basic!.status).toBe("active");
    expect(basic!.recurringCycle).toBe("every-month");
    expect(basic!.units).toBe(5);

    const addon = result.subscriptions.find((s) => s.planId === "addon");
    expect(addon).toBeDefined();
    expect(addon!.kind).toBe("addon");

    expect(result.paymentRecoveryState).toBe("none");
    expect(result.availableBillingActions).toContain("portal");
    expect(result.availableBillingActions).toContain("cancel");
    expect(result.access).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "creem_subscription",
          kind: "subscription",
          planId: "basic",
          subscriptionId: "sub_1",
        }),
        expect.objectContaining({
          source: "creem_subscription",
          kind: "subscription",
          planId: "addon",
          subscriptionId: "sub_2",
        }),
      ]),
    );
  });

  it("maps orders with plan IDs from catalog", () => {
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      orders: [
        { orderId: "ord_1", productId: "prod_basic_m", status: "paid" },
        { orderId: "ord_2", productId: "prod_unknown", status: "paid" },
      ],
    });
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].planId).toBe("basic");
    expect(result.orders[1].planId).toBeNull();
    expect(result.access).toEqual([
      expect.objectContaining({
        source: "creem_order",
        kind: "one_time",
        orderId: "ord_1",
        productId: "prod_basic_m",
      }),
      expect.objectContaining({
        source: "creem_order",
        kind: "one_time",
        orderId: "ord_2",
        productId: "prod_unknown",
      }),
    ]);
    expect(result.availableBillingActions).toContain("checkout");
  });

  it("includes active app-owned plan assignments in the unified access view", () => {
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      appPlanAssignments: [
        {
          entityId: "e1",
          planId: "free",
          status: "active",
          startsAt: "2025-01-01T00:00:00Z",
          source: "manual",
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
        {
          entityId: "e1",
          planId: "trial",
          status: "ended",
          startsAt: "2024-01-01T00:00:00Z",
          endsAt: "2024-02-01T00:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-02-01T00:00:00Z",
        },
      ],
    });

    expect(result.appPlanAssignments).toHaveLength(2);
    expect(result.access).toEqual([
      expect.objectContaining({
        source: "app_plan_assignment",
        kind: "app_plan",
        planId: "free",
        status: "active",
        assignmentSource: "manual",
      }),
    ]);
  });

  it("derives warning recovery state from past_due subscriptions", () => {
    const subs: SubscriptionSnapshot[] = [
      { id: "sub_1", productId: "prod_basic_m", status: "past_due" },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
    });
    expect(result.paymentRecoveryState).toBe("warning");
  });

  it("derives blocked recovery state from unpaid subscriptions", () => {
    const subs: SubscriptionSnapshot[] = [
      { id: "sub_1", productId: "prod_basic_m", status: "unpaid" },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
    });
    expect(result.paymentRecoveryState).toBe("blocked");
  });

  it("includes reactivate action for canceled subscriptions alongside active", () => {
    const subs: SubscriptionSnapshot[] = [
      { id: "sub_1", productId: "prod_basic_m", status: "active" },
      { id: "sub_2", productId: "prod_addon_m", status: "canceled" },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
    });
    expect(result.availableBillingActions).toContain("reactivate");
    expect(result.availableBillingActions).toContain("cancel");
  });

  it("offers checkout when only canceled subscriptions exist", () => {
    const subs: SubscriptionSnapshot[] = [
      { id: "sub_1", productId: "prod_basic_m", status: "canceled" },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
    });
    expect(result.availableBillingActions).toContain("checkout");
    expect(result.availableBillingActions).toContain("reactivate");
  });

  it("handles subscriptions with unknown product IDs gracefully", () => {
    const subs: SubscriptionSnapshot[] = [
      { id: "sub_1", productId: "prod_unknown", status: "active" },
    ];
    const result = resolveBillingSnapshot({
      entityId: "e1",
      catalog,
      subscriptions: subs,
    });
    expect(result.subscriptions[0].planId).toBeNull();
    expect(result.subscriptions[0].productId).toBe("prod_unknown");
  });

  it("ignores a non-string catalog metadata.kind", () => {
    // `metadata` is app-authored `Record<string, unknown>`. A non-string `kind`
    // must not reach the snapshot, which validates it as an optional string.
    const snapshot = resolveBillingSnapshot({
      entityId: "e1",
      catalog: {
        version: "1",
        plans: [
          {
            planId: "weird",
            category: "paid",
            creemProductIds: { "every-month": "prod_weird" },
            metadata: { kind: 42 },
          },
        ],
      },
      subscriptions: [
        { id: "sub_1", productId: "prod_weird", status: "active" },
      ],
    });
    expect(snapshot.subscriptions[0].kind).toBeUndefined();
  });
});
