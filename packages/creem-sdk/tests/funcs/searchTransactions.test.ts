import { Creem } from "../../src/index.js";
import { describe, it, expect } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem } from "../fixtures/testData.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("searchTransactions", () => {
  it("should handle API authentication errors", async () => {
    try {
      await creemWithInvalidKey.transactions.search();
      fail("Expected an API error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should search transactions with no filters successfully", async () => {
    const result = await creem.transactions.search();

    // Test the response structure
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.pagination).toHaveProperty("totalRecords");
    expect(result.pagination).toHaveProperty("totalPages");
    expect(result.pagination).toHaveProperty("currentPage");
    expect(result.pagination).toHaveProperty("nextPage");
    expect(result.pagination).toHaveProperty("prevPage");

    // If there are any items, verify they have the correct mode
    if (result.items.length > 0) {
      expect(result.items[0]).toHaveProperty("mode", TEST_MODE);
    }
  });

  it("should handle pagination correctly", async () => {
    const pageSize = 10;
    const pageNumber = 1;

    // search(customerId, orderId, productId, pageNumber, pageSize)
    const result = await creem.transactions.search(undefined, undefined, undefined, pageNumber, pageSize);

    // Test pagination structure
    expect(result.pagination).toHaveProperty("totalRecords");
    expect(result.pagination).toHaveProperty("totalPages");
    expect(result.pagination).toHaveProperty("currentPage", pageNumber);
    expect(result.pagination).toHaveProperty("nextPage");
    expect(result.pagination).toHaveProperty("prevPage");

    // Verify the number of items returned matches the page size
    expect(result.items.length).toBeLessThanOrEqual(pageSize);
  });

  it("should handle network errors gracefully", async () => {
    // Create a new instance with an invalid server URL to simulate network error
    const creemWithInvalidServer = new Creem({
      apiKey: "test",
      serverIdx: TEST_SERVER_IDX,
      serverURL: "http://invalid-url",
    });

    try {
      await creemWithInvalidServer.transactions.search();
      fail("Expected network error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // Tests that require real transaction data are skipped
  // Transactions are created when checkouts are completed through actual payments
  it.skip("should search transactions by customer ID successfully", async () => {
    // This test requires a real customer ID with transactions
  });

  it.skip("should search transactions by order ID successfully", async () => {
    // This test requires a real order ID
  });

  it.skip("should search transactions by product ID successfully", async () => {
    // This test requires a product with transactions
  });
});
