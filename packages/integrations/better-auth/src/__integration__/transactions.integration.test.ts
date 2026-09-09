import { describe, it, expect } from "vitest";
import { createTestCreemClient, getTestConfig, hasCredentials } from "./setup.js";

describe.skipIf(!hasCredentials())("Transactions integration", () => {
  const config = getTestConfig();
  const creem = createTestCreemClient();

  it.skipIf(!config.customerId)("searches transactions by customer ID", async () => {
    const result = await creem.transactions.search(config.customerId);

    expect(result).toBeDefined();
    // The response should have some shape - it may be an array or object
    expect(typeof result).toBe("object");
  });

  it.skipIf(!config.customerId)("verifies transaction list response shape", async () => {
    const result = await creem.transactions.search(config.customerId);

    expect(result).toBeDefined();
    // SDK TransactionListEntity should have items and pagination
    if (result.items) {
      expect(Array.isArray(result.items)).toBe(true);
      for (const tx of result.items) {
        expect(tx).toHaveProperty("id");
        expect(tx).toHaveProperty("amount");
        expect(tx).toHaveProperty("currency");
        expect(tx).toHaveProperty("status");
        expect(typeof tx.id).toBe("string");
      }
    }
    if (result.pagination) {
      expect(result.pagination).toHaveProperty("totalRecords");
      expect(result.pagination).toHaveProperty("totalPages");
      expect(result.pagination).toHaveProperty("currentPage");
    }
  });

  it.skipIf(!config.customerId)("tests pagination parameters", async () => {
    const result = await creem.transactions.search(config.customerId, undefined, undefined, 1, 5);

    expect(result).toBeDefined();
  });

  it.skipIf(!config.productId)("searches by product ID filter", async () => {
    const result = await creem.transactions.search(
      config.customerId || undefined,
      undefined,
      config.productId,
    );

    expect(result).toBeDefined();
  });
});
