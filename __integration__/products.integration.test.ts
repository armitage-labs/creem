import { describe, it, expect } from "vitest";
import { creem, hasCredentials, SUBSCRIPTION_PRODUCT_ID } from "./setup";

describe.skipIf(!hasCredentials())("products (integration)", () => {
  it("lists products with pagination shape", async () => {
    const result = await creem.products.list({ page: 1, limit: 5 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.pagination).toHaveProperty("totalRecords");
    expect(result.pagination).toHaveProperty("totalPages");
    expect(result.pagination).toHaveProperty("currentPage");
  });

  it("creates a one-time product", async () => {
    const product = await creem.products.create({
      name: `Integration Test ${Date.now()}`,
      description: "Created by integration test",
      price: 500,
      currency: "USD",
      billingType: "onetime",
    });

    expect(product).toHaveProperty("id");
    expect(product.name).toContain("Integration Test");
    expect(product.description).toBe("Created by integration test");
    expect(product.price).toBe(500);
    expect(product.currency).toBe("USD");
    expect(product.billingType).toBe("onetime");
  });

  it("creates a recurring product", async () => {
    const product = await creem.products.create({
      name: `Integration Recurring ${Date.now()}`,
      description: "Recurring product from integration test",
      price: 1000,
      currency: "USD",
      billingType: "recurring",
      billingPeriod: "every-month",
    });

    expect(product).toHaveProperty("id");
    expect(product.price).toBe(1000);
    expect(product.billingType).toBe("recurring");
    expect(product.billingPeriod).toBe("every-month");
  });

  it("creates and retrieves a product with customField", async () => {
    const created = await creem.products.create({
      name: `CustomField Test ${Date.now()}`,
      description: "Product with custom fields",
      price: 750,
      currency: "USD",
      billingType: "onetime",
      customField: [
        {
          type: "text",
          key: "company",
          label: "Company Name",
          optional: true,
        },
        {
          type: "checkbox",
          key: "terms",
          label: "Accept Terms",
          optional: false,
        },
      ],
    });

    expect(created).toHaveProperty("id");
    expect(created.name).toContain("CustomField Test");
    expect(created.price).toBe(750);

    // Retrieve the product — API does not return customField in the response
    const fetched = await creem.products.get({ productId: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(created.name);
    expect(fetched.price).toBe(750);
    expect(fetched.billingType).toBe("onetime");
  });

  it("creates a checkout with customFields and verifies they are accepted", async () => {
    // First create a product with customField
    const product = await creem.products.create({
      name: `CF Checkout ${Date.now()}`,
      description: "For customFields checkout test",
      price: 500,
      currency: "USD",
      billingType: "onetime",
      customField: [{ type: "text", key: "company", label: "Company", optional: true }],
    });

    // Create checkout passing customFields values
    const checkout = await creem.checkouts.create({
      productId: product.id,
      customFields: [{ type: "text", key: "company", label: "Company", optional: true }],
    });

    expect(checkout).toHaveProperty("id");
    expect(checkout).toHaveProperty("checkoutUrl");
    expect(checkout.checkoutUrl).toContain("http");
  });

  it("gets a product by ID", async () => {
    const product = await creem.products.get({ productId: SUBSCRIPTION_PRODUCT_ID });

    expect(product).toHaveProperty("id");
    expect(product.id).toBe(SUBSCRIPTION_PRODUCT_ID);
    expect(product).toHaveProperty("name");
    expect(product).toHaveProperty("price");
    expect(product).toHaveProperty("currency");
  });
});
