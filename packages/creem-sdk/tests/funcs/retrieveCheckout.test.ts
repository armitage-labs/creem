import { Creem } from "../../src/index.js";
import { describe, it, expect, beforeAll } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem, getTestCheckout } from "../fixtures/testData.js";
import type { CheckoutEntity } from "../../src/models/components/index.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("retrieveCheckout", () => {
  let testCheckout: CheckoutEntity;

  beforeAll(async () => {
    testCheckout = await getTestCheckout();
  });

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.checkouts.retrieve(testCheckout.id);
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should retrieve a checkout session successfully", async () => {
    const result = await creem.checkouts.retrieve(testCheckout.id);

    // Test the response structure and content
    expect(result).toHaveProperty("id", testCheckout.id);
    expect(result).toHaveProperty("object", "checkout");
    expect(result).toHaveProperty("status");
    // Note: checkoutUrl may not be present on retrieved checkouts
    expect(result).toHaveProperty("mode", TEST_MODE);
  });

  it("should handle validation errors", async () => {
    // Create an instance with empty API key
    const creemWithEmptyKey = new Creem({
      apiKey: "",
      serverIdx: TEST_SERVER_IDX,
    });

    try {
      await creemWithEmptyKey.checkouts.retrieve(testCheckout.id);
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle request errors with invalid checkout ID", async () => {
    try {
      await creem.checkouts.retrieve("non-existent-checkout-id");
      fail("Expected error with invalid checkout ID but none was thrown");
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
      await creemWithInvalidServer.checkouts.retrieve(testCheckout.id);
      fail("Expected network error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
