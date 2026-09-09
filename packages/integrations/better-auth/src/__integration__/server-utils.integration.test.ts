import { describe, it, expect } from "vitest";
import { getTestConfig, hasCredentials } from "./setup.js";
import {
  createCheckout,
  createPortal,
  retrieveSubscription,
  searchTransactions,
} from "../creem-server.js";

const serverConfig = {
  apiKey: process.env.CREEM_TEST_API_KEY || "",
  testMode: true,
};

describe.skipIf(!hasCredentials())("Server utils integration", () => {
  const config = getTestConfig();

  it("createCheckout against real API", async () => {
    const result = await createCheckout(serverConfig, {
      productId: config.productId,
      customer: { email: "server-utils-test@example.com" },
      successUrl: "https://example.com/success",
    });

    expect(result.url).toBeDefined();
    expect(typeof result.url).toBe("string");
    expect(result.redirect).toBe(true);
  });

  it.skipIf(!config.customerId)("createPortal against real API", async () => {
    const result = await createPortal(serverConfig, config.customerId);

    expect(result.url).toBeDefined();
    expect(typeof result.url).toBe("string");
    expect(result.redirect).toBe(true);
  });

  it.skipIf(!config.subscriptionId)("retrieveSubscription against real API", async () => {
    const result = await retrieveSubscription(serverConfig, config.subscriptionId);

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it.skipIf(!config.customerId)("searchTransactions against real API", async () => {
    const result = await searchTransactions(serverConfig, {
      customerId: config.customerId,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
