import { describe, expect, it } from "vitest";
import { ProductEntity$inboundSchema } from "../../src/models/components/productentity.js";

describe("ProductEntity response schema", () => {
  it("accepts scalar recurring interval fields returned by the API", () => {
    const product = ProductEntity$inboundSchema.parse({
      id: "prod_test",
      mode: "test",
      object: "product",
      name: "Monthly subscription",
      description: "A recurring product",
      price: 1000,
      currency: "EUR",
      billing_type: "recurring",
      billing_period: "every-month",
      recurring_interval: "month",
      recurring_interval_count: 1,
      status: "active",
      tax_mode: "inclusive",
      tax_category: "saas",
      created_at: "2026-09-05T09:33:00.965Z",
      updated_at: "2026-09-05T09:33:00.965Z",
    });

    expect(product.recurringInterval).toBe("month");
    expect(product.recurringIntervalCount).toBe(1);
  });
});
