import { describe, expect, it } from "vitest";
import type { ConnectedBillingModel } from "./model.js";
import {
  applyOptimisticSubscriptionUpdate,
  buildSubscriptionUpdateCommand,
} from "./subscriptionCommands.js";

const NOW = "2026-07-30T12:00:00.000Z";
const PERIOD_END = "2026-08-30T12:00:00.000Z";

const model = (
  overrides: Partial<ConnectedBillingModel> = {},
): ConnectedBillingModel => ({
  user: { id: "user_1", email: "user@example.com" },
  snapshot: null,
  allProducts: [],
  ownedProductIds: ["prod_basic", "prod_pro"],
  subscriptionProductId: "prod_basic",
  activePlanId: "basic",
  appPlanActivations: [],
  appPlanAssignments: [],
  activeSubscriptions: [
    {
      id: "sub_1",
      productId: "prod_basic",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: PERIOD_END,
      currentPeriodStart: "2026-07-30T12:00:00.000Z",
      units: 2,
      recurringInterval: "every-month",
    },
  ],
  scheduledSubscriptionUpdates: [],
  hasCreemCustomer: true,
  ...overrides,
});

describe("buildSubscriptionUpdateCommand", () => {
  it("builds the app-plan wire contract used by both widget adapters", () => {
    expect(
      buildSubscriptionUpdateCommand({
        input: { kind: "app-plan", appPlanId: "community" },
        subscriptionId: "sub_1",
        updateBehavior: "immediate",
      }),
    ).toEqual({
      kind: "app-plan",
      appPlanId: "community",
      subscriptionId: "sub_1",
      updateBehavior: "immediate",
    });
  });

  it("builds paid plan and unit commands without cross-target fields", () => {
    expect(
      buildSubscriptionUpdateCommand({
        input: { kind: "plan", productId: "prod_pro" },
        subscriptionId: "sub_1",
        updateBehavior: "proration-charge",
      }),
    ).toEqual({
      kind: "plan",
      productId: "prod_pro",
      subscriptionId: "sub_1",
      updateBehavior: "proration-charge",
    });

    expect(
      buildSubscriptionUpdateCommand({
        input: { kind: "units", units: 5 },
        updateBehavior: "proration-none",
      }),
    ).toEqual({
      kind: "units",
      units: 5,
      updateBehavior: "proration-none",
    });
  });
});

describe("applyOptimisticSubscriptionUpdate", () => {
  it("projects each period-end target into one scheduled update", () => {
    const commands = [
      buildSubscriptionUpdateCommand({
        input: { kind: "plan", productId: "prod_pro" },
        subscriptionId: "sub_1",
        updateBehavior: "period-end",
      }),
      buildSubscriptionUpdateCommand({
        input: { kind: "app-plan", appPlanId: "community" },
        subscriptionId: "sub_1",
        updateBehavior: "period-end",
      }),
      buildSubscriptionUpdateCommand({
        input: { kind: "units", units: 4 },
        subscriptionId: "sub_1",
        updateBehavior: "period-end",
      }),
    ];

    expect(
      commands.map(
        (command) =>
          applyOptimisticSubscriptionUpdate({
            model: model(),
            command,
            subscriptionId: "sub_1",
            currentPeriodEnd: PERIOD_END,
            now: NOW,
          }).scheduledSubscriptionUpdates[0],
      ),
    ).toMatchObject([
      { targetProductId: "prod_pro", effectiveAt: PERIOD_END },
      { targetPlanId: "community", effectiveAt: PERIOD_END },
      { targetUnits: 4, effectiveAt: PERIOD_END },
    ]);
  });

  it("updates only the targeted subscription for immediate paid changes", () => {
    const command = buildSubscriptionUpdateCommand({
      input: { kind: "plan", productId: "prod_pro" },
      subscriptionId: "sub_1",
      updateBehavior: "proration-none",
    });

    const projected = applyOptimisticSubscriptionUpdate({
      model: model(),
      command,
      subscriptionId: "sub_1",
      now: NOW,
    });

    expect(projected.subscriptionProductId).toBe("prod_pro");
    expect(projected.activeSubscriptions[0]?.productId).toBe("prod_pro");
  });

  it("moves immediate app-plan access from the paid subscription atomically", () => {
    const command = buildSubscriptionUpdateCommand({
      input: { kind: "app-plan", appPlanId: "community" },
      subscriptionId: "sub_1",
      updateBehavior: "immediate",
    });

    const projected = applyOptimisticSubscriptionUpdate({
      model: model(),
      command,
      subscriptionId: "sub_1",
      now: NOW,
    });

    expect(projected.activePlanId).toBe("community");
    expect(projected.subscriptionProductId).toBeNull();
    expect(projected.activeSubscriptions).toEqual([]);
    expect(projected.appPlanAssignments).toContainEqual(
      expect.objectContaining({
        planId: "community",
        status: "active",
        subscriptionId: "sub_1",
      }),
    );
  });
});
