import { describe, expect, it } from "vitest";
import {
  constructWebhookEvent,
  parseWebhookEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "../src/webhooks.js";
import {
  customerEntityFromJSON,
  subscriptionEntityFromJSON,
} from "../src/models/components/index.js";

const legacySecret = "whsec_test_secret";

const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const hmacSha256 = async (key: string | Uint8Array, value: string) => {
  const keyBytes = typeof key === "string" ? textEncoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      toArrayBuffer(textEncoder.encode(value)),
    ),
  );
};

const legacySignature = async (payload: string, secret = legacySecret) =>
  toHex(await hmacSha256(secret, payload));

const standardSecretBytes = textEncoder.encode("standard-secret");
const standardSecret = `whsec_${toBase64(standardSecretBytes)}`;

const standardSignature = async (id: string, timestamp: number, payload: string) =>
  `v1,${toBase64(
    await hmacSha256(standardSecretBytes, `${id}.${timestamp}.${payload}`),
  )}`;

describe("webhooks", () => {
  const payload = JSON.stringify({
    id: "evt_123",
    eventType: "checkout.completed",
    object: { id: "ch_123" },
    created_at: 1700000000,
  });

  it("verifies legacy creem-signature headers", async () => {
    await expect(
      verifyWebhookSignature(
        payload,
        { "creem-signature": await legacySignature(payload) },
        legacySecret,
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts sha256-prefixed legacy signatures and case-insensitive headers", async () => {
    await expect(
      verifyWebhookSignature(
        payload,
        { "Creem-Signature": `sha256=${await legacySignature(payload)}` },
        legacySecret,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects invalid legacy signatures", async () => {
    await expect(
      verifyWebhookSignature(payload, { "creem-signature": "bad" }, legacySecret),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("verifies standard webhook headers", async () => {
    const timestamp = Math.floor(Date.now() / 1000);

    await expect(
      verifyWebhookSignature(
        payload,
        {
          "webhook-id": "msg_123",
          "webhook-timestamp": String(timestamp),
          "webhook-signature": await standardSignature("msg_123", timestamp, payload),
        },
        standardSecret,
      ),
    ).resolves.toBeUndefined();
  });

  it("constructs normalized events after verification", async () => {
    const event = await constructWebhookEvent<{ id: string }>(
      payload,
      { "creem-signature": await legacySignature(payload) },
      legacySecret,
    );

    expect(event).toEqual({
      type: "checkout.completed",
      data: { id: "ch_123" },
      raw: JSON.parse(payload),
      id: "evt_123",
      createdAt: 1700000000,
    });
  });

  it("parses type/data webhook payloads", () => {
    const event = parseWebhookEvent<{ id: string }>(
      JSON.stringify({
        type: "subscription.canceled",
        data: { id: "sub_123" },
      }),
    );

    expect(event.type).toBe("subscription.canceled");
    expect(event.data.id).toBe("sub_123");
  });

  it("preserves metadata on generated customer and subscription entities", () => {
    const customer = customerEntityFromJSON(
      JSON.stringify({
        id: "cust_123",
        mode: "test",
        object: "customer",
        email: "customer@example.com",
        metadata: { userId: "user_123" },
        country: "US",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }),
    );

    expect(customer.ok).toBe(true);
    if (!customer.ok) throw customer.error;
    expect(customer.value.metadata?.userId).toBe("user_123");

    const subscription = subscriptionEntityFromJSON(
      JSON.stringify({
        id: "sub_123",
        mode: "test",
        object: "subscription",
        product: "prod_123",
        customer: "cust_123",
        collection_method: "charge_automatically",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        metadata: { userId: "user_123" },
      }),
    );

    expect(subscription.ok).toBe(true);
    if (!subscription.ok) throw subscription.error;
    expect(subscription.value.metadata?.userId).toBe("user_123");
  });
});
