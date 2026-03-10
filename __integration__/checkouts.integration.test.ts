import { describe, it, expect } from "vitest";
import { creem, hasCredentials, SUBSCRIPTION_PRODUCT_ID, ONETIME_PRODUCT_ID } from "./setup";

describe.skipIf(!hasCredentials())("checkouts (integration)", () => {
  it("creates a checkout for a subscription product", async () => {
    const checkout = await creem.checkouts.create({
      productId: SUBSCRIPTION_PRODUCT_ID,
    });

    expect(checkout).toHaveProperty("id");
    expect(checkout).toHaveProperty("checkoutUrl");
    expect(typeof checkout.checkoutUrl).toBe("string");
    expect(checkout.checkoutUrl).toContain("http");
  });

  it("creates a checkout for a one-time product", async () => {
    const checkout = await creem.checkouts.create({
      productId: ONETIME_PRODUCT_ID,
    });

    expect(checkout).toHaveProperty("id");
    expect(checkout).toHaveProperty("checkoutUrl");
    expect(typeof checkout.checkoutUrl).toBe("string");
    expect(checkout.checkoutUrl).toContain("http");
  });

  it("creates a checkout with customFields", async () => {
    const checkout = await creem.checkouts.create({
      productId: ONETIME_PRODUCT_ID,
      customFields: [{ type: "text", key: "company", label: "Company Name", optional: true }],
    });

    expect(checkout).toHaveProperty("id");
    expect(checkout).toHaveProperty("checkoutUrl");
    expect(typeof checkout.checkoutUrl).toBe("string");
  });

  it("creates a checkout with metadata and successUrl", async () => {
    const checkout = await creem.checkouts.create({
      productId: ONETIME_PRODUCT_ID,
      successUrl: "https://example.com/success",
      metadata: { orderId: "test-123" },
    });

    expect(checkout).toHaveProperty("id");
    expect(checkout).toHaveProperty("checkoutUrl");
  });
});
