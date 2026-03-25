import { describe, it, expect } from "vitest";
import { creem, hasCredentials, ONETIME_PRODUCT_ID } from "./setup";

describe.skipIf(!hasCredentials())("discounts (integration)", () => {
  it("creates, gets, and deletes a discount", async () => {
    const code = `T${Date.now().toString(36).slice(-8)}`.toUpperCase().slice(0, 14);

    // Create
    const created = await creem.discounts.create({
      name: "Integration Test Discount",
      code,
      type: "percentage",
      percentage: 10,
      duration: "once",
      appliesToProducts: [ONETIME_PRODUCT_ID],
    });

    expect(created).toHaveProperty("id");
    expect(created.name).toBe("Integration Test Discount");
    expect(created.code).toBe(code);

    // Get by ID
    const fetched = await creem.discounts.get({ discountId: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.code).toBe(code);

    // Delete
    await creem.discounts.delete({ discountId: created.id });
  });
});
