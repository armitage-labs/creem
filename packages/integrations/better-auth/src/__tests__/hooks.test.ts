import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  onCheckoutCompleted,
  onSubscriptionActive,
  onSubscriptionTrialing,
  onSubscriptionCanceled,
  onSubscriptionPaid,
  onSubscriptionExpired,
  onSubscriptionUnpaid,
  onSubscriptionUpdate,
  onSubscriptionPastDue,
  onSubscriptionPaused,
} from "../hooks.js";
import {
  createMockContext,
  createMockAdapter,
  createErrorAdapter,
  defaultOptions,
  optionsNoPersist,
  mockCheckoutCompletedEvent,
  mockSubscriptionActiveEvent,
  mockSubscriptionTrialingEvent,
  mockSubscriptionCanceledEvent,
  mockSubscriptionPaidEvent,
  mockSubscriptionExpiredEvent,
  mockSubscriptionPausedEvent,
  mockSubscription,
  mockDbSubscription,
  mockUser,
} from "./fixtures.js";

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

describe("onCheckoutCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when persistSubscriptions is false", async () => {
    const ctx = createMockContext();
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, optionsNoPersist);
    expect(ctx.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("skips when customer ID is missing", async () => {
    const ctx = createMockContext();
    const event = {
      ...mockCheckoutCompletedEvent,
      object: { ...mockCheckoutCompletedEvent.object, customer: undefined as any },
    };
    await onCheckoutCompleted(ctx, event, defaultOptions);
    expect(ctx.context.adapter.update).not.toHaveBeenCalled();
  });

  it("skips when referenceId is missing from metadata", async () => {
    const ctx = createMockContext();
    const event = {
      ...mockCheckoutCompletedEvent,
      object: {
        ...mockCheckoutCompletedEvent.object,
        metadata: {},
      },
    };
    await onCheckoutCompleted(ctx, event, defaultOptions);
    expect(ctx.context.adapter.update).not.toHaveBeenCalled();
  });

  it("updates user with creemCustomerId when user exists", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce({ id: "user_123", creemCustomerId: null });
    adapter.findOne.mockResolvedValueOnce(null); // No existing subscription

    const ctx = createMockContext({ adapter });
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "user",
        update: expect.objectContaining({ creemCustomerId: "cust_test_123" }),
      }),
    );
  });

  it("does not update user if creemCustomerId already set", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce({
      id: "user_123",
      creemCustomerId: "cust_existing",
    });
    adapter.findOne.mockResolvedValueOnce(null);

    const ctx = createMockContext({ adapter });
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    // First update call should NOT be for user model
    const userUpdateCalls = adapter.update.mock.calls.filter((c: any) => c[0].model === "user");
    expect(userUpdateCalls).toHaveLength(0);
  });

  it("creates a new subscription when none exists", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce({ id: "user_123" }); // User lookup
    adapter.findOne.mockResolvedValueOnce(null); // No existing subscription

    const ctx = createMockContext({ adapter });
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(adapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "creem_subscription",
        data: expect.objectContaining({
          creemSubscriptionId: "sub_test_789",
          referenceId: "user_123",
        }),
      }),
    );
  });

  it("updates existing subscription when found", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce({ id: "user_123" }); // User lookup
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription); // Existing subscription

    const ctx = createMockContext({ adapter });
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "creem_subscription",
        where: [{ field: "id", value: mockDbSubscription.id }],
      }),
    );
  });
});

describe("onSubscriptionTrialing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates subscription status and marks hadTrial", async () => {
    const adapter = createMockAdapter();
    // For updateSubscriptionFromEvent
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription);
    // For markUserAsHadTrial
    adapter.findOne.mockResolvedValueOnce({ id: "user_123", hadTrial: false });

    const ctx = createMockContext({ adapter });
    await onSubscriptionTrialing(ctx, mockSubscriptionTrialingEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "creem_subscription",
        update: expect.objectContaining({ status: "trialing" }),
      }),
    );
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "user",
        update: { hadTrial: true },
      }),
    );
  });

  it("skips when persistence is disabled", async () => {
    const ctx = createMockContext();
    await onSubscriptionTrialing(ctx, mockSubscriptionTrialingEvent, optionsNoPersist);
    expect(ctx.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("does not re-mark hadTrial if already true (idempotent)", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription);
    adapter.findOne.mockResolvedValueOnce({ id: "user_123", hadTrial: true });

    const ctx = createMockContext({ adapter });
    await onSubscriptionTrialing(ctx, mockSubscriptionTrialingEvent, defaultOptions);
    // Should only update subscription status, not user hadTrial
    const userUpdateCalls = adapter.update.mock.calls.filter((c: any) => c[0].model === "user");
    expect(userUpdateCalls).toHaveLength(0);
  });
});

describe("updateSubscriptionFromEvent (via subscription hooks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when persistence is disabled", async () => {
    const ctx = createMockContext();
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, optionsNoPersist);
    expect(ctx.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("skips when referenceId is missing", async () => {
    const ctx = createMockContext();
    const event = {
      ...mockSubscriptionActiveEvent,
      object: {
        ...mockSubscriptionActiveEvent.object,
        metadata: {},
      },
    };
    await onSubscriptionActive(ctx, event, defaultOptions);
    expect(ctx.context.adapter.findOne).not.toHaveBeenCalled();
  });

  it("finds subscription by creemSubscriptionId", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(adapter.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "creem_subscription",
        where: [{ field: "creemSubscriptionId", value: "sub_test_789" }],
      }),
    );
    expect(adapter.update).toHaveBeenCalled();
  });

  it("falls back to customerId+productId lookup", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce(null); // Not found by subscription ID
    adapter.findMany.mockResolvedValueOnce([mockDbSubscription]);

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(adapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "creem_subscription",
        where: [{ field: "creemCustomerId", value: "cust_test_123" }],
      }),
    );
  });

  it("logs warning when subscription not found", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce(null);
    adapter.findMany.mockResolvedValueOnce([]);

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Subscription not found"));
  });

  it("onSubscriptionCanceled sets status to canceled", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    await onSubscriptionCanceled(ctx, mockSubscriptionCanceledEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "canceled" }),
      }),
    );
  });

  it("onSubscriptionPaid uses event object status", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    await onSubscriptionPaid(ctx, mockSubscriptionPaidEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("onSubscriptionExpired sets status to expired", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    await onSubscriptionExpired(ctx, mockSubscriptionExpiredEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "expired" }),
      }),
    );
  });

  it("onSubscriptionPaused sets status to paused", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    await onSubscriptionPaused(ctx, mockSubscriptionPausedEvent, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "paused" }),
      }),
    );
  });
});

describe("onCheckoutCompleted - adapter errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not crash when adapter.findOne throws during user lookup", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    // First findOne (user lookup) throws
    adapter.findOne.mockRejectedValueOnce(new Error("DB connection lost"));

    const ctx = createMockContext({ adapter });
    // Should not throw
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to update user with creemCustomerId"),
    );
  });

  it("does not crash when adapter.create throws during subscription creation", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    // First findOne (user lookup) succeeds
    adapter.findOne.mockResolvedValueOnce({ id: "user_123" });
    // Second findOne (existing subscription lookup) returns null
    adapter.findOne.mockResolvedValueOnce(null);
    // create throws
    adapter.create.mockRejectedValueOnce(new Error("DB write error"));

    const ctx = createMockContext({ adapter });
    // Should not throw - outer catch handles it
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("checkout.completed"));
  });

  it("does not crash when adapter.update throws during subscription update", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    // First findOne (user lookup) succeeds - user already has creemCustomerId so user update is skipped
    adapter.findOne.mockResolvedValueOnce({ id: "user_123", creemCustomerId: "cust_test_123" });
    // Second findOne (existing subscription lookup) returns existing
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription);
    // update (subscription update) throws
    adapter.update.mockRejectedValueOnce(new Error("DB update error"));

    const ctx = createMockContext({ adapter });
    await onCheckoutCompleted(ctx, mockCheckoutCompletedEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("checkout.completed"));
  });
});

describe("updateSubscriptionFromEvent - adapter errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs error when adapter.findOne throws during subscription lookup", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    adapter.findOne.mockRejectedValueOnce(new Error("DB read error"));

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("subscription update"));
  });

  it("logs error when adapter.update throws during subscription update", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription);
    adapter.update.mockRejectedValueOnce(new Error("DB update error"));

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("subscription update"));
  });

  it("logs error when adapter.findMany throws during fallback lookup", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce(null); // not found by ID
    adapter.findMany.mockRejectedValueOnce(new Error("DB query error"));

    const ctx = createMockContext({ adapter });
    await onSubscriptionActive(ctx, mockSubscriptionActiveEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("subscription update"));
  });

  it("does not crash when markUserAsHadTrial adapter throws", async () => {
    const { logger } = await import("better-auth");
    const adapter = createMockAdapter();
    // updateSubscriptionFromEvent: findOne succeeds for subscription
    adapter.findOne.mockResolvedValueOnce(mockDbSubscription);
    // markUserAsHadTrial: findOne throws for user
    adapter.findOne.mockRejectedValueOnce(new Error("DB user error"));

    const ctx = createMockContext({ adapter });
    // Should not throw
    await onSubscriptionTrialing(ctx, mockSubscriptionTrialingEvent, defaultOptions);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to mark user as hadTrial"),
    );
  });
});

describe("Directly tested subscription event hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onSubscriptionUnpaid calls updateSubscriptionFromEvent with 'unpaid'", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    const event = {
      eventType: "subscription.unpaid" as const,
      id: "evt_sub_unpaid",
      created_at: Date.now() / 1000,
      object: { ...mockSubscription, status: "unpaid" as const },
    };
    await onSubscriptionUnpaid(ctx, event, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "unpaid" }),
      }),
    );
  });

  it("onSubscriptionUpdate uses event object status", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    const event = {
      eventType: "subscription.update" as const,
      id: "evt_sub_update",
      created_at: Date.now() / 1000,
      object: { ...mockSubscription, status: "active" as const },
    };
    await onSubscriptionUpdate(ctx, event, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("onSubscriptionPastDue maps to 'past_due' status", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValue(mockDbSubscription);

    const ctx = createMockContext({ adapter });
    const event = {
      eventType: "subscription.past_due" as const,
      id: "evt_sub_past_due",
      created_at: Date.now() / 1000,
      object: { ...mockSubscription, status: "active" as const },
    };
    await onSubscriptionPastDue(ctx, event, defaultOptions);
    expect(adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "past_due" }),
      }),
    );
  });
});

describe("onCheckoutCompleted - one-time product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips subscription creation for one-time product (no subscription in checkout)", async () => {
    const adapter = createMockAdapter();
    adapter.findOne.mockResolvedValueOnce({ id: "user_123" }); // User lookup

    const ctx = createMockContext({ adapter });
    const event = {
      ...mockCheckoutCompletedEvent,
      object: {
        ...mockCheckoutCompletedEvent.object,
        subscription: undefined as any,
      },
    };
    await onCheckoutCompleted(ctx, event, defaultOptions);
    // Should not create or update subscription
    expect(adapter.create).not.toHaveBeenCalled();
    // Should still update user with creemCustomerId
    expect(adapter.update).toHaveBeenCalledWith(expect.objectContaining({ model: "user" }));
  });
});
