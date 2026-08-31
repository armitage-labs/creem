import { describe, it, expect } from "vitest";
import { generateSignature, parseWebhookEvent, resolveSuccessUrl } from "../utils.js";
import { createMockContext, mockSubscription, mockProduct, mockCustomer } from "./fixtures.js";

describe("generateSignature", () => {
  it("produces consistent output for the same inputs", async () => {
    const sig1 = await generateSignature("payload", "secret");
    const sig2 = await generateSignature("payload", "secret");
    expect(sig1).toBe(sig2);
  });

  it("produces a hex string", async () => {
    const sig = await generateSignature("test", "secret");
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it("produces different output for different payloads", async () => {
    const sig1 = await generateSignature("payload1", "secret");
    const sig2 = await generateSignature("payload2", "secret");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different output for different secrets", async () => {
    const sig1 = await generateSignature("payload", "secret1");
    const sig2 = await generateSignature("payload", "secret2");
    expect(sig1).not.toBe(sig2);
  });
});

describe("parseWebhookEvent", () => {
  it("parses a valid checkout.completed event", () => {
    const event = {
      eventType: "checkout.completed",
      id: "evt_1",
      created_at: 1234567890,
      object: {
        id: "chk_1",
        object: "checkout",
        mode: "test",
        status: "completed",
        request_id: "req_1",
        product: mockProduct,
        units: 1,
        customer: mockCustomer,
      },
    };
    const parsed = parseWebhookEvent(JSON.stringify(event));
    expect(parsed.eventType).toBe("checkout.completed");
    expect(parsed.id).toBe("evt_1");
  });

  it("parses a valid subscription.active event", () => {
    const event = {
      eventType: "subscription.active",
      id: "evt_2",
      created_at: 1234567890,
      object: {
        ...mockSubscription,
      },
    };
    const parsed = parseWebhookEvent(JSON.stringify(event));
    expect(parsed.eventType).toBe("subscription.active");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseWebhookEvent("not json")).toThrow();
  });

  it("throws on missing required fields", () => {
    expect(() => parseWebhookEvent(JSON.stringify({ foo: "bar" }))).toThrow(
      "Invalid webhook event",
    );
  });

  it("throws when eventType is missing", () => {
    const event = {
      id: "evt_1",
      created_at: 1234567890,
      object: { id: "x", object: "checkout", mode: "test" },
    };
    expect(() => parseWebhookEvent(JSON.stringify(event))).toThrow("Invalid webhook event");
  });

  it("throws when object is not a valid entity", () => {
    const event = {
      eventType: "checkout.completed",
      id: "evt_1",
      created_at: 1234567890,
      object: { id: "x", object: "invalid_type", mode: "test" },
    };
    expect(() => parseWebhookEvent(JSON.stringify(event))).toThrow("Invalid webhook event");
  });
});

describe("resolveSuccessUrl", () => {
  it("returns undefined for undefined input", () => {
    const ctx = createMockContext();
    expect(resolveSuccessUrl(undefined, ctx)).toBeUndefined();
  });

  it("returns absolute URL as-is", () => {
    const ctx = createMockContext();
    const url = "https://example.com/success";
    expect(resolveSuccessUrl(url, ctx)).toBe(url);
  });

  it("resolves relative URL using host header", () => {
    const ctx = createMockContext({
      headers: { host: "myapp.com" },
    });
    expect(resolveSuccessUrl("/success", ctx)).toBe("https://myapp.com/success");
  });

  it("resolves relative URL using x-forwarded-host", () => {
    const ctx = createMockContext({
      headers: { "x-forwarded-host": "myapp.com" },
    });
    expect(resolveSuccessUrl("/success", ctx)).toBe("https://myapp.com/success");
  });

  it("uses x-forwarded-proto for protocol", () => {
    const ctx = createMockContext({
      headers: {
        host: "myapp.com",
        "x-forwarded-proto": "http",
      },
    });
    expect(resolveSuccessUrl("/success", ctx)).toBe("http://myapp.com/success");
  });

  it("returns relative URL as-is when no host is available", () => {
    const ctx = createMockContext({ headers: {} });
    expect(resolveSuccessUrl("/success", ctx)).toBe("/success");
  });
});
