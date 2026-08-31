import { describe, it, expect } from "vitest";
import { getTestConfig, hasCredentials } from "./setup.js";
import { generateSignature } from "../utils.js";
import {
  createCheckout,
  createPortal,
  retrieveSubscription,
  searchTransactions,
  validateWebhookSignature,
} from "../creem-server.js";

const serverConfig = {
  apiKey: process.env.CREEM_TEST_API_KEY || "",
  testMode: true,
};

describe.skipIf(!hasCredentials())("Full flow integration", () => {
  const config = getTestConfig();

  it("creates checkout, then verifies webhook signature round-trip", async () => {
    // Step 1: Create a checkout
    const checkout = await createCheckout(serverConfig, {
      productId: config.productId,
      customer: { email: "fullflow@example.com" },
      successUrl: "https://example.com/success",
      metadata: { referenceId: "flow_test_user" },
    });

    expect(checkout.url).toBeDefined();
    expect(checkout.redirect).toBe(true);

    // Step 2: Simulate a webhook by signing a payload
    if (config.webhookSecret) {
      const webhookPayload = JSON.stringify({
        eventType: "checkout.completed",
        id: "evt_flow_test",
        created_at: Math.floor(Date.now() / 1000),
        object: {
          id: "chk_flow",
          object: "checkout",
          mode: "test",
          status: "completed",
          request_id: "req_flow",
          product: {
            id: config.productId,
            object: "product",
            mode: "test",
            name: "Test",
            description: "Test",
            price: 1000,
            currency: "USD",
            billing_type: "recurring",
            billing_period: "every-month",
            status: "active",
            tax_mode: "inclusive",
            tax_category: "saas",
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
          },
          units: 1,
          customer: {
            id: "cust_flow",
            object: "customer",
            mode: "test",
            email: "fullflow@example.com",
            country: "US",
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
          },
          metadata: { referenceId: "flow_test_user" },
        },
      });

      const signature = await generateSignature(webhookPayload, config.webhookSecret);
      const isValid = await validateWebhookSignature(
        webhookPayload,
        signature,
        config.webhookSecret,
      );
      expect(isValid).toBe(true);
    }
  });

  it.skipIf(!config.subscriptionId)("retrieves subscription and verifies structure", async () => {
    const sub = await retrieveSubscription(serverConfig, config.subscriptionId);

    expect(sub).toBeDefined();
    expect(typeof sub).toBe("object");
  });

  it.skipIf(!config.customerId)("searches transactions for customer", async () => {
    const result = await searchTransactions(serverConfig, {
      customerId: config.customerId,
    });

    expect(result).toBeDefined();
  });

  it.skipIf(!config.customerId)("creates portal link for customer", async () => {
    const portal = await createPortal(serverConfig, config.customerId);

    expect(portal.url).toBeDefined();
    expect(portal.redirect).toBe(true);
  });
});
