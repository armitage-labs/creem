import { describe, it, expect, vi } from "vitest";
import { productsResource } from "../resources/products";
import { checkoutsResource } from "../resources/checkouts";
import { customersResource } from "../resources/customers";
import { subscriptionsResource } from "../resources/subscriptions";
import { transactionsResource } from "../resources/transactions";
import { licensesResource } from "../resources/licenses";
import { discountsResource } from "../resources/discounts";
import { statsResource } from "../resources/stats";
import type { RequestFn } from "../types/core";

function createMockRequest() {
  return vi.fn().mockResolvedValue({}) as unknown as RequestFn;
}

// ── Products ──────────────────────────────────────────────────────

describe("products", () => {
  it("list calls GET /v1/products/search with pagination", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.list({ page: 2, limit: 10 });

    expect(req).toHaveBeenCalledWith("GET", "/v1/products/search", undefined, {
      page_number: 2,
      page_size: 10,
    });
  });

  it("list defaults to empty params", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.list();

    expect(req).toHaveBeenCalledWith("GET", "/v1/products/search", undefined, {
      page_number: undefined,
      page_size: undefined,
    });
  });

  it("get calls GET /v1/products with product_id", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.get({ productId: "prod_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/products", undefined, {
      product_id: "prod_123",
    });
  });

  it("get throws when productId is missing", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() => products.get({ productId: "" })).toThrow("Missing required parameter: productId");
  });

  it("get throws when productId is not a string", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() => products.get({ productId: 123 as any })).toThrow(
      "Parameter 'productId' must be a string",
    );
  });

  it("create calls POST /v1/products with mapped body", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.create({
      name: "Test",
      description: "Desc",
      price: 1000,
      currency: "USD",
      billingType: "onetime",
    });

    expect(req).toHaveBeenCalledWith(
      "POST",
      "/v1/products",
      expect.objectContaining({
        name: "Test",
        description: "Desc",
        price: 1000,
        currency: "USD",
        billing_type: "onetime",
      }),
    );
  });

  it("create throws when required fields are missing", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() =>
      products.create({
        name: "",
        description: "D",
        price: 10,
        currency: "USD",
        billingType: "onetime",
      }),
    ).toThrow("Missing required parameter: name");
  });

  it("create validates billingPeriod required when billingType is recurring", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() =>
      products.create({
        name: "Test",
        description: "D",
        price: 10,
        currency: "USD",
        billingType: "recurring",
      }),
    ).toThrow("billingPeriod");
  });

  it("list throws when page is not a number", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() => products.list({ page: "abc" as any })).toThrow(
      "Parameter 'page' must be a number",
    );
  });
});

// ── Checkouts ─────────────────────────────────────────────────────

describe("checkouts", () => {
  it("get calls GET /v1/checkouts with checkout_id", async () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    await checkouts.get({ checkoutId: "chk_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/checkouts", undefined, {
      checkout_id: "chk_123",
    });
  });

  it("get throws when checkoutId is missing", () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    expect(() => checkouts.get({ checkoutId: "" })).toThrow(
      "Missing required parameter: checkoutId",
    );
  });

  it("create calls POST /v1/checkouts with mapped body", async () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    await checkouts.create({ productId: "prod_123" });

    expect(req).toHaveBeenCalledWith(
      "POST",
      "/v1/checkouts",
      expect.objectContaining({
        product_id: "prod_123",
      }),
    );
  });

  it("create throws when productId is missing", () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    expect(() => checkouts.create({ productId: "" })).toThrow(
      "Missing required parameter: productId",
    );
  });

  it("create throws when productId is not a string", () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    expect(() => checkouts.create({ productId: 123 as any })).toThrow(
      "Parameter 'productId' must be a string",
    );
  });

  it("create passes customFields and customField as arrays in body", async () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    const customFields = [
      { type: "text" as const, key: "company", label: "Company", optional: false },
    ];
    const customField = [
      { type: "checkbox" as const, key: "terms", label: "Terms", optional: false },
    ];

    await checkouts.create({ productId: "prod_123", customFields, customField });

    expect(req).toHaveBeenCalledWith(
      "POST",
      "/v1/checkouts",
      expect.objectContaining({
        product_id: "prod_123",
        custom_fields: customFields,
        custom_field: customField,
      }),
    );
  });

  it("create throws when customFields is not an array", () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    expect(() => checkouts.create({ productId: "prod_123", customFields: "bad" as any })).toThrow(
      "Parameter 'customFields' must be an array",
    );
  });

  it("create throws when customField is not an array", () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    expect(() => checkouts.create({ productId: "prod_123", customField: "bad" as any })).toThrow(
      "Parameter 'customField' must be an array",
    );
  });

  it("create passes all optional params in body", async () => {
    const req = createMockRequest();
    const checkouts = checkoutsResource(req);
    await checkouts.create({
      productId: "prod_123",
      requestId: "req_1",
      units: 3,
      discountCode: "SAVE10",
      customer: { email: "a@b.com" },
      successUrl: "https://done.com",
      metadata: { key: "val" },
    });

    expect(req).toHaveBeenCalledWith("POST", "/v1/checkouts", {
      request_id: "req_1",
      product_id: "prod_123",
      units: 3,
      discount_code: "SAVE10",
      customer: { email: "a@b.com" },
      custom_fields: undefined,
      custom_field: undefined,
      success_url: "https://done.com",
      metadata: { key: "val" },
    });
  });
});

// ── Customers ─────────────────────────────────────────────────────

describe("customers", () => {
  it("list calls GET /v1/customers/list", async () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    await customers.list({ page: 1, limit: 20 });

    expect(req).toHaveBeenCalledWith("GET", "/v1/customers/list", undefined, {
      page_number: 1,
      page_size: 20,
    });
  });

  it("get calls GET /v1/customers with customer_id", async () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    await customers.get({ customerId: "cust_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/customers", undefined, {
      customer_id: "cust_123",
      email: undefined,
    });
  });

  it("get calls GET /v1/customers with email", async () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    await customers.get({ email: "test@test.com" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/customers", undefined, {
      customer_id: undefined,
      email: "test@test.com",
    });
  });

  it("get throws when neither customerId nor email is provided", () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    expect(() => customers.get({})).toThrow("Either 'customerId' or 'email' must be provided");
  });

  it("createPortal calls POST /v1/customers/billing", async () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    await customers.createPortal({ customerId: "cust_123" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/customers/billing", {
      customer_id: "cust_123",
    });
  });

  it("createPortal throws when customerId is missing", () => {
    const req = createMockRequest();
    const customers = customersResource(req);
    expect(() => customers.createPortal({ customerId: "" })).toThrow(
      "Missing required parameter: customerId",
    );
  });
});

// ── Subscriptions ─────────────────────────────────────────────────

describe("subscriptions", () => {
  it("get calls GET /v1/subscriptions", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.get({ subscriptionId: "sub_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/subscriptions", undefined, {
      subscription_id: "sub_123",
    });
  });

  it("get throws when subscriptionId is missing", () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    expect(() => subs.get({ subscriptionId: "" })).toThrow(
      "Missing required parameter: subscriptionId",
    );
  });

  it("cancel calls POST /v1/subscriptions/{id}/cancel", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.cancel({ subscriptionId: "sub_123", mode: "immediate" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/subscriptions/sub_123/cancel", {
      mode: "immediate",
    });
  });

  it("update calls POST /v1/subscriptions/{id} with snake_case items", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.update({
      subscriptionId: "sub_123",
      items: [{ productId: "prod_1", units: 2 }],
      updateBehavior: "proration-charge-immediately",
    });

    expect(req).toHaveBeenCalledWith("POST", "/v1/subscriptions/sub_123", {
      items: [{ id: undefined, product_id: "prod_1", price_id: undefined, units: 2 }],
      update_behavior: "proration-charge-immediately",
    });
  });

  it("upgrade calls POST /v1/subscriptions/{id}/upgrade", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.upgrade({ subscriptionId: "sub_123", productId: "prod_456" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/subscriptions/sub_123/upgrade", {
      product_id: "prod_456",
      update_behavior: undefined,
    });
  });

  it("upgrade throws when productId is missing", () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    expect(() => subs.upgrade({ subscriptionId: "sub_123", productId: "" })).toThrow(
      "Missing required parameter: productId",
    );
  });

  it("pause calls POST /v1/subscriptions/{id}/pause", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.pause({ subscriptionId: "sub_123" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/subscriptions/sub_123/pause");
  });

  it("resume calls POST /v1/subscriptions/{id}/resume", async () => {
    const req = createMockRequest();
    const subs = subscriptionsResource(req);
    await subs.resume({ subscriptionId: "sub_123" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/subscriptions/sub_123/resume");
  });
});

// ── Transactions ──────────────────────────────────────────────────

describe("transactions", () => {
  it("get calls GET /v1/transactions with transaction_id", async () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    await txns.get({ transactionId: "txn_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/transactions", undefined, {
      transaction_id: "txn_123",
    });
  });

  it("get throws when transactionId is missing", () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    expect(() => txns.get({ transactionId: "" })).toThrow(
      "Missing required parameter: transactionId",
    );
  });

  it("list calls GET /v1/transactions/search with filters", async () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    await txns.list({ customerId: "cust_1", page: 1, limit: 10 });

    expect(req).toHaveBeenCalledWith("GET", "/v1/transactions/search", undefined, {
      customer_id: "cust_1",
      order_id: undefined,
      product_id: undefined,
      page_number: 1,
      page_size: 10,
    });
  });

  it("list throws when productId is not a string", () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    expect(() => txns.list({ productId: 123 as any })).toThrow(
      "Parameter 'productId' must be a string",
    );
  });
});

// ── Licenses ──────────────────────────────────────────────────────

describe("licenses", () => {
  it("activate calls POST /v1/licenses/activate", async () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    await licenses.activate({ key: "LIC-123", instanceName: "my-machine" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/licenses/activate", {
      key: "LIC-123",
      instance_name: "my-machine",
    });
  });

  it("activate throws when key is missing", () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    expect(() => licenses.activate({ key: "", instanceName: "m" })).toThrow(
      "Missing required parameter: key",
    );
  });

  it("activate throws when instanceName is missing", () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    expect(() => licenses.activate({ key: "k", instanceName: "" })).toThrow(
      "Missing required parameter: instanceName",
    );
  });

  it("deactivate calls POST /v1/licenses/deactivate", async () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    await licenses.deactivate({ key: "LIC-123", instanceId: "inst_1" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/licenses/deactivate", {
      key: "LIC-123",
      instance_id: "inst_1",
    });
  });

  it("validate calls POST /v1/licenses/validate", async () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    await licenses.validate({ key: "LIC-123", instanceId: "inst_1" });

    expect(req).toHaveBeenCalledWith("POST", "/v1/licenses/validate", {
      key: "LIC-123",
      instance_id: "inst_1",
    });
  });

  it("validate throws when instanceId is missing", () => {
    const req = createMockRequest();
    const licenses = licensesResource(req);
    expect(() => licenses.validate({ key: "k", instanceId: "" })).toThrow(
      "Missing required parameter: instanceId",
    );
  });
});

// ── Discounts ─────────────────────────────────────────────────────

describe("discounts", () => {
  it("get calls GET /v1/discounts with discount_id", async () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    await discounts.get({ discountId: "disc_123" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/discounts", undefined, {
      discount_id: "disc_123",
      discount_code: undefined,
    });
  });

  it("get calls GET /v1/discounts with discount_code", async () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    await discounts.get({ discountCode: "SAVE10" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/discounts", undefined, {
      discount_id: undefined,
      discount_code: "SAVE10",
    });
  });

  it("get throws when neither discountId nor discountCode is provided", () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    expect(() => discounts.get({})).toThrow(
      "Either 'discountId' or 'discountCode' must be provided",
    );
  });

  it("create calls POST /v1/discounts with mapped body", async () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    await discounts.create({
      name: "Summer Sale",
      type: "percentage",
      percentage: 20,
      duration: "once",
      appliesToProducts: ["prod_1"],
    });

    expect(req).toHaveBeenCalledWith(
      "POST",
      "/v1/discounts",
      expect.objectContaining({
        name: "Summer Sale",
        type: "percentage",
        percentage: 20,
        duration: "once",
        applies_to_products: ["prod_1"],
      }),
    );
  });

  it("create throws when name is missing", () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    expect(() =>
      discounts.create({ name: "", type: "percentage", duration: "once", appliesToProducts: [] }),
    ).toThrow("Missing required parameter: name");
  });

  it("create throws when type is missing", () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    expect(() =>
      discounts.create({ name: "Test", type: "" as any, duration: "once", appliesToProducts: [] }),
    ).toThrow("Missing required parameter: type");
  });

  it("delete calls DELETE /v1/discounts/{id}/delete", async () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    await discounts.delete({ discountId: "disc_123" });

    expect(req).toHaveBeenCalledWith("DELETE", "/v1/discounts/disc_123/delete");
  });

  it("delete throws when discountId is missing", () => {
    const req = createMockRequest();
    const discounts = discountsResource(req);
    expect(() => discounts.delete({ discountId: "" })).toThrow(
      "Missing required parameter: discountId",
    );
  });
});

// ── Stats ────────────────────────────────────────────────────────

describe("stats", () => {
  it("getSummary calls GET /v1/stats/summary with currency", async () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    await stats.getSummary({ currency: "USD" });

    expect(req).toHaveBeenCalledWith("GET", "/v1/stats/summary", undefined, {
      currency: "USD",
      start_date: undefined,
      end_date: undefined,
      interval: undefined,
    });
  });

  it("getSummary passes all optional params", async () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    await stats.getSummary({
      currency: "EUR",
      startDate: 1700000000,
      endDate: 1700100000,
      interval: "month",
    });

    expect(req).toHaveBeenCalledWith("GET", "/v1/stats/summary", undefined, {
      currency: "EUR",
      start_date: 1700000000,
      end_date: 1700100000,
      interval: "month",
    });
  });

  it("getSummary throws when currency is missing", () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    expect(() => stats.getSummary({ currency: "" })).toThrow(
      "Missing required parameter: currency",
    );
  });

  it("getSummary throws when currency is not a string", () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    expect(() => stats.getSummary({ currency: 123 as any })).toThrow(
      "Parameter 'currency' must be a string",
    );
  });

  it("getSummary throws when startDate is not a number", () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    expect(() => stats.getSummary({ currency: "USD", startDate: "bad" as any })).toThrow(
      "Parameter 'startDate' must be a number",
    );
  });

  it("getSummary throws when endDate is not a number", () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    expect(() => stats.getSummary({ currency: "USD", endDate: "bad" as any })).toThrow(
      "Parameter 'endDate' must be a number",
    );
  });

  it("getSummary throws when interval is not a string", () => {
    const req = createMockRequest();
    const stats = statsResource(req);
    expect(() => stats.getSummary({ currency: "USD", interval: 123 as any })).toThrow(
      "Parameter 'interval' must be a string",
    );
  });
});

// ── Product Search ───────────────────────────────────────────────

describe("products.search", () => {
  it("search calls GET /v1/products/search with query and pagination", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.search({ query: "pro plan", page: 1, limit: 10 });

    expect(req).toHaveBeenCalledWith("GET", "/v1/products/search", undefined, {
      query: "pro plan",
      page_number: 1,
      page_size: 10,
    });
  });

  it("search defaults to empty params", async () => {
    const req = createMockRequest();
    const products = productsResource(req);
    await products.search();

    expect(req).toHaveBeenCalledWith("GET", "/v1/products/search", undefined, {
      query: undefined,
      page_number: undefined,
      page_size: undefined,
    });
  });

  it("search throws when query is not a string", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() => products.search({ query: 123 as any })).toThrow(
      "Parameter 'query' must be a string",
    );
  });

  it("search throws when page is not a number", () => {
    const req = createMockRequest();
    const products = productsResource(req);
    expect(() => products.search({ page: "abc" as any })).toThrow(
      "Parameter 'page' must be a number",
    );
  });
});

// ── Transaction Search ───────────────────────────────────────────

describe("transactions.search", () => {
  it("search calls GET /v1/transactions/search with query and filters", async () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    await txns.search({
      query: "invoice",
      customerId: "cust_1",
      orderId: "ord_1",
      productId: "prod_1",
      page: 2,
      limit: 25,
    });

    expect(req).toHaveBeenCalledWith("GET", "/v1/transactions/search", undefined, {
      query: "invoice",
      customer_id: "cust_1",
      order_id: "ord_1",
      product_id: "prod_1",
      page_number: 2,
      page_size: 25,
    });
  });

  it("search defaults to empty params", async () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    await txns.search();

    expect(req).toHaveBeenCalledWith("GET", "/v1/transactions/search", undefined, {
      query: undefined,
      customer_id: undefined,
      order_id: undefined,
      product_id: undefined,
      page_number: undefined,
      page_size: undefined,
    });
  });

  it("search throws when query is not a string", () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    expect(() => txns.search({ query: 123 as any })).toThrow("Parameter 'query' must be a string");
  });

  it("search throws when customerId is not a string", () => {
    const req = createMockRequest();
    const txns = transactionsResource(req);
    expect(() => txns.search({ customerId: 123 as any })).toThrow(
      "Parameter 'customerId' must be a string",
    );
  });
});
