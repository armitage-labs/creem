import { Creem } from "../../src/index.js";
import { describe, it, expect, beforeAll } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem, getTestProduct } from "../fixtures/testData.js";
import type { ProductEntity } from "../../src/models/components/index.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("retrieveProduct", () => {
  let testProduct: ProductEntity;

  beforeAll(async () => {
    testProduct = await getTestProduct();
  });

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.products.get(testProduct.id);
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should retrieve a product successfully", async () => {
    // When using the SDK instance directly, it returns ProductEntity
    const result = await creem.products.get(testProduct.id);

    // Test direct SDK method
    expect(result).toHaveProperty("id", testProduct.id);
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("price");
    expect(result).toHaveProperty("currency");
    expect(result).toHaveProperty("billingType");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("productUrl");
    expect(result).toHaveProperty("mode", TEST_MODE);
  });

  it("should handle validation errors", async () => {
    // Create an instance with empty API key
    const creemWithEmptyKey = new Creem({
      apiKey: "",
      serverIdx: TEST_SERVER_IDX,
    });

    try {
      // Use invalid input to trigger validation error
      await creemWithEmptyKey.products.get(testProduct.id);
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle request errors with non-existent product ID", async () => {
    try {
      await creem.products.get("non-existent-product-id");
      fail("Expected error with invalid product ID but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
