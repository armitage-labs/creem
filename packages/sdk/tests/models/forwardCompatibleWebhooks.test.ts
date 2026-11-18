import { describe, expect, it } from "vitest";
import { parseWebhookEventEntity, webhookEventSchemas } from "../../src/webhooks.js";
import { isUnknown } from "../../src/types/discriminatedUnion.js";
import { WebhookEventType } from "../../src/models/components/webhookeventtype.js";
import { SDKValidationError } from "../../src/models/errors/sdkvalidationerror.js";
import { readFileSync } from "node:fs";
import * as z from "zod/v3";
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

  it("keeps a reversal side the SDK doesn't know yet on credits.reversed", () => {
    const event = parseWebhookEventEntity(
      JSON.stringify({
        id: "evt_123",
        eventType: "credits.reversed",
        created_at: 1700000000,
        object: {
          id: "cct_123",
          customer_id: "cust_123",
          account_id: "cca_123",
          bucket_name: "images",
          unit_label: "images",
          amount_minor_units: "100",
          balance_after_minor_units: "900",
          reference: "ord_123",
          occurred_at: "2026-01-01T00:00:00Z",
          object: "customer_credits_reversal",
          side: "transfer",
          reversed_transaction_id: "cct_122",
        },
      }),
    );

    expect(event.eventType).toBe("credits.reversed");
    if (event.eventType !== "credits.reversed") throw new Error("wrong variant");
    expect(event.object.side).toBe("transfer");
  });

  it("keeps a grant ask action and reason the SDK doesn't know yet on marketplace.grant.requested", () => {
    const event = parseWebhookEventEntity(
      JSON.stringify({
        id: "evt_123",
        eventType: "marketplace.grant.requested",
        created_at: 1700000000,
        object: {
          grantId: "grant_123",
          operationId: "op_123",
          action: "suspend",
          deadlineAt: null,
          reason: "abuse",
          listingId: "list_123",
          productId: "prod_123",
          order: null,
          test: true,
        },
      }),
    );

    expect(event.eventType).toBe("marketplace.grant.requested");
    if (event.eventType !== "marketplace.grant.requested") throw new Error("wrong variant");
    expect(event.object.action).toBe("suspend");
    expect(event.object.reason).toBe("abuse");
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

  it("names the failing field of a known event type whose payload doesn't match it", () => {
    const malformed = JSON.stringify({
      id: "evt_123",
      eventType: "refund.created",
      created_at: 1700000000,
      object: {
        id: "ref_123",
        mode: "test",
        object: "refund",
        status: "succeeded",
        refund_amount: "not-a-number",
        refund_currency: "EUR",
        reason: "duplicate",
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
    });

    let error: unknown;
    try {
      parseWebhookEventEntity(malformed);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SDKValidationError);
    const validationError = error as SDKValidationError;
    expect(validationError.message).toContain('Invalid "refund.created" webhook payload');
    expect(validationError.cause).toBeInstanceOf(z.ZodError);
    expect((validationError.cause as z.ZodError).issues.map((issue) => issue.path.join("."))).toEqual([
      "object.refund_amount",
    ]);
    expect(validationError.pretty()).toContain("<root>.object.refund_amount");
  });

  it("knows exactly the event types of the webhook union", () => {
    const spec = JSON.parse(readFileSync(new URL("../../openapi.json", import.meta.url), "utf8"));
    const unionTypes = Object.keys(
      spec.components.schemas.WebhookEventEntity.discriminator.mapping,
    );

    expect(new Set(Object.values(WebhookEventType))).toEqual(new Set(unionTypes));
    // The per-type schemas that name the failing field of a malformed payload.
    expect(new Set(Object.keys(webhookEventSchemas))).toEqual(new Set(unionTypes));
  });

  it.each([
    ["null", "null"],
    ["an array", "[]"],
    ["an object without eventType", JSON.stringify({ id: "evt_123", object: {} })],
    ["an empty eventType", JSON.stringify({ id: "evt_123", eventType: "", object: {} })],
    [
      "a type/data envelope",
      JSON.stringify({ type: "subscription.canceled", data: { id: "sub_123" } }),
    ],
  ])("refuses %s instead of calling it an unknown event", (_label, payload) => {
    expect(() => parseWebhookEventEntity(payload)).toThrow(SDKValidationError);
  });
});
