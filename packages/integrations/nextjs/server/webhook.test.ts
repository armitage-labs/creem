import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "./webhook";

const webhookSecret = "test_webhook_secret";

function subscriptionEvent(status: string, periodEnd = "2099-09-30T12:00:00.000Z") {
  return {
    id: "evt_subscription_123",
    eventType: `subscription.${status}`,
    created_at: 1788940800000,
    object: {
      id: "sub_123",
      object: "subscription",
      status,
      current_period_end_date: periodEnd,
      customer: { id: "cust_123", object: "customer", email: "customer@example.com" },
      product: { id: "prod_123", object: "product", name: "Pro" },
      metadata: { referenceId: "user_123" },
    },
  };
}

function signedRequest(event: ReturnType<typeof subscriptionEvent>, secret = webhookSecret) {
  const body = JSON.stringify(event);
  return new NextRequest("https://example.com/api/webhooks/creem", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "creem-signature": createHmac("sha256", secret).update(body).digest("hex"),
    },
  });
}

describe("Webhook access callbacks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["2000-09-30T12:00:00.000Z", "2099-09-30T12:00:00.000Z"])(
    "awaits revocation before the canceled callback regardless of period end (%s)",
    async (periodEnd) => {
      const event = subscriptionEvent("canceled", periodEnd);
      const calls: string[] = [];
      const onRevokeAccess = vi.fn(async () => {
        calls.push("revoke started");
        await Promise.resolve();
        calls.push("revoke finished");
      });
      const onSubscriptionCanceled = vi.fn(() => {
        calls.push("canceled");
      });
      const onGrantAccess = vi.fn();

      const response = await Webhook({
        webhookSecret,
        onRevokeAccess,
        onSubscriptionCanceled,
        onGrantAccess,
      })(signedRequest(event));

      expect(response.status).toBe(200);
      expect(onRevokeAccess).toHaveBeenCalledExactlyOnceWith({
        reason: "subscription_canceled",
        ...event.object,
      });
      expect(onSubscriptionCanceled).toHaveBeenCalledExactlyOnceWith({
        webhookEventType: event.eventType,
        webhookId: event.id,
        webhookCreatedAt: event.created_at,
        ...event.object,
      });
      expect(calls).toEqual(["revoke started", "revoke finished", "canceled"]);
      expect(onGrantAccess).not.toHaveBeenCalled();
    },
  );

  it("acknowledges scheduled cancellation without changing access", async () => {
    const event = subscriptionEvent("scheduled_cancel");
    const onSubscriptionScheduledCancel = vi.fn();
    const onSubscriptionCanceled = vi.fn();
    const onRevokeAccess = vi.fn();
    const onGrantAccess = vi.fn();

    const response = await Webhook({
      webhookSecret,
      onSubscriptionScheduledCancel,
      onSubscriptionCanceled,
      onRevokeAccess,
      onGrantAccess,
    })(signedRequest(event));

    expect(response.status).toBe(200);
    expect(onSubscriptionScheduledCancel).toHaveBeenCalledExactlyOnceWith({
      webhookEventType: event.eventType,
      webhookId: event.id,
      webhookCreatedAt: event.created_at,
      ...event.object,
    });
    expect(onSubscriptionCanceled).not.toHaveBeenCalled();
    expect(onRevokeAccess).not.toHaveBeenCalled();
    expect(onGrantAccess).not.toHaveBeenCalled();
  });

  it.each(["revoke only", "canceled only", "neither"])(
    "keeps cancellation callbacks optional (%s)",
    async (configuration) => {
      const callback = vi.fn();
      const response = await Webhook({
        webhookSecret,
        onRevokeAccess: configuration === "revoke only" ? callback : undefined,
        onSubscriptionCanceled: configuration === "canceled only" ? callback : undefined,
      })(signedRequest(subscriptionEvent("canceled")));

      expect(response.status).toBe(200);
      expect(callback).toHaveBeenCalledTimes(configuration === "neither" ? 0 : 1);
    },
  );

  it.each(["paused", "expired"])("continues revoking access for %s", async (status) => {
    const event = subscriptionEvent(status);
    const onRevokeAccess = vi.fn();
    const response = await Webhook({ webhookSecret, onRevokeAccess })(signedRequest(event));

    expect(response.status).toBe(200);
    expect(onRevokeAccess).toHaveBeenCalledExactlyOnceWith({
      reason: `subscription_${status}`,
      ...event.object,
    });
  });

  it("returns an error for retry when revocation fails, then processes redelivery", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const event = subscriptionEvent("canceled");
    const onRevokeAccess = vi.fn().mockRejectedValueOnce(new Error("Database unavailable"));
    const onSubscriptionCanceled = vi.fn();
    const handler = Webhook({ webhookSecret, onRevokeAccess, onSubscriptionCanceled });

    const failedResponse = await handler(signedRequest(event));

    expect(failedResponse.status).toBe(500);
    expect(onSubscriptionCanceled).not.toHaveBeenCalled();

    const retryResponse = await handler(signedRequest(event));

    expect(retryResponse.status).toBe(200);
    expect(onRevokeAccess).toHaveBeenCalledTimes(2);
    expect(onSubscriptionCanceled).toHaveBeenCalledTimes(1);
  });

  it("does not revoke access for a cancellation with an invalid signature", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onRevokeAccess = vi.fn();
    const onSubscriptionCanceled = vi.fn();
    const response = await Webhook({
      webhookSecret,
      onRevokeAccess,
      onSubscriptionCanceled,
    })(signedRequest(subscriptionEvent("canceled"), "incorrect_secret"));

    expect(response.status).toBe(400);
    expect(onRevokeAccess).not.toHaveBeenCalled();
    expect(onSubscriptionCanceled).not.toHaveBeenCalled();
  });
});
