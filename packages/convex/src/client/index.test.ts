import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { Creem, CreemNotAuthenticatedError } from "./index.js";
import { defineBillingCatalog } from "../core/catalog.js";
import type { ComponentApi } from "../component/_generated/component.js";
import type {
  SubscriptionUpdateArgs,
  SubscriptionUpdateWireArgs,
} from "../core/types.js";
import { parseSubscriptionUpdateArgs } from "../core/validators.js";

type AnyFn = (...args: any[]) => any;

// ── Mock component with symbolic function references ────────────────

const REFS = {
  getCustomerByEntityId: Symbol("getCustomerByEntityId"),
  getCurrentSubscription: Symbol("getCurrentSubscription"),
  getSubscription: Symbol("getSubscription"),
  getProduct: Symbol("getProduct"),
  listProducts: Symbol("listProducts"),
  listUserSubscriptions: Symbol("listUserSubscriptions"),
  listAllUserSubscriptions: Symbol("listAllUserSubscriptions"),
  listUserOrders: Symbol("listUserOrders"),
  insertCustomer: Symbol("insertCustomer"),
  patchSubscription: Symbol("patchSubscription"),
  createSubscription: Symbol("createSubscription"),
  updateSubscription: Symbol("updateSubscription"),
  createProduct: Symbol("createProduct"),
  updateProduct: Symbol("updateProduct"),
  createOrder: Symbol("createOrder"),
  syncProducts: Symbol("syncProducts"),
  executeSubscriptionUpdate: Symbol("executeSubscriptionUpdate"),
  executeSubscriptionLifecycle: Symbol("executeSubscriptionLifecycle"),
  createScheduledSubscriptionUpdate: Symbol(
    "createScheduledSubscriptionUpdate",
  ),
  cancelScheduledSubscriptionUpdate: Symbol(
    "cancelScheduledSubscriptionUpdate",
  ),
  cancelPendingScheduledSubscriptionUpdates: Symbol(
    "cancelPendingScheduledSubscriptionUpdates",
  ),
  setScheduledSubscriptionUpdateJob: Symbol(
    "setScheduledSubscriptionUpdateJob",
  ),
  applyScheduledSubscriptionUpdate: Symbol("applyScheduledSubscriptionUpdate"),
  listPendingScheduledSubscriptionUpdates: Symbol(
    "listPendingScheduledSubscriptionUpdates",
  ),
  listAppPlanActivations: Symbol("listAppPlanActivations"),
  listAppPlanAssignments: Symbol("listAppPlanAssignments"),
  recordAppPlanActivation: Symbol("recordAppPlanActivation"),
  assignAppPlan: Symbol("assignAppPlan"),
  cancelScheduledAppPlanAssignment: Symbol("cancelScheduledAppPlanAssignment"),
  endActiveAppPlanAssignments: Symbol("endActiveAppPlanAssignments"),
} as const;

const mockComponent = {
  lib: { ...REFS },
} as unknown as ComponentApi;

// ── Mock ctx factory ────────────────────────────────────────────────

function createMockCtx(queryMap: Record<symbol, unknown> = {}) {
  return {
    runQuery: vi.fn(async (ref: symbol, _args?: unknown) => {
      if (ref in queryMap) return queryMap[ref as keyof typeof queryMap];
      // Check if queryMap has a function for dynamic responses
      const entry = queryMap[ref as keyof typeof queryMap];
      return entry ?? null;
    }),
    runMutation: vi.fn(async (ref: symbol): Promise<unknown> => {
      if (ref === REFS.createScheduledSubscriptionUpdate) {
        return "scheduled_update_1";
      }
      if (ref === REFS.cancelScheduledSubscriptionUpdate) {
        return null;
      }
      if (ref === REFS.cancelPendingScheduledSubscriptionUpdates) {
        return [];
      }
      if (ref === REFS.assignAppPlan) {
        return { createdAt: "2026-02-01T00:00:00.000Z" };
      }
    }),
    runAction: vi.fn(async () => {}),
    scheduler: {
      runAfter: vi.fn(async () => {}),
      runAt: vi.fn(async () => "scheduled_fn_1"),
    },
  };
}

// ── Test subscription fixture ───────────────────────────────────────

const ACTIVE_SUB = {
  id: "sub_1",
  customerId: "cust_1",
  productId: "prod_1",
  status: "active" as const,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-03-01T00:00:00Z",
  currentPeriodStart: "2026-02-01T00:00:00Z",
  recurringInterval: "every-month",
  seats: 1,
  trialEnd: null,
  entityId: "user_1",
};

const PRODUCT_1 = {
  id: "prod_1",
  name: "Pro Plan",
  price: 2999,
  currency: "USD",
  billingType: "recurring",
  billingPeriod: "every-month",
  status: "active",
  defaultSuccessUrl: null,
};

const ORDER_1 = {
  id: "ord_1",
  customerId: "cust_1",
  productId: "prod_1",
  amount: 2999,
  currency: "USD",
  status: "paid",
  type: "onetime",
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
};

const TEST_BILLING_CATALOG = defineBillingCatalog({
  version: "test",
  plans: [
    {
      planId: "pro",
      category: "paid",
      billingType: "recurring",
      creemProductIds: {
        "every-month": "prod_1",
      },
    },
  ],
});

const ELIGIBILITY_BILLING_CATALOG = defineBillingCatalog({
  version: "eligibility-test",
  plans: [
    {
      planId: "trial",
      category: "trial",
      billingType: "custom",
      eligibilityScopeId: "base",
      eligibility: {
        oncePerEntity: true,
        expiresWhenScopeHasNonTrialPlan: true,
      },
    },
    {
      planId: "pro",
      category: "paid",
      billingType: "recurring",
      eligibilityScopeId: "base",
      creemProductIds: {
        "every-month": "prod_1",
      },
    },
  ],
});

// ── Constructor ─────────────────────────────────────────────────────

describe("Creem constructor", () => {
  it("uses config values for apiKey and webhookSecret", () => {
    const creem = new Creem(mockComponent, {
      apiKey: "test_key",
      webhookSecret: "test_secret",
    });
    expect(creem.sdk).toBeDefined();
  });

  it("falls back to env vars when config values not provided", () => {
    const origKey = process.env["CREEM_API_KEY"];
    const origSecret = process.env["CREEM_WEBHOOK_SECRET"];
    process.env["CREEM_API_KEY"] = "env_key";
    process.env["CREEM_WEBHOOK_SECRET"] = "env_secret";
    try {
      const creem = new Creem(mockComponent);
      expect(creem.sdk).toBeDefined();
    } finally {
      if (origKey !== undefined) process.env["CREEM_API_KEY"] = origKey;
      else delete process.env["CREEM_API_KEY"];
      if (origSecret !== undefined)
        process.env["CREEM_WEBHOOK_SECRET"] = origSecret;
      else delete process.env["CREEM_WEBHOOK_SECRET"];
    }
  });

  it("accepts server and serverURL config", () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      server: "test",
      serverURL: "https://custom.creem.io",
    });
    expect(creem.sdk).toBeDefined();
  });

  it("passes CREEM_SERVER env fallback to component actions", async () => {
    const originalServer = process.env["CREEM_SERVER"];
    process.env["CREEM_SERVER"] = "test";
    try {
      const creem = new Creem(mockComponent, {
        apiKey: "test_key",
        webhookSecret: "s",
      });
      const ctx = createMockCtx();
      await creem.syncProducts(ctx as never);
      expect(ctx.runAction).toHaveBeenCalledWith(REFS.syncProducts, {
        apiKey: "test_key",
        server: "test",
        serverURL: undefined,
      });
    } finally {
      if (originalServer !== undefined) {
        process.env["CREEM_SERVER"] = originalServer;
      } else {
        delete process.env["CREEM_SERVER"];
      }
    }
  });
});

describe("appPlans namespace", () => {
  it("enforces once-per-entity eligibility before writing", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "s",
      billingCatalog: ELIGIBILITY_BILLING_CATALOG,
    });
    const ctx = createMockCtx({
      [REFS.listAppPlanActivations]: [
        {
          entityId: "user_1",
          planId: "trial",
          firstActivatedAt: 1,
          lastActivatedAt: 1,
          activationCount: 1,
        },
      ],
      [REFS.listAppPlanAssignments]: [],
      [REFS.listUserSubscriptions]: [],
      [REFS.listPendingScheduledSubscriptionUpdates]: [],
    });

    await expect(
      creem.appPlans.activate(ctx as never, {
        entityId: "user_1",
        planId: "trial",
        activatedByUserId: "user_1",
      }),
    ).rejects.toThrow('Plan "trial" is not eligible');
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("rejects a scoped trial when a paid plan in that scope is active", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "s",
      billingCatalog: ELIGIBILITY_BILLING_CATALOG,
    });
    const ctx = createMockCtx({
      [REFS.listAppPlanActivations]: [],
      [REFS.listAppPlanAssignments]: [],
      [REFS.listUserSubscriptions]: [ACTIVE_SUB],
      [REFS.listPendingScheduledSubscriptionUpdates]: [],
    });

    await expect(
      creem.appPlans.activate(ctx as never, {
        entityId: "user_1",
        planId: "trial",
        activatedByUserId: "user_1",
      }),
    ).rejects.toThrow('Plan "trial" is not eligible');
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});

// ── Namespace getters: products / customers / orders ────────────────

describe("products namespace", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  it("list delegates to listProducts query", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [PRODUCT_1],
    });
    const result = await creem.products.list(ctx as never);
    expect(ctx.runQuery).toHaveBeenCalledWith(REFS.listProducts, {
      includeArchived: undefined,
    });
    expect(result).toEqual([PRODUCT_1]);
  });

  it("get delegates to getProduct query", async () => {
    const ctx = createMockCtx({
      [REFS.getProduct]: PRODUCT_1,
    });
    const result = await creem.products.get(ctx as never, {
      productId: "prod_1",
    });
    expect(ctx.runQuery).toHaveBeenCalledWith(REFS.getProduct, {
      id: "prod_1",
    });
    expect(result).toEqual(PRODUCT_1);
  });
});

describe("customers namespace", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  it("retrieve delegates to getCustomerByEntityId query", async () => {
    const mockCustomer = { id: "cust_1", entityId: "user_1" };
    const ctx = createMockCtx({
      [REFS.getCustomerByEntityId]: mockCustomer,
    });
    const result = await creem.customers.retrieve(ctx as never, {
      entityId: "user_1",
    });
    expect(result).toEqual(mockCustomer);
  });

  it("portalUrl throws when customer not found", async () => {
    const ctx = createMockCtx({
      [REFS.getCustomerByEntityId]: null,
    });
    await expect(
      creem.customers.portalUrl(ctx as never, { entityId: "user_1" }),
    ).rejects.toThrow("Customer not found");
  });
});

describe("orders namespace", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  it("list delegates to listUserOrders query", async () => {
    const orders = [{ id: "ord_1", productId: "prod_1" }];
    const ctx = createMockCtx({
      [REFS.listUserOrders]: orders,
    });
    const result = await creem.orders.list(ctx as never, {
      entityId: "user_1",
    });
    expect(result).toEqual(orders);
  });
});

// ── subscriptions namespace ─────────────────────────────────────────

describe("subscriptions namespace", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  describe("getCurrent", () => {
    it("returns subscription with product when found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
        [REFS.getProduct]: PRODUCT_1,
      });
      const result = await creem.subscriptions.getCurrent(ctx as never, {
        entityId: "user_1",
      });
      expect(result).toEqual({ ...ACTIVE_SUB, product: PRODUCT_1 });
    });

    it("returns null when no subscription", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      const result = await creem.subscriptions.getCurrent(ctx as never, {
        entityId: "user_1",
      });
      expect(result).toBeNull();
    });

    it("throws when product not found for subscription", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
        [REFS.getProduct]: null,
      });
      await expect(
        creem.subscriptions.getCurrent(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Product not found");
    });
  });

  describe("update", () => {
    it("makes invalid update combinations unrepresentable", () => {
      // The discriminated union replaces the runtime guards that used to reject
      // multiple targets, a missing target, or "immediate" on a paid switch.
      const bothTargets: SubscriptionUpdateArgs = {
        kind: "plan",
        productId: "prod_2",
        // @ts-expect-error - a plan switch cannot also carry appPlanId
        appPlanId: "free",
      };
      const planWithUnits: SubscriptionUpdateArgs = {
        kind: "plan",
        productId: "prod_2",
        // @ts-expect-error - a plan switch keeps the current quantity
        units: 5,
      };
      // @ts-expect-error - every variant requires a target
      const noTarget: SubscriptionUpdateArgs = { kind: "plan" };
      // @ts-expect-error - "immediate" is only valid for app-plan switches
      const immediatePaid: SubscriptionUpdateArgs = {
        kind: "plan",
        productId: "prod_2",
        updateBehavior: "immediate",
      };
      // @ts-expect-error - proration behaviors are not valid for app-plan switches
      const proratedAppPlan: SubscriptionUpdateArgs = {
        kind: "app-plan",
        appPlanId: "free",
        updateBehavior: "proration-charge",
      };
      expect([
        bothTargets,
        planWithUnits,
        noTarget,
        immediatePaid,
        proratedAppPlan,
      ]).toHaveLength(5);
    });

    it.each([
      [{ kind: "plan" as const }, 'kind: "plan" requires productId'],
      [
        { kind: "plan" as const, productId: "p", appPlanId: "free" },
        'kind: "plan" cannot also set appPlanId',
      ],
      [
        { kind: "plan" as const, productId: "p", units: 5 },
        'kind: "plan" cannot also set units',
      ],
      [
        {
          kind: "plan" as const,
          productId: "p",
          updateBehavior: "immediate" as const,
        },
        'updateBehavior: "immediate" is not valid for a paid plan switch',
      ],
      [{ kind: "units" as const }, 'kind: "units" requires units'],
      [
        { kind: "units" as const, units: 3, productId: "p" },
        'kind: "units" cannot also set productId',
      ],
      [{ kind: "app-plan" as const }, 'kind: "app-plan" requires appPlanId'],
      [
        { kind: "app-plan" as const, appPlanId: "free", productId: "p" },
        'kind: "app-plan" cannot also set productId or units',
      ],
      [
        { kind: "app-plan" as const, appPlanId: "free", units: 5 },
        'kind: "app-plan" cannot also set productId or units',
      ],
      [
        {
          kind: "app-plan" as const,
          appPlanId: "free",
          updateBehavior: "proration-charge" as const,
        },
        'updateBehavior: "proration-charge" is not valid for an app-plan switch',
      ],
    ])(
      "rejects wire args that the flat Convex validator cannot express: %j",
      (args, message) => {
        // Convex requires flat object args, so these combinations are only
        // unrepresentable in TypeScript — the wire path re-checks them.
        expect(() =>
          parseSubscriptionUpdateArgs(args as SubscriptionUpdateWireArgs),
        ).toThrow(message);
      },
    );

    it.each([0, -1, 1.5, Number.NaN, 2_000_000])(
      "rejects invalid unit count %p",
      async (units) => {
        const ctx = createMockCtx({
          [REFS.getCurrentSubscription]: ACTIVE_SUB,
        });
        await expect(
          creem.subscriptions.update(ctx as never, {
            entityId: "user_1",
            kind: "units",
            units,
          }),
        ).rejects.toThrow("units must be an integer between 1 and 1000000");
      },
    );

    it("throws when subscription not found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      await expect(
        creem.subscriptions.update(ctx as never, {
          kind: "units" as const,
          entityId: "user_1",
          units: 5,
        }),
      ).rejects.toThrow("Subscription not found");
    });

    it("patches subscription and schedules update for units change", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "units" as const,
        entityId: "user_1",
        units: 10,
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        seats: 10,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionUpdate,
        expect.objectContaining({
          subscriptionId: "sub_1",
          units: 10,
        }),
      );
    });

    it("patches subscription and schedules update for productId change", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "plan" as const,
        entityId: "user_1",
        productId: "prod_new",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        productId: "prod_new",
        seats: 1, // preserves current seats
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionUpdate,
        expect.objectContaining({
          subscriptionId: "sub_1",
          productId: "prod_new",
          previousProductId: "prod_1",
        }),
      );
    });

    it("stores a scheduled update for period-end changes without optimistic patching", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "plan" as const,
        entityId: "user_1",
        productId: "prod_basic",
        updateBehavior: "period-end",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.createScheduledSubscriptionUpdate,
        {
          entityId: "user_1",
          subscriptionId: "sub_1",
          targetProductId: "prod_basic",
          effectiveAt: "2026-03-01T00:00:00Z",
        },
      );
      expect(ctx.scheduler.runAt).toHaveBeenCalledWith(
        new Date("2026-03-01T00:00:00Z"),
        REFS.applyScheduledSubscriptionUpdate,
        expect.objectContaining({
          scheduledUpdateId: "scheduled_update_1",
        }),
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.setScheduledSubscriptionUpdateJob,
        {
          scheduledUpdateId: "scheduled_update_1",
          scheduledFunctionId: "scheduled_fn_1",
        },
      );
      expect(ctx.runMutation).not.toHaveBeenCalledWith(
        REFS.patchSubscription,
        expect.anything(),
      );
      expect(ctx.scheduler.runAfter).not.toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionUpdate,
        expect.anything(),
      );
    });

    it("schedules a paid-to-free change at period end and marks cancellation pending", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "app-plan" as const,
        entityId: "user_1",
        appPlanId: "free",
        updateBehavior: "period-end",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.createScheduledSubscriptionUpdate,
        {
          entityId: "user_1",
          subscriptionId: "sub_1",
          targetPlanId: "free",
          effectiveAt: "2026-03-01T00:00:00Z",
        },
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.assignAppPlan, {
        entityId: "user_1",
        planId: "free",
        status: "scheduled",
        startsAt: "2026-03-01T00:00:00Z",
        source: "paid_to_app_plan",
        subscriptionId: "sub_1",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        cancelAtPeriodEnd: true,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          cancelMode: "scheduled",
          scheduledUpdateId: "scheduled_update_1",
          previousStatus: "active",
        }),
      );
    });

    it("replaces a scheduled paid-to-free change with a paid period-end change", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          status: "scheduled_cancel",
          cancelAtPeriodEnd: true,
        },
      });
      ctx.runMutation.mockImplementation(async (ref: symbol) => {
        if (ref === REFS.createScheduledSubscriptionUpdate) {
          return "scheduled_update_1";
        }
        if (ref === REFS.cancelPendingScheduledSubscriptionUpdates) {
          return [
            {
              entityId: "user_1",
              subscriptionId: "sub_1",
              targetPlanId: "free",
              effectiveAt: "2026-03-01T00:00:00Z",
              status: "superseded",
              createdAt: "2026-02-01T00:00:00Z",
              updatedAt: "2026-02-15T00:00:00Z",
            },
          ];
        }
        return null;
      });

      await creem.subscriptions.update(ctx as never, {
        kind: "plan" as const,
        entityId: "user_1",
        productId: "prod_new",
        updateBehavior: "period-end",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.cancelPendingScheduledSubscriptionUpdates,
        {
          entityId: "user_1",
          subscriptionId: "sub_1",
        },
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.cancelScheduledAppPlanAssignment,
        {
          subscriptionId: "sub_1",
          planId: "free",
        },
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "active",
        cancelAtPeriodEnd: false,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          operation: "resume",
        }),
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.createScheduledSubscriptionUpdate,
        expect.objectContaining({
          entityId: "user_1",
          subscriptionId: "sub_1",
          targetProductId: "prod_new",
        }),
      );
    });

    it("resumes a scheduled cancellation before replacing it with an immediate paid update", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          status: "scheduled_cancel",
          cancelAtPeriodEnd: true,
        },
      });
      ctx.runMutation.mockImplementation(async (ref: symbol) => {
        if (ref === REFS.cancelPendingScheduledSubscriptionUpdates) {
          return [
            {
              entityId: "user_1",
              subscriptionId: "sub_1",
              targetPlanId: "free",
              effectiveAt: "2026-03-01T00:00:00Z",
              status: "superseded",
              createdAt: "2026-02-01T00:00:00Z",
              updatedAt: "2026-02-15T00:00:00Z",
            },
          ];
        }
        return null;
      });

      await creem.subscriptions.update(ctx as never, {
        kind: "plan" as const,
        entityId: "user_1",
        productId: "prod_new",
      });

      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionUpdate,
        expect.objectContaining({
          subscriptionId: "sub_1",
          productId: "prod_new",
          resumeScheduledCancellation: true,
          rollback: {
            restoreAppPlanTransitions: [
              expect.objectContaining({
                planId: "free",
                scheduledUpdateCreatedAt: "2026-02-01T00:00:00Z",
              }),
            ],
          },
        }),
      );
      expect(ctx.scheduler.runAfter).not.toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({ operation: "resume" }),
      );
      expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    });

    it("cancels paid subscription immediately when paid-to-free uses immediate", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "app-plan" as const,
        entityId: "user_1",
        appPlanId: "free",
        updateBehavior: "immediate",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.assignAppPlan, {
        entityId: "user_1",
        planId: "free",
        status: "active",
        source: "paid_to_app_plan",
        subscriptionId: "sub_1",
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          cancelMode: "immediate",
          previousStatus: "active",
        }),
      );
    });

    it("cancels a scheduled paid-to-free update and resumes the subscription", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          cancelAtPeriodEnd: true,
        },
      });
      ctx.runMutation.mockImplementation(async (ref: symbol) => {
        if (ref === REFS.cancelScheduledSubscriptionUpdate) {
          return {
            entityId: "user_1",
            subscriptionId: "sub_1",
            targetPlanId: "free",
            status: "superseded",
          };
        }
        return null;
      });

      await creem.subscriptions.cancelScheduledUpdate(ctx as never, {
        entityId: "user_1",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.cancelScheduledSubscriptionUpdate,
        {
          entityId: "user_1",
          subscriptionId: "sub_1",
        },
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.cancelScheduledAppPlanAssignment,
        {
          subscriptionId: "sub_1",
          planId: "free",
        },
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        cancelAtPeriodEnd: false,
        status: "active",
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          operation: "resume",
        }),
      );
    });

    it("resolves by subscriptionId when provided", async () => {
      const ctx = createMockCtx({
        [REFS.getSubscription]: ACTIVE_SUB,
        [REFS.getCustomerByEntityId]: {
          id: "cust_1",
          entityId: "user_1",
        },
      });
      await creem.subscriptions.update(ctx as never, {
        kind: "units" as const,
        entityId: "user_1",
        subscriptionId: "sub_1",
        units: 3,
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(REFS.getSubscription, {
        id: "sub_1",
      });
    });

    it("rejects an explicit subscription owned by another entity", async () => {
      const ctx = createMockCtx({
        [REFS.getSubscription]: {
          ...ACTIVE_SUB,
          customerId: "cust_other",
        },
        [REFS.getCustomerByEntityId]: {
          id: "cust_1",
          entityId: "user_1",
        },
      });

      await expect(
        creem.subscriptions.update(ctx as never, {
          kind: "units" as const,
          entityId: "user_1",
          subscriptionId: "sub_other",
          units: 3,
        }),
      ).rejects.toThrow("Subscription not found");
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("throws when subscription not found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      await expect(
        creem.subscriptions.cancel(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription not found");
    });

    it("throws when subscription is not active", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "canceled" },
      });
      await expect(
        creem.subscriptions.cancel(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription is not active");
    });

    it("scheduled cancel: patches cancelAtPeriodEnd and schedules lifecycle", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.cancel(ctx as never, { entityId: "user_1" });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        cancelAtPeriodEnd: true,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          operation: "cancel",
          subscriptionId: "sub_1",
        }),
      );
    });

    it("immediate cancel: patches status to canceled", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.cancel(ctx as never, {
        entityId: "user_1",
        revokeImmediately: true,
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          operation: "cancel",
          cancelMode: "immediate",
        }),
      );
    });

    it("uses config cancelMode as default", async () => {
      const creemImmediate = new Creem(mockComponent, {
        apiKey: "k",
        webhookSecret: "s",
        cancelMode: "immediate",
      });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creemImmediate.subscriptions.cancel(ctx as never, {
        entityId: "user_1",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
      });
    });

    it("explicit revokeImmediately overrides config cancelMode", async () => {
      const creemImmediate = new Creem(mockComponent, {
        apiKey: "k",
        webhookSecret: "s",
        cancelMode: "immediate",
      });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creemImmediate.subscriptions.cancel(ctx as never, {
        entityId: "user_1",
        revokeImmediately: false,
      });
      // revokeImmediately: false overrides config.cancelMode: "immediate"
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        cancelAtPeriodEnd: true,
      });
    });

    it("trialing subscription can be canceled", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "trialing" },
      });
      await creem.subscriptions.cancel(ctx as never, { entityId: "user_1" });
      expect(ctx.runMutation).toHaveBeenCalled();
    });
  });

  describe("pause", () => {
    it("throws when subscription not found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      await expect(
        creem.subscriptions.pause(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription not found");
    });

    it("throws when subscription is not active", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "paused" },
      });
      await expect(
        creem.subscriptions.pause(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription is not active");
    });

    it("patches status to paused and schedules lifecycle", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.pause(ctx as never, { entityId: "user_1" });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "paused",
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          operation: "pause",
          subscriptionId: "sub_1",
          previousStatus: "active",
        }),
      );
    });
  });

  describe("resume", () => {
    it("throws when subscription not found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      await expect(
        creem.subscriptions.resume(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription not found");
    });

    it("throws when subscription is not in a resumable state", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      await expect(
        creem.subscriptions.resume(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Subscription is not in a resumable state");
    });

    it("resumes scheduled_cancel subscription", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          status: "scheduled_cancel",
          cancelAtPeriodEnd: true,
        },
      });
      await creem.subscriptions.resume(ctx as never, { entityId: "user_1" });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "active",
        cancelAtPeriodEnd: false,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          operation: "resume",
          subscriptionId: "sub_1",
          previousStatus: "scheduled_cancel",
        }),
      );
    });

    it("resumes paused subscription", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "paused" },
      });
      await creem.subscriptions.resume(ctx as never, { entityId: "user_1" });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "active",
        cancelAtPeriodEnd: false,
      });
    });
  });
});

// ── getBillingModel ─────────────────────────────────────────────────

describe("getBillingModel", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  it("returns unauthenticated model when entityId is null", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [PRODUCT_1],
    });
    const result = await creem.getBillingModel(ctx as never, {
      entityId: null,
    });
    expect(result.snapshot).toBeNull();
    expect(result.allProducts).toEqual([PRODUCT_1]);
    expect(result.ownedProductIds).toEqual([]);
    expect(result.hasCreemCustomer).toBe(false);
    expect(result.user).toBeNull();
  });

  it("returns unauthenticated model with user object when provided", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [PRODUCT_1],
    });
    const result = await creem.getBillingModel(ctx as never, {
      entityId: null,
      user: { id: "user_1", email: "a@b.com" },
    });
    expect(result.user).toEqual({ id: "user_1", email: "a@b.com" });
  });

  it("returns full model for authenticated user", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [PRODUCT_1],
      [REFS.getCurrentSubscription]: ACTIVE_SUB,
      [REFS.getProduct]: PRODUCT_1,
      [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
      [REFS.listUserSubscriptions]: [ACTIVE_SUB],
      [REFS.getCustomerByEntityId]: { id: "cust_1" },
      [REFS.listUserOrders]: [
        { id: "ord_1", productId: "prod_1", status: "paid" },
        { id: "ord_pending", productId: "prod_pending", status: "pending" },
      ],
    });
    const result = await creem.getBillingModel(ctx as never, {
      entityId: "user_1",
      user: { id: "user_1", email: "a@b.com" },
    });
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot?.subscriptions).toHaveLength(1);
    expect(result.allProducts).toEqual([PRODUCT_1]);
    expect(result.subscriptionProductId).toBe("prod_1");
    expect(result.ownedProductIds).toEqual(["prod_1"]);
    expect(result.hasCreemCustomer).toBe(true);
    expect(result.activeSubscriptions).toHaveLength(1);
    expect(result.activeSubscriptions[0].id).toBe("sub_1");
  });

  it("hasCreemCustomer is false when no customer", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [],
      [REFS.getCurrentSubscription]: null,
      [REFS.listAllUserSubscriptions]: [],
      [REFS.listUserSubscriptions]: [],
      [REFS.getCustomerByEntityId]: null,
      [REFS.listUserOrders]: [],
    });
    const result = await creem.getBillingModel(ctx as never, {
      entityId: "user_1",
    });
    expect(result.hasCreemCustomer).toBe(false);
    expect(result.subscriptionProductId).toBeNull();
  });
});

// ── getBillingSnapshot ──────────────────────────────────────────────

describe("getBillingSnapshot", () => {
  let creem: Creem;
  beforeEach(() => {
    creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "s",
      billingCatalog: TEST_BILLING_CATALOG,
    });
  });

  it("returns a snapshot with no subscription or orders", async () => {
    const ctx = createMockCtx({
      [REFS.listAllUserSubscriptions]: [],
      [REFS.listUserOrders]: [],
    });
    const result = await creem.getBillingSnapshot(ctx as never, {
      entityId: "user_1",
    });
    expect(result.entityId).toBe("user_1");
    expect(result.catalogVersion).toBe("test");
    expect(result.subscriptions).toEqual([]);
    expect(result.orders).toEqual([]);
    expect(result.availableBillingActions).toContain("checkout");
    expect(result.resolvedAt).toBeDefined();
  });

  it("returns a snapshot with subscriptions and orders", async () => {
    const ctx = createMockCtx({
      [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
      [REFS.listUserOrders]: [ORDER_1],
    });
    const result = await creem.getBillingSnapshot(ctx as never, {
      entityId: "user_1",
    });
    expect(result.subscriptions).toEqual([
      expect.objectContaining({
        planId: "pro",
        productId: "prod_1",
        subscriptionId: "sub_1",
        status: "active",
        units: 1,
      }),
    ]);
    expect(result.orders).toEqual([
      expect.objectContaining({
        planId: "pro",
        orderId: "ord_1",
        productId: "prod_1",
        status: "paid",
      }),
    ]);
    expect(result.paymentRecoveryState).toBe("none");
    expect(result.availableBillingActions).toContain("portal");
    expect(result.resolvedAt).toBeDefined();
  });
});

// ── syncProducts ────────────────────────────────────────────────────

describe("syncProducts", () => {
  it("delegates to component syncProducts action", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "test_key",
      webhookSecret: "s",
    });
    const ctx = createMockCtx();
    await creem.syncProducts(ctx as never);
    expect(ctx.runAction).toHaveBeenCalledWith(REFS.syncProducts, {
      apiKey: "test_key",
      server: undefined,
      serverURL: undefined,
    });
  });
});

// ── verifyWebhook (tested indirectly via HMAC path) ─────────────────

describe("verifyWebhook (HMAC path)", () => {
  it("verifies a valid HMAC signature", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "test-webhook-secret",
    });

    const body = JSON.stringify({
      id: "evt_valid_hmac",
      eventType: "checkout.completed",
      created_at: 1772265126979,
      object: {
        id: "ch_valid_hmac",
        object: "checkout",
        product: "prod_valid_hmac",
        units: 1,
        customer: "cust_valid_hmac",
        status: "completed",
        mode: "test",
      },
    });
    // Generate a valid HMAC signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-webhook-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    const signature = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const headers = { "creem-signature": signature };

    // Access private verifyWebhook via the registerRoutes handler
    // Instead, we test it through the webhook handler
    const routeCapture: { handler?: AnyFn } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn } }) => {
        routeCapture.handler = config.handler._handler;
      },
    };

    const mockCtx = createMockCtx();
    creem.registerRoutes(mockHttp as never, { path: "/test" });

    // Call the captured handler with a valid signed request
    const mockRequest = {
      body: true,
      text: async () => body,
      headers: new Map(Object.entries(headers)),
    };

    const response = (await routeCapture.handler!(
      mockCtx,
      mockRequest,
    )) as Response;
    expect(response.status).toBe(202);
  });

  it("rejects invalid HMAC signature with 403", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "test-webhook-secret",
    });

    const body = '{"eventType":"test.event","object":{}}';
    const headers = { "creem-signature": "invalid_signature" };

    const routeCapture: { handler?: AnyFn } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn } }) => {
        routeCapture.handler = config.handler._handler;
      },
    };

    const mockCtx = createMockCtx();
    creem.registerRoutes(mockHttp as never, { path: "/test" });

    const mockRequest = {
      body: true,
      text: async () => body,
      headers: new Map(Object.entries(headers)),
    };

    const response = (await routeCapture.handler!(
      mockCtx,
      mockRequest,
    )) as Response;
    expect(response.status).toBe(403);
  });

  it("rejects when no signature headers present", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "test-webhook-secret",
    });

    const body = '{"eventType":"test.event","object":{}}';
    const headers = {};

    const routeCapture: { handler?: AnyFn } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn } }) => {
        routeCapture.handler = config.handler._handler;
      },
    };

    const mockCtx = createMockCtx();
    creem.registerRoutes(mockHttp as never, { path: "/test" });

    const mockRequest = {
      body: true,
      text: async () => body,
      headers: new Map(Object.entries(headers)),
    };

    const response = (await routeCapture.handler!(
      mockCtx,
      mockRequest,
    )) as Response;
    expect(response.status).toBe(403);
  });

  it("rejects when webhook secret is missing", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: "",
    });

    const body = '{"eventType":"test.event","object":{}}';
    const headers = { "creem-signature": "abc" };

    const routeCapture: { handler?: AnyFn } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn } }) => {
        routeCapture.handler = config.handler._handler;
      },
    };

    const mockCtx = createMockCtx();
    creem.registerRoutes(mockHttp as never, { path: "/test" });

    const mockRequest = {
      body: true,
      text: async () => body,
      headers: new Map(Object.entries(headers)),
    };

    // Missing webhook secret throws ConvexError, not WebhookVerificationError
    // The handler should still return or throw
    await expect(routeCapture.handler!(mockCtx, mockRequest)).rejects.toThrow();
  });
});

// ── registerRoutes webhook handler ──────────────────────────────────

describe("registerRoutes", () => {
  function setupWebhookHandler(creem: Creem, events?: Record<string, AnyFn>) {
    const routeCapture: { handler?: AnyFn; path?: string } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn }; path: string }) => {
        // httpActionGeneric wraps the handler — extract the raw function
        routeCapture.handler = config.handler._handler;
        routeCapture.path = config.path;
      },
    };
    creem.registerRoutes(mockHttp as never, {
      path: "/creem/events",
      events: events as never,
    });
    return routeCapture;
  }

  async function signAndSend(
    handler: AnyFn,
    ctx: ReturnType<typeof createMockCtx>,
    body: string,
    secret: string,
  ) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    const signature = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const mockRequest = {
      body: true,
      text: async () => body,
      headers: new Map([["creem-signature", signature]]),
    };
    return handler(ctx, mockRequest) as Promise<Response>;
  }

  const SECRET = "webhook-test-secret";

  function refundWebhookBody({
    id,
    refundAmount,
    orderAmount,
    productId = "prod_credits",
  }: {
    id: string;
    refundAmount: number;
    orderAmount: number;
    productId?: string;
  }) {
    return JSON.stringify({
      id: `evt_${id}`,
      eventType: "refund.created",
      created_at: 1772265452403,
      object: {
        id,
        object: "refund",
        status: "succeeded",
        refund_amount: refundAmount,
        refund_currency: "USD",
        reason: "requested_by_customer",
        transaction: {
          id: `tran_${id}`,
          object: "transaction",
          amount: orderAmount,
          amount_paid: orderAmount,
          currency: "USD",
          type: "payment",
          tax_country: "US",
          tax_amount: 0,
          status: refundAmount >= orderAmount ? "refunded" : "partialRefund",
          refunded_amount: refundAmount,
          order: `ord_${id}`,
          customer: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          created_at: 1772265452403,
          mode: "test",
        },
        order: {
          object: "order",
          id: `ord_${id}`,
          customer: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          product: productId,
          amount: orderAmount,
          currency: "USD",
          sub_total: orderAmount,
          tax_amount: 0,
          amount_due: orderAmount,
          amount_paid: orderAmount,
          status: "paid",
          type: "onetime",
          transaction: `tran_${id}`,
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        created_at: 1772265452403,
        mode: "test",
      },
    });
  }

  it("routes to default path /creem/events", () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const routeCapture: { path?: string } = {};
    const mockHttp = {
      route: (config: { handler: { _handler: AnyFn }; path: string }) => {
        routeCapture.path = config.path;
      },
    };
    creem.registerRoutes(mockHttp as never);
    expect(routeCapture.path).toBe("/creem/events");
  });

  it("handles checkout.completed with order — creates order", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    // Use real Creem test webhook payload
    const body = JSON.stringify({
      id: "evt_checkout_order",
      eventType: "checkout.completed",
      created_at: 1772265126979,
      object: {
        id: "ch_6u5rCq19LEsXpltlDGtc9Y",
        object: "checkout",
        request_id: "6e75be93-e116-4f30-9d83-c6a5a0021f90",
        order: {
          object: "order",
          id: "ord_7ZKxZkpnNcs0d1TxbBPcr0",
          customer: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          product: "prod_35PR89LmiAjsR8JJwO7uM7",
          amount: 2999,
          currency: "USD",
          sub_total: 2999,
          tax_amount: 500,
          amount_due: 2999,
          amount_paid: 2999,
          status: "paid",
          type: "onetime",
          transaction: "tran_78fYacdKnQu3Bw3wOwtG60",
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        product: {
          id: "prod_35PR89LmiAjsR8JJwO7uM7",
          object: "product",
          name: "Test Product",
          description: "A test product",
          price: 2999,
          currency: "USD",
          billing_type: "onetime",
          billing_period: "once",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          default_success_url: null,
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        units: 1,
        success_url: "https://example.com/success",
        customer: {
          id: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          object: "customer",
          email: "test-customer@creem.io",
          name: "Test Customer",
          country: "US",
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        status: "completed",
        mode: "test",
        metadata: { convexUserId: "user_1" },
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    // Should have called insertCustomer and createOrder
    expect(ctx.runMutation).toHaveBeenCalled();
  });

  it("credits customer credits from a catalog grant for a completed checkout", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
      billingCatalog: defineBillingCatalog({
        version: "test",
        plans: [
          {
            planId: "ai-credits-100",
            category: "paid",
            billingType: "onetime",
            creemProductIds: { custom: "prod_credits" },
            creditGrant: { amount: "100" },
          },
        ],
      }),
    });
    const creditAccount = vi.fn(async () => ({}));
    vi.spyOn(creem.sdk as any, "customerCredits", "get").mockReturnValue({
      listAccounts: vi.fn(async () => ({
        data: [{ id: "cred_acct_1", name: "credits" }],
      })),
      creditAccount,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx({
      [REFS.getCustomerByEntityId]: {
        id: "cust_6aVJrSJi8h9r7cGzWPVBF0",
        entityId: "user_1",
      },
    });

    const body = JSON.stringify({
      id: "evt_checkout_credits",
      eventType: "checkout.completed",
      created_at: 1772265126979,
      object: {
        id: "ch_credits",
        object: "checkout",
        request_id: "req_credits",
        order: {
          object: "order",
          id: "ord_credits",
          customer: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          product: "prod_credits",
          amount: 2000,
          currency: "USD",
          status: "paid",
          type: "onetime",
          transaction: "tran_credits",
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        product: {
          id: "prod_credits",
          object: "product",
          name: "100 AI Credits",
          description: "Credits",
          price: 2000,
          currency: "USD",
          billing_type: "onetime",
          billing_period: "once",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          default_success_url: null,
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        units: 1,
        success_url: "https://example.com/success",
        customer: {
          id: "cust_6aVJrSJi8h9r7cGzWPVBF0",
          object: "customer",
          email: "test-customer@creem.io",
          country: "US",
          created_at: "2026-02-28T07:52:06.979Z",
          updated_at: "2026-02-28T07:52:06.979Z",
          mode: "test",
        },
        status: "completed",
        mode: "test",
        metadata: {
          convexUserId: "user_1",
          convexBillingEntityId: "user_1",
        },
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);

    expect(response.status).toBe(202);
    expect(creditAccount).toHaveBeenCalledWith("cred_acct_1", {
      amount: "100",
      reference: "checkout:ch_credits",
      idempotencyKey: "creem:checkout:ch_credits:credits:prod_credits:100",
    });
  });

  it("debits catalog-granted customer credits when the order is refunded", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
      billingCatalog: defineBillingCatalog({
        version: "test",
        plans: [
          {
            planId: "ai-credits-100",
            category: "paid",
            billingType: "onetime",
            creemProductIds: { custom: "prod_credits" },
            creditGrant: { amount: "100", refundBehavior: "prorate" },
          },
        ],
      }),
    });
    const debitAccount = vi.fn(async () => ({}));
    vi.spyOn(creem.sdk as any, "customerCredits", "get").mockReturnValue({
      listAccounts: vi.fn(async () => ({
        data: [{ id: "cred_acct_1", name: "credits" }],
      })),
      debitAccount,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const body = refundWebhookBody({
      id: "ref_credits",
      refundAmount: 1000,
      orderAmount: 2000,
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);

    expect(response.status).toBe(202);
    expect(debitAccount).toHaveBeenCalledWith("cred_acct_1", {
      amount: "50",
      reference: "refund:ref_credits",
      idempotencyKey: "creem:refund:ref_credits:credits:prod_credits:50",
    });
  });

  it("does not debit catalog-granted credits for partial refunds by default", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
      billingCatalog: defineBillingCatalog({
        version: "test",
        plans: [
          {
            planId: "ai-credits-100",
            category: "paid",
            billingType: "onetime",
            creemProductIds: { custom: "prod_credits" },
            creditGrant: { amount: "100" },
          },
        ],
      }),
    });
    const debitAccount = vi.fn(async () => ({}));
    vi.spyOn(creem.sdk as any, "customerCredits", "get").mockReturnValue({
      listAccounts: vi.fn(async () => ({
        data: [{ id: "cred_acct_1", name: "credits" }],
      })),
      debitAccount,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const body = refundWebhookBody({
      id: "ref_partial_credits",
      refundAmount: 1000,
      orderAmount: 2000,
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);

    expect(response.status).toBe(202);
    expect(debitAccount).not.toHaveBeenCalled();
  });

  it("debits the full catalog credit grant for full refunds by default", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
      billingCatalog: defineBillingCatalog({
        version: "test",
        plans: [
          {
            planId: "ai-credits-100",
            category: "paid",
            billingType: "onetime",
            creemProductIds: { custom: "prod_credits" },
            creditGrant: { amount: "100" },
          },
        ],
      }),
    });
    const debitAccount = vi.fn(async () => ({}));
    vi.spyOn(creem.sdk as any, "customerCredits", "get").mockReturnValue({
      listAccounts: vi.fn(async () => ({
        data: [{ id: "cred_acct_1", name: "credits" }],
      })),
      debitAccount,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const body = refundWebhookBody({
      id: "ref_full_credits",
      refundAmount: 2000,
      orderAmount: 2000,
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);

    expect(response.status).toBe(202);
    expect(debitAccount).toHaveBeenCalledWith("cred_acct_1", {
      amount: "100",
      reference: "refund:ref_full_credits",
      idempotencyKey: "creem:refund:ref_full_credits:credits:prod_credits:100",
    });
  });

  it("tolerates Customer Credits response validation drift after debit requests", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    vi.spyOn(creem.sdk as any, "customerCredits", "get").mockReturnValue({
      debitAccount: vi.fn(async () => {
        const error = new Error("Response validation failed");
        error.name = "ResponseValidationError";
        throw error;
      }),
    });

    await expect(
      creem.credits.debit("cred_acct_1", {
        amount: "10",
        reference: "usage:req_1",
        idempotencyKey: "usage:req_1",
      }),
    ).resolves.toBeNull();
  });

  it("handles subscription.active — updates subscription", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    // Use real Creem test webhook payload
    const body = JSON.stringify({
      id: "evt_subscription_active",
      eventType: "subscription.active",
      created_at: 1772265324184,
      object: {
        id: "sub_35c5ooVUuIUtru83zXjrjC",
        object: "subscription",
        product: {
          id: "prod_3prhYLElQzQaZMq7pePQqf",
          object: "product",
          name: "Test Subscription Product",
          description: "A test product for webhook simulation",
          price: 2999,
          currency: "USD",
          billing_type: "recurring",
          billing_period: "once",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          default_success_url: null,
          created_at: "2026-02-28T07:55:24.184Z",
          updated_at: "2026-02-28T07:55:24.184Z",
          mode: "test",
        },
        customer: {
          id: "cust_50fklVtISQkWoAydmZ1LJb",
          object: "customer",
          email: "test-customer@creem.io",
          name: "Test Customer",
          country: "US",
          created_at: "2026-02-28T07:55:24.184Z",
          updated_at: "2026-02-28T07:55:24.184Z",
          mode: "test",
        },
        collection_method: "charge_automatically",
        status: "active",
        current_period_start_date: "2026-02-28T07:55:24.184Z",
        current_period_end_date: "2026-03-30T07:55:24.184Z",
        canceled_at: null,
        created_at: "2026-02-28T07:55:24.184Z",
        updated_at: "2026-02-28T07:55:24.184Z",
        mode: "test",
        metadata: { convexUserId: "user_1" },
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.updateSubscription,
      expect.objectContaining({
        subscription: expect.objectContaining({
          id: "sub_35c5ooVUuIUtru83zXjrjC",
        }),
      }),
    );
  });

  it("calls custom event handler when provided", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const customHandler = vi.fn();
    const { handler } = setupWebhookHandler(creem, {
      "refund.created": customHandler,
    });
    const ctx = createMockCtx();

    const body = refundWebhookBody({
      id: "ref_1",
      refundAmount: 1000,
      orderAmount: 1000,
      productId: "prod_1",
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(customHandler).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ eventType: "refund.created" }),
    );
  });

  it("handles subscription.canceled — updates subscription", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const body = JSON.stringify({
      id: "evt_subscription_canceled",
      eventType: "subscription.canceled",
      created_at: 1772265355057,
      object: {
        id: "sub_5PHyfaaDkDUmAsKdbH8mZZ",
        object: "subscription",
        product: {
          id: "prod_3Hj6Hd2higtUp5f4gi50vR",
          object: "product",
          name: "Test Subscription Product",
          description: "A test product for webhook simulation",
          price: 2999,
          currency: "USD",
          billing_type: "recurring",
          billing_period: "once",
          status: "active",
          tax_mode: "exclusive",
          tax_category: "saas",
          default_success_url: null,
          created_at: "2026-02-28T07:55:55.057Z",
          updated_at: "2026-02-28T07:55:55.057Z",
          mode: "test",
        },
        customer: {
          id: "cust_3TfrBYcWhn9oX22YP8B5Hc",
          object: "customer",
          email: "test-customer@creem.io",
          name: "Test Customer",
          country: "US",
          created_at: "2026-02-28T07:55:55.057Z",
          updated_at: "2026-02-28T07:55:55.057Z",
          mode: "test",
        },
        collection_method: "charge_automatically",
        status: "canceled",
        canceled_at: "2026-02-28T07:55:55.057Z",
        current_period_start_date: "2026-02-28T07:55:55.057Z",
        current_period_end_date: "2026-03-30T07:55:55.057Z",
        created_at: "2026-02-28T07:55:55.057Z",
        updated_at: "2026-02-28T07:55:55.057Z",
        mode: "test",
        metadata: { convexUserId: "user_1" },
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.updateSubscription,
      expect.objectContaining({
        subscription: expect.objectContaining({
          id: "sub_5PHyfaaDkDUmAsKdbH8mZZ",
        }),
      }),
    );
  });

  it("rejects request with no body", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const mockRequest = {
      body: null,
      text: async () => "",
      headers: new Map(),
    };

    // ConvexError wraps the message in a data property
    await expect(handler!(ctx, mockRequest)).rejects.toThrow();
  });
});

// ── api() convenience exports ───────────────────────────────────────

describe("api() convenience exports", () => {
  function extractHandler(wrapped: { _handler: AnyFn }) {
    return wrapped._handler;
  }

  const resolve = vi.fn();
  let creem: Creem;
  let apiExports: ReturnType<Creem["api"]>;

  beforeEach(() => {
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
    resolve.mockReset();
    apiExports = creem.api({ resolve });
  });

  describe("uiModel", () => {
    it("returns unauthenticated model when resolve returns null", async () => {
      resolve.mockResolvedValue(null);
      const ctx = createMockCtx({
        [REFS.listProducts]: [PRODUCT_1],
      });
      const handler = extractHandler(apiExports.uiModel as never);
      const result = await handler(ctx, {});
      expect(result.snapshot).toBeNull();
      expect(result.user).toBeNull();
      expect(result.allProducts).toEqual([PRODUCT_1]);
    });

    it("treats CreemNotAuthenticatedError as unauthenticated", async () => {
      resolve.mockRejectedValue(new CreemNotAuthenticatedError());
      const ctx = createMockCtx({
        [REFS.listProducts]: [PRODUCT_1],
      });
      const handler = extractHandler(apiExports.uiModel as never);
      const result = await handler(ctx, {});
      expect(result.snapshot).toBeNull();
      expect(result.user).toBeNull();
    });

    it("rethrows unexpected resolver failures instead of degrading", async () => {
      const failure = new Error("database is down");
      resolve.mockRejectedValue(failure);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const ctx = createMockCtx({ [REFS.listProducts]: [PRODUCT_1] });
      const handler = extractHandler(apiExports.uiModel as never);
      await expect(handler(ctx, {})).rejects.toThrow("database is down");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("returns authenticated model when resolve succeeds", async () => {
      resolve.mockResolvedValue({
        userId: "user_1",
        email: "a@b.com",
        entityId: "user_1",
      });
      const ctx = createMockCtx({
        [REFS.listProducts]: [PRODUCT_1],
        [REFS.getCurrentSubscription]: null,
        [REFS.listAllUserSubscriptions]: [],
        [REFS.listUserSubscriptions]: [],
        [REFS.getCustomerByEntityId]: null,
        [REFS.listUserOrders]: [],
      });
      const handler = extractHandler(apiExports.uiModel as never);
      const result = await handler(ctx, {});
      expect(result.user).toEqual({ id: "user_1", email: "a@b.com" });
      expect(result.allProducts).toEqual([PRODUCT_1]);
    });
  });

  describe("transactions.search", () => {
    it("returns the first SDK page result without the pagination iterator", async () => {
      resolve.mockResolvedValue({
        userId: "user_1",
        email: "a@b.com",
        entityId: "user_1",
      });
      const ctx = createMockCtx({
        [REFS.getCustomerByEntityId]: { id: "cust_1" },
      });
      const transactionList = {
        items: [
          {
            id: "tran_1",
            mode: "test",
            object: "transaction",
            amount: 2999,
            currency: "USD",
            type: "payment",
            status: "paid",
            createdAt: 1780135200,
          },
        ],
        pagination: {
          totalRecords: 1,
          totalPages: 1,
          currentPage: 1,
          nextPage: null,
          prevPage: null,
        },
      };
      const search = vi.fn(async () => ({
        result: transactionList,
        next: vi.fn(),
        [Symbol.asyncIterator]: vi.fn(),
      }));
      creem.sdk.transactions.search = search as never;

      const handler = extractHandler(apiExports.transactions.search as never);
      const result = await handler(ctx, { pageNumber: 1, pageSize: 10 });

      expect(search).toHaveBeenCalledWith(
        "cust_1",
        undefined,
        undefined,
        1,
        10,
      );
      expect(result.pagination).toEqual(transactionList.pagination);
      expect(result.items).toHaveLength(1);
      // Projected into the validated widget shape: SDK-only fields are dropped.
      expect(result.items[0]).toMatchObject({
        id: "tran_1",
        amount: 2999,
        currency: "USD",
        status: "paid",
        type: "payment",
        createdAt: 1780135200,
      });
      expect(result.items[0]).not.toHaveProperty("mode");
      expect(result.items[0]).not.toHaveProperty("object");
      expect(result).not.toHaveProperty("next");
    });

    it("always searches the customer resolved from the authenticated entity", async () => {
      resolve.mockResolvedValue({
        userId: "user_1",
        email: "a@b.com",
        entityId: "user_1",
      });
      const ctx = createMockCtx({
        [REFS.getCustomerByEntityId]: { id: "cust_1" },
      });
      const search = vi.fn(async () => ({
        result: {
          items: [],
          pagination: {
            totalRecords: 0,
            totalPages: 0,
            currentPage: 1,
            nextPage: null,
            prevPage: null,
          },
        },
      }));
      creem.sdk.transactions.search = search as never;

      const handler = extractHandler(apiExports.transactions.search as never);
      await handler(ctx, {
        customerId: "cust_other",
        pageNumber: 1,
      });

      expect(search).toHaveBeenCalledWith(
        "cust_1",
        undefined,
        undefined,
        1,
        undefined,
      );
    });
  });

  describe("snapshot", () => {
    it("returns null when resolve returns null", async () => {
      resolve.mockResolvedValue(null);
      const ctx = createMockCtx();
      const handler = extractHandler(apiExports.snapshot as never);
      const result = await handler(ctx, {});
      expect(result).toBeNull();
    });

    it("returns null when resolve returns null", async () => {
      resolve.mockResolvedValue(null);
      const ctx = createMockCtx();
      const handler = extractHandler(apiExports.snapshot as never);
      const result = await handler(ctx, {});
      expect(result).toBeNull();
    });

    it("returns snapshot when resolve succeeds", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
        [REFS.listUserOrders]: [ORDER_1],
      });
      const handler = extractHandler(apiExports.snapshot as never);
      const result = await handler(ctx, {});
      expect(result.subscriptions).toEqual([
        expect.objectContaining({
          productId: "prod_1",
          subscriptionId: "sub_1",
          status: "active",
        }),
      ]);
      expect(result.orders).toEqual([
        expect.objectContaining({
          orderId: "ord_1",
          productId: "prod_1",
          status: "paid",
        }),
      ]);
      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe("subscriptions.update", () => {
    it("delegates to component with resolved entityId", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await handler(ctx, { kind: "units", units: 5 });
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.patchSubscription,
        expect.objectContaining({ subscriptionId: "sub_1", seats: 5 }),
      );
    });

    it("supports period-end updates through generated API", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await handler(ctx, {
        kind: "plan",
        productId: "prod_basic",
        updateBehavior: "period-end",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.createScheduledSubscriptionUpdate,
        expect.objectContaining({
          entityId: "user_1",
          subscriptionId: "sub_1",
          targetProductId: "prod_basic",
        }),
      );
      expect(ctx.scheduler.runAt).toHaveBeenCalledWith(
        new Date("2026-03-01T00:00:00Z"),
        REFS.applyScheduledSubscriptionUpdate,
        expect.objectContaining({ scheduledUpdateId: "scheduled_update_1" }),
      );
    });

    it("supports paid-to-free period-end updates through generated API", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await handler(ctx, {
        kind: "app-plan",
        appPlanId: "free",
        updateBehavior: "period-end",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.createScheduledSubscriptionUpdate,
        expect.objectContaining({
          entityId: "user_1",
          subscriptionId: "sub_1",
          targetPlanId: "free",
        }),
      );
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.assignAppPlan, {
        entityId: "user_1",
        planId: "free",
        status: "scheduled",
        startsAt: "2026-03-01T00:00:00Z",
        source: "paid_to_app_plan",
        subscriptionId: "sub_1",
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        cancelAtPeriodEnd: true,
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          cancelMode: "scheduled",
          scheduledUpdateId: "scheduled_update_1",
        }),
      );
    });

    it("supports paid-to-free immediate updates through generated API", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await handler(ctx, {
        kind: "app-plan",
        appPlanId: "free",
        updateBehavior: "immediate",
      });

      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
      });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.assignAppPlan, {
        entityId: "user_1",
        planId: "free",
        status: "active",
        source: "paid_to_app_plan",
        subscriptionId: "sub_1",
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({
          subscriptionId: "sub_1",
          cancelMode: "immediate",
        }),
      );
    });

    it("throws when both productId and units provided", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx();
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await expect(
        handler(ctx, { productId: "prod_2", units: 5 }),
      ).rejects.toThrow();
    });

    it("throws when neither productId nor units provided", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx();
      const handler = extractHandler(apiExports.subscriptions.update as never);
      await expect(handler(ctx, {})).rejects.toThrow();
    });
  });

  describe("subscriptions.cancelScheduledUpdate", () => {
    it("cancels a scheduled update via resolved entityId", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          cancelAtPeriodEnd: true,
        },
      });
      const handler = extractHandler(
        apiExports.subscriptions.cancelScheduledUpdate as never,
      );
      await handler(ctx, {});

      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.cancelScheduledSubscriptionUpdate,
        {
          entityId: "user_1",
          subscriptionId: "sub_1",
        },
      );
    });
  });

  describe("subscriptions.cancel", () => {
    it("cancels subscription via resolved entityId", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.cancel as never);
      await handler(ctx, {});
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.patchSubscription,
        expect.objectContaining({ subscriptionId: "sub_1" }),
      );
      expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(
        0,
        REFS.executeSubscriptionLifecycle,
        expect.objectContaining({ operation: "cancel" }),
      );
    });

    it("throws when subscription not active", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "canceled" },
      });
      const handler = extractHandler(apiExports.subscriptions.cancel as never);
      await expect(handler(ctx, {})).rejects.toThrow(
        "Subscription is not active",
      );
    });

    it("supports immediate cancel via revokeImmediately arg", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.cancel as never);
      await handler(ctx, { revokeImmediately: true });
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "canceled",
        cancelAtPeriodEnd: false,
      });
    });
  });

  describe("subscriptions.resume", () => {
    it("resumes scheduled_cancel subscription", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: {
          ...ACTIVE_SUB,
          status: "scheduled_cancel",
          cancelAtPeriodEnd: true,
        },
      });
      const handler = extractHandler(apiExports.subscriptions.resume as never);
      await handler(ctx, {});
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "active",
        cancelAtPeriodEnd: false,
      });
    });

    it("throws when subscription is not resumable", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.resume as never);
      await expect(handler(ctx, {})).rejects.toThrow(
        "Subscription is not in a resumable state",
      );
    });
  });

  describe("subscriptions.pause", () => {
    it("pauses active subscription", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: ACTIVE_SUB,
      });
      const handler = extractHandler(apiExports.subscriptions.pause as never);
      await handler(ctx, {});
      expect(ctx.runMutation).toHaveBeenCalledWith(REFS.patchSubscription, {
        subscriptionId: "sub_1",
        status: "paused",
      });
    });

    it("throws when subscription is not active", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: { ...ACTIVE_SUB, status: "paused" },
      });
      const handler = extractHandler(apiExports.subscriptions.pause as never);
      await expect(handler(ctx, {})).rejects.toThrow(
        "Subscription is not active",
      );
    });
  });

  describe("subscription ownership", () => {
    it.each([
      ["update", { subscriptionId: "sub_other", units: 2 }],
      ["cancel", { subscriptionId: "sub_other" }],
      ["resume", { subscriptionId: "sub_other" }],
      ["pause", { subscriptionId: "sub_other" }],
      ["cancelScheduledUpdate", { subscriptionId: "sub_other" }],
    ] as const)(
      "rejects foreign subscription IDs for subscriptions.%s",
      async (operation, args) => {
        resolve.mockResolvedValue({ entityId: "user_1" });
        const ctx = createMockCtx({
          [REFS.getCustomerByEntityId]: {
            id: "cust_1",
            entityId: "user_1",
          },
          [REFS.getSubscription]: {
            ...ACTIVE_SUB,
            id: "sub_other",
            customerId: "cust_other",
          },
        });
        const handler = extractHandler(
          apiExports.subscriptions[operation] as never,
        );

        await expect(handler(ctx, args)).rejects.toThrow(
          "Subscription not found",
        );
        expect(ctx.runMutation).not.toHaveBeenCalled();
        expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
      },
    );
  });

  describe("subscriptions.list", () => {
    it("delegates to subscriptions.list", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.listUserSubscriptions]: [ACTIVE_SUB],
      });
      const handler = extractHandler(apiExports.subscriptions.list as never);
      const result = await handler(ctx, {});
      expect(result).toEqual([ACTIVE_SUB]);
    });
  });

  describe("subscriptions.listAll", () => {
    it("delegates to subscriptions.listAll", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
      });
      const handler = extractHandler(apiExports.subscriptions.listAll as never);
      const result = await handler(ctx, {});
      expect(result).toEqual([ACTIVE_SUB]);
    });
  });

  describe("products.list", () => {
    it("delegates to products.list", async () => {
      const ctx = createMockCtx({
        [REFS.listProducts]: [PRODUCT_1],
      });
      const handler = extractHandler(apiExports.products.list as never);
      const result = await handler(ctx, {});
      expect(result).toEqual([PRODUCT_1]);
    });
  });

  describe("products.get", () => {
    it("delegates to products.get", async () => {
      const ctx = createMockCtx({
        [REFS.getProduct]: PRODUCT_1,
      });
      const handler = extractHandler(apiExports.products.get as never);
      const result = await handler(ctx, { productId: "prod_1" });
      expect(result).toEqual(PRODUCT_1);
    });
  });

  describe("customers.retrieve", () => {
    it("delegates to customers.retrieve", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const mockCustomer = { id: "cust_1", entityId: "user_1" };
      const ctx = createMockCtx({
        [REFS.getCustomerByEntityId]: mockCustomer,
      });
      const handler = extractHandler(apiExports.customers.retrieve as never);
      const result = await handler(ctx, {});
      expect(result).toEqual(mockCustomer);
    });
  });

  describe("orders.list", () => {
    it("delegates to orders.list", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const orders = [{ id: "ord_1", productId: "prod_1" }];
      const ctx = createMockCtx({
        [REFS.listUserOrders]: orders,
      });
      const handler = extractHandler(apiExports.orders.list as never);
      const result = await handler(ctx, {});
      expect(result).toEqual(orders);
    });
  });

  describe("credits.getBalance", () => {
    it("does not generate public credit minting or arbitrary debit actions", () => {
      expect(apiExports.credits).toEqual({
        getBalance: expect.anything(),
        listEntries: expect.anything(),
      });
      expect(apiExports.credits).not.toHaveProperty("createAccount");
      expect(apiExports.credits).not.toHaveProperty("credit");
      expect(apiExports.credits).not.toHaveProperty("debit");
    });

    it("throws a ConvexError with user-facing data when checkout is required", async () => {
      resolve.mockResolvedValue({ entityId: "user_1" });
      const ctx = createMockCtx({
        [REFS.getCustomerByEntityId]: null,
      });
      const handler = extractHandler(apiExports.credits.getBalance as never);

      await expect(handler(ctx, {})).rejects.toMatchObject({
        data: {
          message: "Customer not found — complete a checkout first",
        },
      });
      await expect(handler(ctx, {})).rejects.toBeInstanceOf(ConvexError);
    });
  });

  describe("plans.activate", () => {
    it("enforces catalog eligibility in the generated public mutation", async () => {
      creem = new Creem(mockComponent, {
        apiKey: "k",
        webhookSecret: "s",
        billingCatalog: ELIGIBILITY_BILLING_CATALOG,
      });
      apiExports = creem.api({ resolve });
      resolve.mockResolvedValue({
        entityId: "user_1",
        userId: "user_1",
        email: "a@b.com",
      });
      const ctx = createMockCtx({
        [REFS.listAppPlanActivations]: [
          {
            entityId: "user_1",
            planId: "trial",
            firstActivatedAt: 1,
            lastActivatedAt: 1,
            activationCount: 1,
          },
        ],
        [REFS.listAppPlanAssignments]: [],
        [REFS.listUserSubscriptions]: [],
        [REFS.listPendingScheduledSubscriptionUpdates]: [],
      });
      const handler = extractHandler(apiExports.plans.activate as never);

      await expect(handler(ctx, { planId: "trial" })).rejects.toThrow(
        'Plan "trial" is not eligible',
      );
      expect(ctx.runMutation).not.toHaveBeenCalled();
    });
  });
});
