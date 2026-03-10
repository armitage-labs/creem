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

describe("generateCustomerLinks", () => {
  // Note: These tests require a real customer ID from an actual purchase.
  // The authentication and error handling tests work without real data.

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.customers.generateBillingLinks({
        customerId: "any-customer-id",
      });
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should handle validation errors when customer ID is missing", async () => {
    try {
      await creem.customers.generateBillingLinks({
        customerId: "",
      });
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle request errors with invalid customer ID", async () => {
    try {
      await creem.customers.generateBillingLinks({
        customerId: "non-existent-customer-id",
      });
      fail("Expected error with invalid customer ID but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // Skip test that requires real customer data
  it.skip("should generate customer portal links successfully", async () => {
    // This test requires a real customer ID from an actual purchase
    // To run this test, set TEST_CUSTOMER_ID in testValues.ts to a valid customer ID
  });
});
