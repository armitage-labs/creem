import { Creem } from "../../src/index.js";
import { describe, it, expect } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX } from "../fixtures/testValues.js";
import { creem } from "../fixtures/testData.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("retrieveSubscription", () => {
  // Note: These tests require a real subscription ID from an actual purchase.
  // Subscriptions are created when a recurring checkout is completed, not via API.
  // The authentication and error handling tests work without real data.

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.subscriptions.get("any-subscription-id");
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should handle request errors with invalid subscription ID", async () => {
    try {
      await creem.subscriptions.get("non-existent-subscription-id");
      fail("Expected error with invalid subscription ID but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle network errors gracefully", async () => {
    // Create a new instance with an invalid server URL to simulate network error
    const creemWithInvalidServer = new Creem({
      apiKey: "test",
      serverIdx: TEST_SERVER_IDX,
      serverURL: "http://invalid-url",
    });

    try {
      await creemWithInvalidServer.subscriptions.get("any-subscription-id");
      fail("Expected network error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // Skip test that requires real subscription data
  it.skip("should retrieve subscription successfully", async () => {
    // This test requires a real subscription ID from an actual purchase
    // To run this test, set TEST_SUBSCRIPTION_ID in testValues.ts to a valid subscription ID
  });
});
