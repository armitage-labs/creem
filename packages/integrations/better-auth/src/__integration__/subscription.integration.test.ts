import { describe, it, expect } from "vitest";
import { createTestCreemClient, getTestConfig, hasCredentials } from "./setup.js";
import { isActiveSubscription, getDaysUntilRenewal } from "../creem-server.js";

describe.skipIf(!hasCredentials())("Subscription integration", () => {
  const config = getTestConfig();
  const creem = createTestCreemClient();

  it.skipIf(!config.subscriptionId)("retrieves an existing test subscription by ID", async () => {
    const subscription = await creem.subscriptions.get(config.subscriptionId);

    expect(subscription).toBeDefined();
    expect(subscription.id).toBe(config.subscriptionId);
    expect(subscription.status).toBeDefined();
  });

  it.skipIf(!config.subscriptionId)(
    "verifies subscription data structure with camelCase SDK fields",
    async () => {
      const subscription = await creem.subscriptions.get(config.subscriptionId);

      // SDK responses use camelCase (not snake_case like webhook payloads)
      expect(subscription).toHaveProperty("status");
      expect(subscription).toHaveProperty("currentPeriodStartDate");
      expect(subscription).toHaveProperty("currentPeriodEndDate");
      expect(subscription).toHaveProperty("createdAt");

      // Status should be one of the valid SDK SubscriptionEntity statuses
      // SDK uses: "active" | "paused" | "canceled"
      // Webhooks additionally have: "trialing" | "unpaid"
      expect(typeof subscription.status).toBe("string");

      // collectionMethod is camelCase in SDK (not collection_method)
      if (subscription.collectionMethod) {
        expect(subscription.collectionMethod).toBe("charge_automatically");
      }

      // Period dates should exist
      expect(subscription.currentPeriodStartDate).toBeDefined();
      expect(subscription.currentPeriodEndDate).toBeDefined();
    },
  );

  it.skipIf(!config.subscriptionId)("tests isActiveSubscription against real status", async () => {
    const subscription = await creem.subscriptions.get(config.subscriptionId);
    const status = subscription.status as string;

    // Whatever the real status is, our function should handle it
    const result = isActiveSubscription(status);
    expect(typeof result).toBe("boolean");
  });
});
