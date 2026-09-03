import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createMockAdapter,
  createErrorAdapter,
  createMockCreem,
  defaultOptions,
  optionsNoPersist,
  mockDbSubscription,
  mockUser,
} from "./fixtures.js";

// Mock better-auth/api
const mockGetSession = vi.fn();
vi.mock("better-auth/api", () => ({
  createAuthEndpoint: vi.fn((_path, _opts, handler) => handler),
  getSessionFromCtx: (...args: any[]) => mockGetSession(...args),
}));

// Mock better-auth logger
vi.mock("better-auth", async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Mock creem
vi.mock("creem", () => {
  return {
    Creem: vi.fn(),
  };
});

import { createCheckoutEndpoint } from "../checkout.js";
import { createPortalEndpoint } from "../portal.js";
import { createCancelSubscriptionEndpoint } from "../cancel-subscription.js";
import { createRetrieveSubscriptionEndpoint } from "../retrieve-subscription.js";
import { createSearchTransactionsEndpoint } from "../search-transactions.js";
import { createHasAccessGrantedEndpoint } from "../has-active-subscription.js";

describe("Checkout endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, { ...defaultOptions, apiKey: "" });
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
      { status: 500 },
    );
  });

  it("uses session email when no customer email provided", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({
      user: { id: "user_1", email: "session@example.com" },
    });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { email: "session@example.com" },
      }),
    );
  });

  it("uses custom email when provided", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({
      body: {
        productId: "prod_1",
        customer: { email: "custom@example.com" },
      },
    });
    mockGetSession.mockResolvedValue({ user: { id: "user_1", email: "x@y.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: { email: "custom@example.com" },
      }),
    );
  });

  it("includes referenceId in metadata from session", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({
      user: { id: "user_123", email: "test@example.com" },
    });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ referenceId: "user_123" }),
      }),
    );
  });

  it("returns checkout URL on success", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://checkout.creem.io/test-session",
        redirect: true,
      }),
    );
  });

  it("includes skipTrial metadata when user had trial", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue({ id: "user_1", hadTrial: true });
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" }, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ skipTrial: true }),
      }),
    );
  });
});

describe("Portal endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const creem = createMockCreem() as any;
    const handler = createPortalEndpoint(creem, { ...defaultOptions, apiKey: "" });
    const ctx = createMockContext();
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
      { status: 500 },
    );
  });

  it("returns error when not logged in", async () => {
    const creem = createMockCreem() as any;
    const handler = createPortalEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User must be logged in" }),
      { status: 400 },
    );
  });

  it("returns error when no creemCustomerId", async () => {
    const creem = createMockCreem() as any;
    const handler = createPortalEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: null },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "User must have a Creem customer ID",
      }),
      { status: 400 },
    );
  });

  it("returns portal URL on success", async () => {
    const creem = createMockCreem() as any;
    const handler = createPortalEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_123" },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://portal.creem.io/test-portal",
        redirect: true,
      }),
    );
  });
});

describe("Cancel subscription endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, {
      ...defaultOptions,
      apiKey: "",
    });
    const ctx = createMockContext();
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
      { status: 500 },
    );
  });

  it("returns error when not logged in", async () => {
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User must be logged in" }),
      { status: 400 },
    );
  });

  it("auto-finds active subscription with persistence enabled", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([mockDbSubscription]);
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(creem.subscriptions.cancel).toHaveBeenCalledWith("sub_test_789", {});
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("returns 404 when no active subscription found", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      { ...mockDbSubscription, status: "canceled", creemSubscriptionId: "sub_x" },
    ]);
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("No active subscription") }),
      { status: 404 },
    );
  });

  it("requires subscription ID when persistence is disabled", async () => {
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: {} });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Subscription ID is required"),
      }),
      { status: 400 },
    );
  });

  it("uses provided ID when persistence is disabled", async () => {
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: { id: "sub_explicit" } });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(creem.subscriptions.cancel).toHaveBeenCalledWith("sub_explicit", {});
  });
});

describe("Retrieve subscription endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, {
      ...defaultOptions,
      apiKey: "",
    });
    const ctx = createMockContext();
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
      { status: 500 },
    );
  });

  it("auto-finds subscription with persistence enabled", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([mockDbSubscription]);
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(creem.subscriptions.get).toHaveBeenCalledWith("sub_test_789");
  });

  it("requires ID when persistence is disabled", async () => {
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: {} });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Subscription ID is required"),
      }),
      { status: 400 },
    );
  });
});

describe("Search transactions endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const creem = createMockCreem() as any;
    const handler = createSearchTransactionsEndpoint(creem, {
      ...defaultOptions,
      apiKey: "",
    });
    const ctx = createMockContext();
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("API key") }),
      { status: 500 },
    );
  });

  it("returns error when no customerId available", async () => {
    const creem = createMockCreem() as any;
    const handler = createSearchTransactionsEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {} });
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: null },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "User must have a Creem customer ID",
      }),
      { status: 400 },
    );
  });

  it("uses session creemCustomerId as fallback", async () => {
    const creem = createMockCreem() as any;
    const handler = createSearchTransactionsEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {} });
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_session" },
    });
    await handler(ctx);
    expect(creem.transactions.search).toHaveBeenCalledWith(
      "cust_session",
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("returns transaction results", async () => {
    const creem = createMockCreem() as any;
    const handler = createSearchTransactionsEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { customerId: "cust_1" } });
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_1" },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        transactions: expect.any(Array),
      }),
    );
  });
});

describe("Has access granted endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        hasAccessGranted: undefined,
        message: expect.stringContaining("logged in"),
      }),
      { status: 401 },
    );
  });

  it("returns 400 when persistence is disabled", async () => {
    const handler = createHasAccessGrantedEndpoint(optionsNoPersist);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        hasAccessGranted: undefined,
        message: expect.stringContaining("persistence is disabled"),
      }),
      { status: 400 },
    );
  });

  it("returns true for active subscription", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([{ ...mockDbSubscription, status: "active" }]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: true }));
  });

  it("returns true for trialing subscription", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([{ ...mockDbSubscription, status: "trialing" }]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: true }));
  });

  it("returns true for canceled subscription with future periodEnd", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      {
        ...mockDbSubscription,
        status: "canceled",
        periodEnd: new Date("2030-01-01"),
      },
    ]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: true }));
  });

  it("returns false for canceled subscription with past periodEnd", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      {
        ...mockDbSubscription,
        status: "canceled",
        periodEnd: new Date("2020-01-01"),
      },
    ]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: false }));
  });

  it("returns false when no subscriptions exist", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: false }));
  });

  it("returns 500 and logs error when adapter.findMany throws", async () => {
    const { logger } = await import("better-auth");
    const adapter = createErrorAdapter();
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ hasAccessGranted: undefined }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to check subscription status"),
    );
  });
});

describe("Checkout endpoint - SDK errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 and logs error when SDK throws", async () => {
    const { logger } = await import("better-auth");
    const creem = createMockCreem() as any;
    creem.checkouts.create.mockRejectedValue(new Error("SDK checkout error"));
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to create checkout" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to create checkout"));
  });
});

describe("Portal endpoint - SDK errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 and logs error when SDK throws", async () => {
    const { logger } = await import("better-auth");
    const creem = createMockCreem() as any;
    creem.customers.generateBillingLinks.mockRejectedValue(new Error("SDK portal error"));
    const handler = createPortalEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_123" },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to create portal" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to create portal"));
  });
});

describe("Cancel subscription endpoint - SDK and adapter errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 and logs error when SDK cancel throws", async () => {
    const { logger } = await import("better-auth");
    const creem = createMockCreem() as any;
    creem.subscriptions.cancel.mockRejectedValue(new Error("SDK cancel error"));
    const handler = createCancelSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: { id: "sub_explicit" } });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to cancel subscription" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to cancel subscription"),
    );
  });

  it("passes empty options {} to SDK cancel", async () => {
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: { id: "sub_explicit" } });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(creem.subscriptions.cancel).toHaveBeenCalledWith("sub_explicit", {});
  });

  it("returns 500 when adapter.findMany throws", async () => {
    const { logger } = await import("better-auth");
    const adapter = createErrorAdapter();
    const creem = createMockCreem() as any;
    const handler = createCancelSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to cancel subscription" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to cancel subscription"),
    );
  });
});

describe("Retrieve subscription endpoint - SDK and adapter errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 and logs error when SDK get throws", async () => {
    const { logger } = await import("better-auth");
    const creem = createMockCreem() as any;
    creem.subscriptions.get.mockRejectedValue(new Error("SDK get error"));
    const handler = createRetrieveSubscriptionEndpoint(creem, optionsNoPersist);
    const ctx = createMockContext({ body: { id: "sub_explicit" } });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to retrieve subscription" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to retrieve subscription"),
    );
  });

  it("returns 500 when adapter.findMany throws", async () => {
    const adapter = createErrorAdapter();
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to retrieve subscription" }),
      { status: 500 },
    );
  });
});

describe("Search transactions endpoint - SDK errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 and logs error when SDK search throws", async () => {
    const { logger } = await import("better-auth");
    const creem = createMockCreem() as any;
    creem.transactions.search.mockRejectedValue(new Error("SDK search error"));
    const handler = createSearchTransactionsEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { customerId: "cust_1" } });
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_1" },
    });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to search transactions" }),
      { status: 500 },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to search transactions"),
    );
  });
});

describe("Retrieve subscription endpoint - missing guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not logged in", async () => {
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User must be logged in" }),
      { status: 400 },
    );
  });

  it("returns 404 when no subscriptions in DB and no ID provided", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([]);
    const creem = createMockCreem() as any;
    const handler = createRetrieveSubscriptionEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: {}, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("No subscription found") }),
      { status: 404 },
    );
  });
});

describe("Search transactions endpoint - missing guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not logged in", async () => {
    const creem = createMockCreem() as any;
    const handler = createSearchTransactionsEndpoint(creem, defaultOptions);
    const ctx = createMockContext();
    mockGetSession.mockResolvedValue(null);
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User must be logged in" }),
      { status: 400 },
    );
  });
});

describe("Portal endpoint - customerId override", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses body.customerId when provided instead of session", async () => {
    const creem = createMockCreem() as any;
    const handler = createPortalEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { customerId: "cust_override" } });
    mockGetSession.mockResolvedValue({
      user: { id: "u1", creemCustomerId: "cust_session" },
    });
    await handler(ctx);
    expect(creem.customers.generateBillingLinks).toHaveBeenCalledWith({
      customerId: "cust_override",
    });
  });
});

describe("Has access granted - additional status tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for 'paid' status subscription", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([{ ...mockDbSubscription, status: "paid" }]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: true }));
  });

  it("returns true for unpaid subscription with future periodEnd", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      {
        ...mockDbSubscription,
        status: "unpaid",
        periodEnd: new Date("2030-01-01"),
      },
    ]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: true }));
  });

  it("returns false for unpaid subscription with past periodEnd", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      {
        ...mockDbSubscription,
        status: "unpaid",
        periodEnd: new Date("2020-01-01"),
      },
    ]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: false }));
  });

  it("returns false for canceled subscription with no periodEnd", async () => {
    const adapter = createMockAdapter();
    adapter.findMany.mockResolvedValue([
      {
        ...mockDbSubscription,
        status: "canceled",
        periodEnd: undefined,
      },
    ]);
    const handler = createHasAccessGrantedEndpoint(defaultOptions);
    const ctx = createMockContext({ adapter });
    mockGetSession.mockResolvedValue({ user: { id: "user_123" } });
    await handler(ctx);
    expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ hasAccessGranted: false }));
  });
});

describe("Checkout endpoint - customFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes customFields through to SDK", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const customFields = [
      { type: "text", key: "company", label: "Company Name", text: { maxLength: 100 } },
    ];
    const ctx = createMockContext({
      body: { productId: "prod_1", customFields },
    });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(expect.objectContaining({ customFields }));
  });

  it("passes deprecated customField through as customFields", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const customField = [{ type: "checkbox", key: "terms", label: "Accept Terms" }];
    const ctx = createMockContext({
      body: { productId: "prod_1", customField },
    });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ customFields: customField }),
    );
  });

  it("prefers customFields over customField when both provided", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const customFields = [{ type: "text", key: "company", label: "Company" }];
    const customField = [{ type: "checkbox", key: "terms", label: "Terms" }];
    const ctx = createMockContext({
      body: { productId: "prod_1", customFields, customField },
    });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(expect.objectContaining({ customFields }));
  });

  it("passes customFields with text and checkbox config correctly", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const customFields = [
      {
        type: "text",
        key: "name",
        label: "Full Name",
        optional: false,
        text: { minLength: 2, maxLength: 100 },
      },
      {
        type: "checkbox",
        key: "newsletter",
        label: "Subscribe",
        optional: true,
        checkbox: { label: "Yes, subscribe me" },
      },
    ];
    const ctx = createMockContext({
      body: { productId: "prod_1", customFields },
    });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(expect.objectContaining({ customFields }));
  });

  it("does not include customFields when not provided", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({
      body: { productId: "prod_1" },
    });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({ customFields: undefined }),
    );
  });
});

describe("Checkout endpoint - additional paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proceeds without customer email when neither body nor session provides one", async () => {
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: undefined,
      }),
    );
  });

  it("uses defaultSuccessUrl from options when body has no successUrl", async () => {
    const creem = createMockCreem() as any;
    const options = { ...defaultOptions, defaultSuccessUrl: "https://example.com/default-success" };
    const handler = createCheckoutEndpoint(creem, options);
    const ctx = createMockContext({ body: { productId: "prod_1" } });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    expect(creem.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://example.com/default-success",
      }),
    );
  });

  it("handles checkUserHadTrial adapter failure gracefully", async () => {
    const adapter = createMockAdapter();
    // findOne throws during hadTrial check
    adapter.findOne.mockRejectedValue(new Error("DB error"));
    const creem = createMockCreem() as any;
    const handler = createCheckoutEndpoint(creem, defaultOptions);
    const ctx = createMockContext({ body: { productId: "prod_1" }, adapter });
    mockGetSession.mockResolvedValue({ user: { id: "u1", email: "t@e.com" } });
    await handler(ctx);
    // Should still proceed with checkout (fail open)
    expect(creem.checkouts.create).toHaveBeenCalled();
  });
});
