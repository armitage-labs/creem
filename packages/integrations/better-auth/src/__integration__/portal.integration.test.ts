import { describe, it, expect } from "vitest";
import { createTestCreemClient, getTestConfig, hasCredentials } from "./setup.js";

describe.skipIf(!hasCredentials())("Portal integration", () => {
  const config = getTestConfig();
  const creem = createTestCreemClient();

  it.skipIf(!config.customerId)("generates billing portal link for existing customer", async () => {
    const portal = await creem.customers.generateBillingLinks({
      customerId: config.customerId,
    });

    expect(portal.customerPortalLink).toBeDefined();
    expect(typeof portal.customerPortalLink).toBe("string");
    expect(portal.customerPortalLink).toMatch(/^https:\/\//);
  });
});
