import { describe, it, expect } from "vitest";
import { createTestCreemClient, getTestConfig, hasCredentials } from "./setup.js";

describe.skipIf(!hasCredentials())("Checkout integration", () => {
  const config = getTestConfig();
  const creem = createTestCreemClient();

  it("creates a checkout session for a recurring product", async () => {
    const checkout = await creem.checkouts.create({
      productId: config.productId,
      customer: { email: "integration-test@example.com" },
      successUrl: "https://example.com/success",
      metadata: { referenceId: "test_user_integration" },
    });

    expect(checkout.checkoutUrl).toBeDefined();
    expect(typeof checkout.checkoutUrl).toBe("string");
    expect(checkout.checkoutUrl).toMatch(/^https:\/\//);
  });

  it("creates a checkout with custom success URL", async () => {
    const checkout = await creem.checkouts.create({
      productId: config.productId,
      customer: { email: "integration-test@example.com" },
      successUrl: "https://example.com/custom-success",
    });

    expect(checkout.checkoutUrl).toBeDefined();
  });

  it("includes metadata in checkout", async () => {
    const checkout = await creem.checkouts.create({
      productId: config.productId,
      customer: { email: "integration-test@example.com" },
      successUrl: "https://example.com/success",
      metadata: {
        referenceId: "user_meta_test",
        customField: "test_value",
      },
    });

    expect(checkout.checkoutUrl).toBeDefined();
  });

  it("returns SDK CheckoutEntity shape with camelCase fields", async () => {
    const checkout = await creem.checkouts.create({
      productId: config.productId,
      customer: { email: "integration-test@example.com" },
      successUrl: "https://example.com/success",
    });

    // SDK responses use camelCase (not snake_case like webhook payloads)
    expect(checkout).toHaveProperty("checkoutUrl");
    expect(checkout.id).toBeDefined();
    expect(typeof checkout.id).toBe("string");

    // Status should be a valid checkout status
    if (checkout.status) {
      expect(typeof checkout.status).toBe("string");
    }
  });
});
