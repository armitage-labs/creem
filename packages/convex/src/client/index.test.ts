import { describe, it, expect, vi, beforeEach } from "vitest";
import { Creem } from "./index.js";
import type { ComponentApi } from "../component/_generated/component.js";

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
    runMutation: vi.fn(async () => {}),
    runAction: vi.fn(async () => {}),
    scheduler: { runAfter: vi.fn(async () => {}) },
  };
}

// ── Test subscription fixture ───────────────────────────────────────

const ACTIVE_SUB = {
  id: "sub_1",
  productId: "prod_1",
  status: "active" as const,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-03-01T00:00:00Z",
  currentPeriodStart: "2026-02-01T00:00:00Z",
  recurringInterval: "monthly",
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

  it("accepts serverIdx and serverURL config", () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      serverIdx: 1,
      serverURL: "https://custom.creem.io",
    });
    expect(creem.sdk).toBeDefined();
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
    it("throws when both productId and units provided", async () => {
      const ctx = createMockCtx();
      await expect(
        creem.subscriptions.update(ctx as never, {
          entityId: "user_1",
          productId: "prod_2",
          units: 5,
        }),
      ).rejects.toThrow("Provide productId OR units, not both");
    });

    it("throws when neither productId nor units provided", async () => {
      const ctx = createMockCtx();
      await expect(
        creem.subscriptions.update(ctx as never, { entityId: "user_1" }),
      ).rejects.toThrow("Provide productId or units");
    });

    it("throws when subscription not found", async () => {
      const ctx = createMockCtx({
        [REFS.getCurrentSubscription]: null,
      });
      await expect(
        creem.subscriptions.update(ctx as never, {
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

    it("resolves by subscriptionId when provided", async () => {
      const ctx = createMockCtx({
        [REFS.getSubscription]: ACTIVE_SUB,
      });
      await creem.subscriptions.update(ctx as never, {
        entityId: "user_1",
        subscriptionId: "sub_1",
        units: 3,
      });
      expect(ctx.runQuery).toHaveBeenCalledWith(REFS.getSubscription, {
        id: "sub_1",
      });
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
    expect(result.billingSnapshot).toBeNull();
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
      user: { _id: "user_1", email: "a@b.com" },
    });
    expect(result.user).toEqual({ _id: "user_1", email: "a@b.com" });
  });

  it("returns full model for authenticated user", async () => {
    const ctx = createMockCtx({
      [REFS.listProducts]: [PRODUCT_1],
      [REFS.getCurrentSubscription]: ACTIVE_SUB,
      [REFS.getProduct]: PRODUCT_1,
      [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
      [REFS.listUserSubscriptions]: [ACTIVE_SUB],
      [REFS.getCustomerByEntityId]: { id: "cust_1" },
      [REFS.listUserOrders]: [{ productId: "prod_1" }],
    });
    const result = await creem.getBillingModel(ctx as never, {
      entityId: "user_1",
      user: { _id: "user_1", email: "a@b.com" },
    });
    expect(result.billingSnapshot).toBeDefined();
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
    creem = new Creem(mockComponent, { apiKey: "k", webhookSecret: "s" });
  });

  it("returns a snapshot with no subscription", async () => {
    const ctx = createMockCtx({
      [REFS.getCurrentSubscription]: null,
      [REFS.listAllUserSubscriptions]: [],
    });
    const result = await creem.getBillingSnapshot(ctx as never, {
      entityId: "user_1",
    });
    expect(result).toBeDefined();
    expect(result.activeCategory).toBeDefined();
    expect(result.resolvedAt).toBeDefined();
  });

  it("returns a snapshot with active subscription", async () => {
    const ctx = createMockCtx({
      [REFS.getCurrentSubscription]: ACTIVE_SUB,
      [REFS.getProduct]: PRODUCT_1,
      [REFS.listAllUserSubscriptions]: [ACTIVE_SUB],
    });
    const result = await creem.getBillingSnapshot(ctx as never, {
      entityId: "user_1",
    });
    expect(result).toBeDefined();
    expect(result.activeCategory).toBeDefined();
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
      serverIdx: undefined,
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

    const body = '{"eventType":"checkout.completed","object":{}}';
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

  it("handles subscription.active — updates subscription", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    // Use real Creem test webhook payload
    const body = JSON.stringify({
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
    // Should update (not create, since eventType is subscription.active, not subscription.created)
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.updateSubscription,
      expect.objectContaining({
        subscription: expect.objectContaining({
          id: "sub_35c5ooVUuIUtru83zXjrjC",
        }),
      }),
    );
  });

  it("handles subscription.created — calls createSubscription", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    // Use real-shaped payload with eventType=subscription.created
    const body = JSON.stringify({
      eventType: "subscription.created",
      created_at: 1772265324184,
      object: {
        id: "sub_new_123",
        object: "subscription",
        product: {
          id: "prod_3prhYLElQzQaZMq7pePQqf",
          object: "product",
          name: "Test Subscription Product",
          description: "A test product",
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
        metadata: { convexUserId: "user_2" },
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.createSubscription,
      expect.objectContaining({
        subscription: expect.objectContaining({ id: "sub_new_123" }),
      }),
    );
  });

  it("handles product.created — calls createProduct", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    // product.* events have the product directly in object
    // But parseProduct may fail on simplified data — the handler logs warning and skips
    // Use real product shape from the checkout payload
    const body = JSON.stringify({
      eventType: "product.created",
      object: {
        id: "prod_35PR89LmiAjsR8JJwO7uM7",
        object: "product",
        name: "Test Product",
        description: "A test product for webhook simulation",
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
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.createProduct,
      expect.objectContaining({
        product: expect.objectContaining({ id: "prod_35PR89LmiAjsR8JJwO7uM7" }),
      }),
    );
  });

  it("handles product.updated — calls updateProduct", async () => {
    const creem = new Creem(mockComponent, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const { handler } = setupWebhookHandler(creem);
    const ctx = createMockCtx();

    const body = JSON.stringify({
      eventType: "product.updated",
      object: {
        id: "prod_35PR89LmiAjsR8JJwO7uM7",
        object: "product",
        name: "Updated Product",
        description: "Updated description",
        price: 1999,
        currency: "USD",
        billing_type: "onetime",
        billing_period: "once",
        status: "active",
        tax_mode: "exclusive",
        tax_category: "saas",
        default_success_url: null,
        created_at: "2026-02-28T07:52:06.979Z",
        updated_at: "2026-02-28T08:00:00.000Z",
        mode: "test",
      },
    });

    const response = await signAndSend(handler!, ctx, body, SECRET);
    expect(response.status).toBe(202);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      REFS.updateProduct,
      expect.objectContaining({
        product: expect.objectContaining({ id: "prod_35PR89LmiAjsR8JJwO7uM7" }),
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

    const body = JSON.stringify({
      eventType: "refund.created",
      object: { id: "ref_1", object: "refund" },
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
    it("returns unauthenticated model when resolve throws", async () => {
      resolve.mockRejectedValue(new Error("Not authenticated"));
      const ctx = createMockCtx({
        [REFS.listProducts]: [PRODUCT_1],
      });
      const handler = extractHandler(apiExports.uiModel as never);
      const result = await handler(ctx, {});
      expect(result.billingSnapshot).toBeNull();
      expect(result.allProducts).toEqual([PRODUCT_1]);
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
      expect(result.user).toEqual({ _id: "user_1", email: "a@b.com" });
      expect(result.allProducts).toEqual([PRODUCT_1]);
    });
  });

  describe("snapshot", () => {
    it("returns null when resolve throws", async () => {
      resolve.mockRejectedValue(new Error("Not authenticated"));
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
        [REFS.getCurrentSubscription]: null,
        [REFS.listAllUserSubscriptions]: [],
      });
      const handler = extractHandler(apiExports.snapshot as never);
      const result = await handler(ctx, {});
      expect(result).toBeDefined();
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
      await handler(ctx, { units: 5 });
      expect(ctx.runMutation).toHaveBeenCalledWith(
        REFS.patchSubscription,
        expect.objectContaining({ subscriptionId: "sub_1", seats: 5 }),
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
});
