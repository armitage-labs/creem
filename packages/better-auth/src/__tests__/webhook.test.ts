import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSignature } from "../utils.js";
import {
  createMockContext,
  defaultOptions,
  mockCheckout,
  mockSubscription,
  mockRefund,
  mockDispute,
  mockProduct,
  mockCustomer,
} from "./fixtures.js";
import type { CreemOptions } from "../types.js";

// Mock better-auth/api createAuthEndpoint
vi.mock("better-auth/api", () => ({
  createAuthEndpoint: vi.fn((_path, _opts, handler) => handler),
  getSessionFromCtx: vi.fn(),
}));

// Mock hooks
vi.mock("../hooks.js", () => ({
  onCheckoutCompleted: vi.fn(),
  onSubscriptionActive: vi.fn(),
  onSubscriptionTrialing: vi.fn(),
  onSubscriptionCanceled: vi.fn(),
  onSubscriptionPaid: vi.fn(),
  onSubscriptionExpired: vi.fn(),
  onSubscriptionUnpaid: vi.fn(),
  onSubscriptionUpdate: vi.fn(),
  onSubscriptionPastDue: vi.fn(),
  onSubscriptionPaused: vi.fn(),
}));

import { createWebhookEndpoint } from "../webhook.js";
import * as hooks from "../hooks.js";

async function callWebhook(
  options: CreemOptions,
  payload: object,
  signatureOverride?: string | null,
) {
  const payloadStr = JSON.stringify(payload);
  const signature =
    signatureOverride !== undefined
      ? signatureOverride
      : await generateSignature(payloadStr, options.webhookSecret!);

  const ctx = createMockContext({
    requestText: payloadStr,
    headers: {
      ...(signature !== null ? { "creem-signature": signature } : {}),
    },
  });

  // Re-create request with proper headers and text mock
  const headers = new Headers(signature !== null ? { "creem-signature": signature } : {});
  const req = new Request("https://example.com/api/creem/webhook", {
    method: "POST",
    headers,
  });
  (req as any).text = vi.fn().mockResolvedValue(payloadStr);
  (ctx as any).request = req;

  const handler = createWebhookEndpoint(options);
  await handler(ctx as any);
  return ctx;
}

describe("webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when no request", async () => {
    const ctx = createMockContext({ request: null });
    (ctx as any).request = undefined;
    const handler = createWebhookEndpoint(defaultOptions);
    await handler(ctx as any);
    expect(ctx.json).toHaveBeenCalledWith({ error: "Request is required" }, { status: 400 });
  });

  it("rejects when no webhook secret configured", async () => {
    const options = { ...defaultOptions, webhookSecret: undefined };
    const payload = { eventType: "checkout.completed", id: "e1", created_at: 1 };
    const ctx = createMockContext({
      requestText: JSON.stringify(payload),
      headers: { "creem-signature": "any" },
    });
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "creem-signature": "any" },
    });
    (req as any).text = vi.fn().mockResolvedValue(JSON.stringify(payload));
    (ctx as any).request = req;

    const handler = createWebhookEndpoint(options);
    await handler(ctx as any);
    expect(ctx.json).toHaveBeenCalledWith(
      { error: "Webhook secret is not configured" },
      { status: 400 },
    );
  });

  it("rejects invalid signature", async () => {
    const payload = {
      eventType: "checkout.completed",
      id: "e1",
      created_at: 1,
      object: mockCheckout,
    };
    const ctx = await callWebhook(defaultOptions, payload, "bad_signature");
    expect(ctx.json).toHaveBeenCalledWith({ error: "Invalid signature" }, { status: 400 });
  });

  it("routes checkout.completed to onCheckoutCompleted hook and callback", async () => {
    const onCheckoutCompleted = vi.fn();
    const options = { ...defaultOptions, onCheckoutCompleted };
    const event = {
      eventType: "checkout.completed",
      id: "e1",
      created_at: 1234567890,
      object: mockCheckout,
    };
    await callWebhook(options, event);
    expect(hooks.onCheckoutCompleted).toHaveBeenCalled();
    expect(onCheckoutCompleted).toHaveBeenCalled();
  });

  it("routes subscription.active to hook and fires onGrantAccess", async () => {
    const onGrantAccess = vi.fn();
    const onSubscriptionActive = vi.fn();
    const options = { ...defaultOptions, onGrantAccess, onSubscriptionActive };
    const event = {
      eventType: "subscription.active",
      id: "e1",
      created_at: 1234567890,
      object: mockSubscription,
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionActive).toHaveBeenCalled();
    expect(onGrantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "subscription_active" }),
    );
    expect(onSubscriptionActive).toHaveBeenCalled();
  });

  it("routes subscription.trialing to hook and fires onGrantAccess", async () => {
    const onGrantAccess = vi.fn();
    const options = { ...defaultOptions, onGrantAccess };
    const event = {
      eventType: "subscription.trialing",
      id: "e1",
      created_at: 1234567890,
      object: { ...mockSubscription, status: "trialing" },
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionTrialing).toHaveBeenCalled();
    expect(onGrantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "subscription_trialing" }),
    );
  });

  it("routes subscription.paid to hook and fires onGrantAccess", async () => {
    const onGrantAccess = vi.fn();
    const options = { ...defaultOptions, onGrantAccess };
    const event = {
      eventType: "subscription.paid",
      id: "e1",
      created_at: 1234567890,
      object: mockSubscription,
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionPaid).toHaveBeenCalled();
    expect(onGrantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "subscription_paid" }),
    );
  });

  it("routes subscription.expired to hook and fires onRevokeAccess", async () => {
    const onRevokeAccess = vi.fn();
    const options = { ...defaultOptions, onRevokeAccess };
    const event = {
      eventType: "subscription.expired",
      id: "e1",
      created_at: 1234567890,
      object: mockSubscription,
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionExpired).toHaveBeenCalled();
    expect(onRevokeAccess).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "subscription_expired" }),
    );
  });

  it("routes subscription.paused to hook and fires onRevokeAccess", async () => {
    const onRevokeAccess = vi.fn();
    const options = { ...defaultOptions, onRevokeAccess };
    const event = {
      eventType: "subscription.paused",
      id: "e1",
      created_at: 1234567890,
      object: { ...mockSubscription, status: "paused" },
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionPaused).toHaveBeenCalled();
    expect(onRevokeAccess).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "subscription_paused" }),
    );
  });

  it("routes subscription.canceled to hook and callback", async () => {
    const onSubscriptionCanceled = vi.fn();
    const options = { ...defaultOptions, onSubscriptionCanceled };
    const event = {
      eventType: "subscription.canceled",
      id: "e1",
      created_at: 1234567890,
      object: { ...mockSubscription, status: "canceled" },
    };
    await callWebhook(options, event);
    expect(hooks.onSubscriptionCanceled).toHaveBeenCalled();
    expect(onSubscriptionCanceled).toHaveBeenCalled();
  });

  it("routes subscription.unpaid to hook", async () => {
    const event = {
      eventType: "subscription.unpaid",
      id: "e1",
      created_at: 1234567890,
      object: { ...mockSubscription, status: "unpaid" },
    };
    await callWebhook(defaultOptions, event);
    expect(hooks.onSubscriptionUnpaid).toHaveBeenCalled();
  });

  it("routes subscription.update to hook", async () => {
    const event = {
      eventType: "subscription.update",
      id: "e1",
      created_at: 1234567890,
      object: mockSubscription,
    };
    await callWebhook(defaultOptions, event);
    expect(hooks.onSubscriptionUpdate).toHaveBeenCalled();
  });

  it("routes subscription.past_due to hook", async () => {
    const event = {
      eventType: "subscription.past_due",
      id: "e1",
      created_at: 1234567890,
      object: mockSubscription,
    };
    await callWebhook(defaultOptions, event);
    expect(hooks.onSubscriptionPastDue).toHaveBeenCalled();
  });

  it("routes refund.created to callback", async () => {
    const onRefundCreated = vi.fn();
    const options = { ...defaultOptions, onRefundCreated };
    const event = {
      eventType: "refund.created",
      id: "e1",
      created_at: 1234567890,
      object: mockRefund,
    };
    await callWebhook(options, event);
    expect(onRefundCreated).toHaveBeenCalled();
  });

  it("routes dispute.created to callback", async () => {
    const onDisputeCreated = vi.fn();
    const options = { ...defaultOptions, onDisputeCreated };
    const event = {
      eventType: "dispute.created",
      id: "e1",
      created_at: 1234567890,
      object: mockDispute,
    };
    await callWebhook(options, event);
    expect(onDisputeCreated).toHaveBeenCalled();
  });

  it("returns 500 on processing error", async () => {
    // Force an error by making text() throw
    const ctx = createMockContext();
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "creem-signature": "test" },
    });
    (req as any).text = vi.fn().mockRejectedValue(new Error("Read error"));
    (ctx as any).request = req;

    const handler = createWebhookEndpoint(defaultOptions);
    await handler(ctx as any);
    expect(ctx.json).toHaveBeenCalledWith({ error: "Failed to process webhook" }, { status: 500 });
  });

  it("rejects empty string signature", async () => {
    const payload = {
      eventType: "checkout.completed",
      id: "e1",
      created_at: 1,
      object: mockCheckout,
    };
    const ctx = await callWebhook(defaultOptions, payload, "");
    expect(ctx.json).toHaveBeenCalledWith({ error: "Invalid signature" }, { status: 400 });
  });

  it("returns 400 for unknown event type", async () => {
    const event = {
      eventType: "unknown.event",
      id: "e1",
      created_at: 1234567890,
      object: { id: "obj_1" },
    };
    // parseWebhookEvent will throw for invalid event types
    // since isWebhookEventEntity returns false
    const ctx = await callWebhook(defaultOptions, event);
    // The parseWebhookEvent throws "Invalid webhook event" which is caught
    // by the outer try-catch and returns 500
    expect(ctx.json).toHaveBeenCalledWith({ error: "Failed to process webhook" }, { status: 500 });
  });

  it("returns 500 when hook function throws", async () => {
    // Make the internal hook throw
    vi.mocked(hooks.onCheckoutCompleted).mockRejectedValueOnce(new Error("Hook processing failed"));
    const event = {
      eventType: "checkout.completed",
      id: "e1",
      created_at: 1234567890,
      object: mockCheckout,
    };
    const ctx = await callWebhook(defaultOptions, event);
    expect(ctx.json).toHaveBeenCalledWith({ error: "Failed to process webhook" }, { status: 500 });
  });

  // Regression: async user callbacks must be awaited so async work (DB writes,
  // API calls) finishes before the response returns. Without await, serverless
  // runtimes (Cloudflare Workers, Vercel Edge) terminate the worker and drop
  // the pending Promise.
  describe("async user-facing callbacks are awaited", () => {
    const delayMacrotask = () => new Promise((resolve) => setTimeout(resolve, 10));

    it("awaits onCheckoutCompleted before returning", async () => {
      let completed = false;
      const onCheckoutCompleted = vi.fn(async () => {
        await delayMacrotask();
        completed = true;
      });
      const options = { ...defaultOptions, onCheckoutCompleted };
      const event = {
        eventType: "checkout.completed",
        id: "e1",
        created_at: 1234567890,
        object: mockCheckout,
      };
      await callWebhook(options, event);
      expect(completed).toBe(true);
    });

    it("awaits onGrantAccess and onSubscriptionActive before returning", async () => {
      let grantDone = false;
      let activeDone = false;
      const onGrantAccess = vi.fn(async () => {
        await delayMacrotask();
        grantDone = true;
      });
      const onSubscriptionActive = vi.fn(async () => {
        await delayMacrotask();
        activeDone = true;
      });
      const options = { ...defaultOptions, onGrantAccess, onSubscriptionActive };
      const event = {
        eventType: "subscription.active",
        id: "e1",
        created_at: 1234567890,
        object: mockSubscription,
      };
      await callWebhook(options, event);
      expect(grantDone).toBe(true);
      expect(activeDone).toBe(true);
    });

    it("awaits onRevokeAccess on subscription.expired", async () => {
      let revoked = false;
      const onRevokeAccess = vi.fn(async () => {
        await delayMacrotask();
        revoked = true;
      });
      const options = { ...defaultOptions, onRevokeAccess };
      const event = {
        eventType: "subscription.expired",
        id: "e1",
        created_at: 1234567890,
        object: { ...mockSubscription, status: "expired" },
      };
      await callWebhook(options, event);
      expect(revoked).toBe(true);
    });

    it("awaits onRefundCreated before returning", async () => {
      let done = false;
      const onRefundCreated = vi.fn(async () => {
        await delayMacrotask();
        done = true;
      });
      const options = { ...defaultOptions, onRefundCreated };
      const event = {
        eventType: "refund.created",
        id: "e1",
        created_at: 1234567890,
        object: mockRefund,
      };
      await callWebhook(options, event);
      expect(done).toBe(true);
    });
  });
});
