import { describe, it, expect } from "vitest";
import { creem, hasCredentials } from "./setup";

describe.skipIf(!hasCredentials())("transactions (integration)", () => {
  it("lists transactions with pagination shape", async () => {
    const result = await creem.transactions.list({ page: 1, limit: 5 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.pagination).toHaveProperty("totalRecords");
    expect(result.pagination).toHaveProperty("totalPages");
    expect(result.pagination).toHaveProperty("currentPage");
  });
});
