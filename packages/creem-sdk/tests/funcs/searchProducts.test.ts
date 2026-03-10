import { Creem } from "../../src/index.js";
import { describe, it, expect, beforeAll } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem, getTestProduct } from "../fixtures/testData.js";
import { ProductBillingType } from "../../src/models/components/index.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("searchProducts", () => {
  // Ensure at least one product exists before search tests
  beforeAll(async () => {
    await getTestProduct();
  });

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.products.search();
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should search products successfully", async () => {
    // When using the SDK instance directly, it returns ProductEntity[]
    const result = await creem.products.search();

    // Test direct SDK method
    expect(result).toHaveProperty("items");
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items.length).toBeGreaterThan(0); // We created at least one product
    
    if (result.items.length > 0) {
      expect(result.items[0]).toHaveProperty("id");
      expect(result.items[0]).toHaveProperty("name");
      expect(result.items[0]).toHaveProperty("description");
      expect(result.items[0]).toHaveProperty("price");
      expect(result.items[0]).toHaveProperty("currency");
      expect(result.items[0]).toHaveProperty("billingType");
      // billingType should be one of ProductBillingType values
      expect([ProductBillingType.Recurring, ProductBillingType.Onetime]).toContain(
        result.items[0].billingType
      );
      expect(result.items[0]).toHaveProperty("status");
      expect(result.items[0]).toHaveProperty("productUrl");
      expect(result.items[0]).toHaveProperty("mode", TEST_MODE);
    }
  });

  it("should handle pagination parameters correctly", async () => {
    const pageSize = 2;
    // Note: search(pageNumber, pageSize) - pageNumber comes first
    const result = await creem.products.search(1, pageSize);

    expect(result.items.length).toBeLessThanOrEqual(pageSize);
    expect(result.pagination.currentPage).toBe(1);
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.pagination.totalRecords).toBeGreaterThanOrEqual(
      result.items.length
    );
  });

  it("should handle validation errors", async () => {
    // Create an instance with empty API key
    const creemWithEmptyKey = new Creem({
      apiKey: "",
      serverIdx: TEST_SERVER_IDX,
    });

    try {
      // Use invalid input to trigger validation error
      await creemWithEmptyKey.products.search();
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle invalid pagination parameters", async () => {
    try {
      await creem.products.search(-1); // Invalid page number
      fail("Expected error with invalid page number but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
