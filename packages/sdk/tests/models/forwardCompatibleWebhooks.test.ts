import { describe, expect, it } from "vitest";
import { parseWebhookEventEntity } from "../../src/webhooks.js";
import { isUnknown } from "../../src/types/discriminatedUnion.js";
import { WebhookEventType } from "../../src/models/components/webhookeventtype.js";
import { SDKValidationError } from "../../src/models/errors/sdkvalidationerror.js";
import { readFileSync } from "node:fs";
import { subscriptionEntityFromJSON } from "../../src/models/components/index.js";

// ENG-2487: values outside API responses are open too. Webhook payload models
// aren't referenced by any operation's response, and single-value enums aren't
// opened by the generator default, so the overlay
// `.speakeasy/forward-compatible.overlay.yaml` opens them.
describe("forward-compatible webhook payloads", () => {
  it("returns an event type the SDK doesn't know yet instead of throwing", () => {
    const event = parseWebhookEventEntity(
      JSON.stringify({
        id: "evt_123",
        eventType: "invoice.finalized",
        created_at: 1700000000,
        object: { id: "inv_123" },
      }),
    );

    // The generated open union marks it and keeps the payload as sent.
    expect(event.eventType).toBe("UNKNOWN");
    expect(isUnknown(event)).toBe(true);
    if (!isUnknown(event)) throw new Error("expected the unknown variant");
    expect((event.raw as { eventType: string }).eventType).toBe("invoice.finalized");
  });

  it("still parses a known event type into its own shape", () => {
    const event = parseWebhookEventEntity(
      JSON.stringify({
        id: "evt_123",
        eventType: "refund.created",
        created_at: 1700000000,
        object: {
          id: "ref_123",
          mode: "test",
          object: "refund",
          status: "succeeded",
          refund_amount: 100,
          refund_currency: "EUR",
          reason: "chargeback_won",
          transaction: {
            id: "tran_123",
            mode: "test",
            object: "transaction",
            amount: 100,
            currency: "EUR",
            type: "payment",
            status: "refunded",
            created_at: 1700000000,
          },
          created_at: 1700000000,
        },
      }),
    );

    expect(event.eventType).toBe("refund.created");
    if (event.eventType !== "refund.created") throw new Error("wrong variant");
    expect(event.object.reason).toBe("chargeback_won");
  });

  it("keeps a collection method the SDK doesn't know yet", () => {
    const subscription = subscriptionEntityFromJSON(
      JSON.stringify({
        id: "sub_123",
        mode: "test",
        object: "subscription",
        product: "prod_123",
        customer: "cust_123",
        collection_method: "send_invoice",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }),
    );

    expect(subscription.ok).toBe(true);
    if (!subscription.ok) throw subscription.error;
    expect(subscription.value.collectionMethod).toBe("send_invoice");
  });

  // The generated open union also falls back to UNKNOWN when a KNOWN event
  // fails validation. That's a malformed payload, not a newer event type, so
  // the parser must still refuse it, as 1.x did.
  it("still refuses a known event type whose payload doesn't match it", () => {
    const malformed = JSON.stringify({
      id: "evt_123",
      eventType: "subscription.canceled",
      created_at: 1700000000,
      object: { id: "sub_123" },
    });

    expect(() => parseWebhookEventEntity(malformed)).toThrow(SDKValidationError);
  });

  it("knows exactly the event types of the webhook union", () => {
    const spec = JSON.parse(readFileSync(new URL("../../openapi.json", import.meta.url), "utf8"));
    const unionTypes = Object.keys(
      spec.components.schemas.WebhookEventEntity.discriminator.mapping,
    );

    expect(new Set(Object.values(WebhookEventType))).toEqual(new Set(unionTypes));
  });
});
