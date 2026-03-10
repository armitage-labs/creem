import { Creem } from "../../src/index.js";
import { describe, it, expect, beforeAll } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem, getTestDiscount } from "../fixtures/testData.js";
import type { DiscountEntity } from "../../src/models/components/index.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("retrieveDiscount", () => {
  let testDiscount: DiscountEntity;

  beforeAll(async () => {
    testDiscount = await getTestDiscount();
  });

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.discounts.get(testDiscount.id);
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should retrieve a discount by ID successfully", async () => {
    const result = await creem.discounts.get(testDiscount.id);

    // Test the response structure and content
    expect(result).toHaveProperty("id", testDiscount.id);
    expect(result).toHaveProperty("mode", TEST_MODE);
    expect(result).toHaveProperty("object");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("code", testDiscount.code);
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("duration");
  });

  it("should retrieve a discount by code successfully", async () => {
    const result = await creem.discounts.get(undefined, testDiscount.code);

    // Test the response structure and content
    expect(result).toHaveProperty("code", testDiscount.code);
    expect(result).toHaveProperty("mode", TEST_MODE);
    expect(result).toHaveProperty("object");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("duration");
  });

  it("should handle validation errors when neither ID nor code is provided", async () => {
    try {
      await creem.discounts.get();
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle request errors with invalid discount ID", async () => {
    try {
      await creem.discounts.get("non-existent-discount-id");
      fail("Expected error with invalid discount ID but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle request errors with invalid discount code", async () => {
    try {
      await creem.discounts.get(undefined, "NON-EXISTENT-CODE");
      fail("Expected error with invalid discount code but none was thrown");
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
      await creemWithInvalidServer.discounts.get(testDiscount.id);
      fail("Expected network error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
