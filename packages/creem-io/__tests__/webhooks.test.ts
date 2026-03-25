import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { webhooksResource } from "../resources/webhooks";

const TEST_SECRET = "whsec_test_secret_123";

function makeEvent(
  eventType: string,
  objectType: string,
  extraFields: Record<string, unknown> = {},
) {
  return {
    id: "evt_123",
    eventType,
    created_at: 1700000000,
    object: {
      object: objectType,
      id: "obj_123",
      mode: "test",
      ...extraFields,
    },
  };
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("webhooks", () => {
  describe("signature verification", () => {
    it("accepts valid signature", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const payload = JSON.stringify(makeEvent("checkout.completed", "checkout"));
      const signature = sign(payload, TEST_SECRET);

      await expect(webhooks.handleEvents(payload, signature, {})).resolves.not.toThrow();
    });

    it("rejects invalid signature", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const payload = JSON.stringify(makeEvent("checkout.completed", "checkout"));

      await expect(webhooks.handleEvents(payload, "bad_sig", {})).rejects.toThrow(
        "Invalid webhook signature",
      );
    });

    it("rejects tampered payload", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const payload = JSON.stringify(makeEvent("checkout.completed", "checkout"));
      const signature = sign(payload, TEST_SECRET);
      const tampered = payload.replace("evt_123", "evt_999");

      await expect(webhooks.handleEvents(tampered, signature, {})).rejects.toThrow(
        "Invalid webhook signature",
      );
    });
  });

  describe("missing webhook secret", () => {
    it("throws when webhook secret is not configured", async () => {
      const webhooks = webhooksResource(undefined);
      const payload = JSON.stringify(makeEvent("checkout.completed", "checkout"));

      await expect(webhooks.handleEvents(payload, "sig", {})).rejects.toThrow(
        "Webhook secret not configured",
      );
    });
  });

  describe("event routing", () => {
    async function testEventRouting(
      eventType: string,
      objectType: string,
      handlerName: string,
      extraFields: Record<string, unknown> = {},
    ) {
      const webhooks = webhooksResource(TEST_SECRET);
      const handler = vi.fn();
      const payload = JSON.stringify(makeEvent(eventType, objectType, extraFields));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { [handlerName]: handler });
      expect(handler).toHaveBeenCalledOnce();
      return handler;
    }

    it("routes checkout.completed to onCheckoutCompleted", async () => {
      await testEventRouting("checkout.completed", "checkout", "onCheckoutCompleted");
    });

    it("routes refund.created to onRefundCreated", async () => {
      await testEventRouting("refund.created", "refund", "onRefundCreated");
    });

    it("routes dispute.created to onDisputeCreated", async () => {
      await testEventRouting("dispute.created", "dispute", "onDisputeCreated");
    });

    it("routes subscription.active to onSubscriptionActive", async () => {
      await testEventRouting("subscription.active", "subscription", "onSubscriptionActive");
    });

    it("routes subscription.trialing to onSubscriptionTrialing", async () => {
      await testEventRouting("subscription.trialing", "subscription", "onSubscriptionTrialing");
    });

    it("routes subscription.canceled to onSubscriptionCanceled", async () => {
      await testEventRouting("subscription.canceled", "subscription", "onSubscriptionCanceled");
    });

    it("routes subscription.paid to onSubscriptionPaid", async () => {
      await testEventRouting("subscription.paid", "subscription", "onSubscriptionPaid");
    });

    it("routes subscription.expired to onSubscriptionExpired", async () => {
      await testEventRouting("subscription.expired", "subscription", "onSubscriptionExpired");
    });

    it("routes subscription.unpaid to onSubscriptionUnpaid", async () => {
      await testEventRouting("subscription.unpaid", "subscription", "onSubscriptionUnpaid");
    });

    it("routes subscription.update to onSubscriptionUpdate", async () => {
      await testEventRouting("subscription.update", "subscription", "onSubscriptionUpdate");
    });

    it("routes subscription.past_due to onSubscriptionPastDue", async () => {
      await testEventRouting("subscription.past_due", "subscription", "onSubscriptionPastDue");
    });

    it("routes subscription.paused to onSubscriptionPaused", async () => {
      await testEventRouting("subscription.paused", "subscription", "onSubscriptionPaused");
    });

    it("routes subscription.scheduled_cancel to onSubscriptionScheduledCancel", async () => {
      await testEventRouting(
        "subscription.scheduled_cancel",
        "subscription",
        "onSubscriptionScheduledCancel",
      );
    });
  });

  describe("onGrantAccess / onRevokeAccess", () => {
    it("calls onGrantAccess for subscription.active with correct reason", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const onGrantAccess = vi.fn();
      const payload = JSON.stringify(makeEvent("subscription.active", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onGrantAccess });
      expect(onGrantAccess).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "subscription_active" }),
      );
    });

    it("calls onGrantAccess for subscription.trialing with correct reason", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const onGrantAccess = vi.fn();
      const payload = JSON.stringify(makeEvent("subscription.trialing", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onGrantAccess });
      expect(onGrantAccess).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "subscription_trialing" }),
      );
    });

    it("calls onGrantAccess for subscription.paid with correct reason", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const onGrantAccess = vi.fn();
      const payload = JSON.stringify(makeEvent("subscription.paid", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onGrantAccess });
      expect(onGrantAccess).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "subscription_paid" }),
      );
    });

    it("calls onRevokeAccess for subscription.paused with correct reason", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const onRevokeAccess = vi.fn();
      const payload = JSON.stringify(makeEvent("subscription.paused", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onRevokeAccess });
      expect(onRevokeAccess).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "subscription_paused" }),
      );
    });

    it("calls onRevokeAccess for subscription.expired with correct reason", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const onRevokeAccess = vi.fn();
      const payload = JSON.stringify(makeEvent("subscription.expired", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onRevokeAccess });
      expect(onRevokeAccess).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "subscription_expired" }),
      );
    });

    it("calls onGrantAccess before the specific event handler", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const callOrder: string[] = [];
      const onGrantAccess = vi.fn(() => {
        callOrder.push("grant");
      });
      const onSubscriptionActive = vi.fn(() => {
        callOrder.push("active");
      });
      const payload = JSON.stringify(makeEvent("subscription.active", "subscription"));
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onGrantAccess, onSubscriptionActive });
      expect(callOrder).toEqual(["grant", "active"]);
    });
  });

  describe("snake_case to camelCase normalization", () => {
    it("normalizes object keys to camelCase", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const handler = vi.fn();
      const event = {
        id: "evt_1",
        eventType: "checkout.completed",
        created_at: 1700000000,
        object: {
          object: "checkout",
          id: "chk_1",
          mode: "test",
          checkout_url: "https://example.com",
          success_url: "https://done.com",
        },
      };
      const payload = JSON.stringify(event);
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(payload, signature, { onCheckoutCompleted: handler });
      const data = handler.mock.calls[0][0];
      expect(data.checkoutUrl).toBe("https://example.com");
      expect(data.successUrl).toBe("https://done.com");
    });
  });

  describe("unknown events", () => {
    it("silently ignores unknown event types", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const event = {
        id: "evt_1",
        eventType: "unknown.event",
        created_at: 1700000000,
        object: { object: "checkout", id: "x", mode: "test" },
      };
      const payload = JSON.stringify(event);
      const signature = sign(payload, TEST_SECRET);

      await expect(webhooks.handleEvents(payload, signature, {})).resolves.not.toThrow();
    });
  });

  describe("Buffer payload", () => {
    it("accepts Buffer payload", async () => {
      const webhooks = webhooksResource(TEST_SECRET);
      const handler = vi.fn();
      const payload = JSON.stringify(makeEvent("checkout.completed", "checkout"));
      const buffer = Buffer.from(payload, "utf8");
      const signature = sign(payload, TEST_SECRET);

      await webhooks.handleEvents(buffer, signature, { onCheckoutCompleted: handler });
      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
