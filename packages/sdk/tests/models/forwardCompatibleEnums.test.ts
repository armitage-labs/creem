import { describe, expect, it } from "vitest";
import { ProductEntity$inboundSchema } from "../../src/models/components/productentity.js";

// ENG-2487: response enums are open, so a value the API adds later reaches
// callers as a string instead of failing the whole response.
const product = {
  id: "prod_test",
  mode: "test",
  object: "product",
  name: "Monthly subscription",
  description: "A recurring product",
  price: 1000,
  currency: "EUR",
  billing_type: "recurring",
  billing_period: "every-month",
  status: "active",
  tax_mode: "inclusive",
  tax_category: "saas",
  created_at: "2026-09-05T09:33:00.965Z",
  updated_at: "2026-09-05T09:33:00.965Z",
};

describe("forward-compatible response enums", () => {
  it("keeps a status value the SDK doesn't know yet", () => {
    const parsed = ProductEntity$inboundSchema.parse({ ...product, status: "paused_by_review" });

    expect(parsed.status).toBe("paused_by_review");
  });

  it("still returns the known values as before", () => {
    expect(ProductEntity$inboundSchema.parse(product).status).toBe("active");
  });
});
