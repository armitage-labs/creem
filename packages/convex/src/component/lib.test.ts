/// <reference types="vite/client" />
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import type { Infer } from "convex/values";
import schema from "./schema.js";
import { api } from "./_generated/api.js";
import { convertToDatabaseProduct } from "./util.js";
import type { ProductEntity } from "creem/models/components";

const modules = import.meta.glob("./**/*.ts");

// Types derived from schema validators
type DbSubscription = Infer<typeof schema.tables.subscriptions.validator>;
type DbProduct = Infer<typeof schema.tables.products.validator>;
type DbCustomer = Infer<typeof schema.tables.customers.validator>;

// Helper to create a minimal valid subscription for testing
function createTestSubscription(
  overrides: Partial<DbSubscription> = {},
): DbSubscription {
  return {
    id: "sub_123",
    customerId: "cust_456",
    productId: "prod_789",
    checkoutId: "checkout_abc",
    createdAt: "2025-01-15T10:00:00.000Z",
    modifiedAt: "2025-01-16T12:00:00.000Z",
    amount: 1000,
    currency: "usd",
    recurringInterval: "month",
    status: "active",
    currentPeriodStart: "2025-01-15T10:00:00.000Z",
    currentPeriodEnd: "2025-02-15T10:00:00.000Z",
    cancelAtPeriodEnd: false,
    startedAt: "2025-01-15T10:00:00.000Z",
    endedAt: null,
    metadata: {},
    ...overrides,
  };
}

// Helper to create a minimal valid product for testing
function createTestProduct(overrides: Partial<DbProduct> = {}): DbProduct {
  return {
    id: "prod_123",
    name: "Test Product",
    description: "A test product",
    price: 1000,
    currency: "USD",
    billingType: "recurring",
    billingPeriod: "every-month",
    status: "active",
    createdAt: "2025-01-10T08:00:00.000Z",
    modifiedAt: "2025-01-12T09:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

// Helper to create a minimal valid customer for testing
function createTestCustomer(overrides: Partial<DbCustomer> = {}): DbCustomer {
  return {
    id: "cust_123",
    entityId: "user_456",
    ...overrides,
  };
}

// Helper to create Creem SDK-shaped Product objects.
function createSdkProduct(
  overrides: Partial<ProductEntity> = {},
): ProductEntity {
  return {
    id: "prod_123",
    mode: "test_mode",
    object: "product",
    name: "Test Product",
    description: "A test product",
    price: 1000,
    currency: "USD",
    billingType: "recurring",
    billingPeriod: "every-month",
    status: "active",
    taxMode: "inclusive",
    taxCategory: "saas",
    createdAt: new Date("2025-01-10T08:00:00.000Z"),
    updatedAt: new Date("2025-01-12T09:00:00.000Z"),
    features: [],
    ...overrides,
  } as ProductEntity;
}

describe("createSubscription mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts when no existing record", async () => {
    const subscription = createTestSubscription();

    await t.mutation(api.lib.createSubscription, { subscription });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("sub_123");
    expect(result?.status).toBe("active");
  });

  it("patches when existing record has older modifiedAt", async () => {
    const oldSubscription = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: oldSubscription,
    });

    const newSubscription = createTestSubscription({
      modifiedAt: "2025-01-16T12:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: newSubscription,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("canceled");
    expect(result?.modifiedAt).toBe("2025-01-16T12:00:00.000Z");
  });

  it("skips when existing record has newer modifiedAt (stale webhook)", async () => {
    const newSubscription = createTestSubscription({
      modifiedAt: "2025-01-20T10:00:00.000Z",
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: newSubscription,
    });

    const staleSubscription = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: staleSubscription,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("active");
    expect(result?.modifiedAt).toBe("2025-01-20T10:00:00.000Z");
  });

  it("patches when modifiedAt values are equal", async () => {
    const subscription1 = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: subscription1,
    });

    const subscription2 = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: subscription2,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("canceled");
  });

  it("treats null modifiedAt as oldest", async () => {
    const subscription1 = createTestSubscription({
      modifiedAt: null,
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: subscription1,
    });

    const subscription2 = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: subscription2,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("canceled");
  });
});

describe("updateSubscription mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts when no existing record (upsert behavior)", async () => {
    const subscription = createTestSubscription();

    await t.mutation(api.lib.updateSubscription, { subscription });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("sub_123");
  });

  it("patches when existing record has older modifiedAt", async () => {
    const oldSubscription = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: oldSubscription,
    });

    const newSubscription = createTestSubscription({
      modifiedAt: "2025-01-16T12:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.updateSubscription, {
      subscription: newSubscription,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("canceled");
  });

  it("skips when existing record has newer modifiedAt (stale webhook)", async () => {
    const newSubscription = createTestSubscription({
      modifiedAt: "2025-01-20T10:00:00.000Z",
      status: "active",
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: newSubscription,
    });

    const staleSubscription = createTestSubscription({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      status: "canceled",
    });
    await t.mutation(api.lib.updateSubscription, {
      subscription: staleSubscription,
    });

    const result = await t.query(api.lib.getSubscription, { id: "sub_123" });
    expect(result?.status).toBe("active");
  });
});

describe("createProduct mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts when no existing record", async () => {
    const product = createTestProduct();

    await t.mutation(api.lib.createProduct, { product });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("prod_123");
    expect(result?.name).toBe("Test Product");
  });

  it("patches when existing record has older modifiedAt", async () => {
    const oldProduct = createTestProduct({
      modifiedAt: "2025-01-10T10:00:00.000Z",
      name: "Old Name",
    });
    await t.mutation(api.lib.createProduct, { product: oldProduct });

    const newProduct = createTestProduct({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      name: "New Name",
    });
    await t.mutation(api.lib.createProduct, { product: newProduct });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result?.name).toBe("New Name");
  });

  it("skips when existing record has newer modifiedAt (stale webhook)", async () => {
    const newProduct = createTestProduct({
      modifiedAt: "2025-01-20T10:00:00.000Z",
      name: "Current Name",
    });
    await t.mutation(api.lib.createProduct, { product: newProduct });

    const staleProduct = createTestProduct({
      modifiedAt: "2025-01-10T10:00:00.000Z",
      name: "Stale Name",
    });
    await t.mutation(api.lib.createProduct, { product: staleProduct });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result?.name).toBe("Current Name");
  });

  it("treats null modifiedAt as oldest", async () => {
    const product1 = createTestProduct({
      modifiedAt: null,
      name: "Original Name",
    });
    await t.mutation(api.lib.createProduct, { product: product1 });

    const product2 = createTestProduct({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      name: "Updated Name",
    });
    await t.mutation(api.lib.createProduct, { product: product2 });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result?.name).toBe("Updated Name");
  });
});

describe("updateProduct mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts when no existing record (upsert behavior)", async () => {
    const product = createTestProduct();

    await t.mutation(api.lib.updateProduct, { product });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("prod_123");
  });

  it("patches when existing record has older modifiedAt", async () => {
    const oldProduct = createTestProduct({
      modifiedAt: "2025-01-10T10:00:00.000Z",
      name: "Old Name",
    });
    await t.mutation(api.lib.createProduct, { product: oldProduct });

    const newProduct = createTestProduct({
      modifiedAt: "2025-01-15T10:00:00.000Z",
      name: "New Name",
    });
    await t.mutation(api.lib.updateProduct, { product: newProduct });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result?.name).toBe("New Name");
  });

  it("skips when existing record has newer modifiedAt (stale webhook)", async () => {
    const newProduct = createTestProduct({
      modifiedAt: "2025-01-20T10:00:00.000Z",
      name: "Current Name",
    });
    await t.mutation(api.lib.createProduct, { product: newProduct });

    const staleProduct = createTestProduct({
      modifiedAt: "2025-01-10T10:00:00.000Z",
      name: "Stale Name",
    });
    await t.mutation(api.lib.updateProduct, { product: staleProduct });

    const result = await t.query(api.lib.getProduct, { id: "prod_123" });
    expect(result?.name).toBe("Current Name");
  });
});

describe("product conversion (Creem SDK → DB)", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("converts recurring products with Creem-native fields", async () => {
    const sdkProduct = createSdkProduct({
      price: 1500,
      currency: "USD",
      billingType: "recurring",
      billingPeriod: "every-month",
    });

    const dbProduct = convertToDatabaseProduct(sdkProduct);
    await t.mutation(api.lib.createProduct, { product: dbProduct });
    const result = await t.query(api.lib.getProduct, { id: "prod_123" });

    expect(result?.price).toBe(1500);
    expect(result?.currency).toBe("USD");
    expect(result?.billingType).toBe("recurring");
    expect(result?.billingPeriod).toBe("every-month");
    expect(result?.status).toBe("active");
  });

  it("converts one-time products with Creem-native fields", async () => {
    const sdkProduct = createSdkProduct({
      billingType: "onetime",
      billingPeriod: "once",
      price: 4900,
    });

    const dbProduct = convertToDatabaseProduct(sdkProduct);
    await t.mutation(api.lib.createProduct, { product: dbProduct });
    const result = await t.query(api.lib.getProduct, { id: "prod_123" });

    expect(result?.price).toBe(4900);
    expect(result?.billingType).toBe("onetime");
  });

  it("converts Creem features", async () => {
    const sdkProduct = createSdkProduct({
      features: [
        {
          id: "feature_123",
          description: "Priority support",
          type: "custom",
        },
      ],
    });

    const dbProduct = convertToDatabaseProduct(sdkProduct);
    await t.mutation(api.lib.createProduct, { product: dbProduct });
    const result = await t.query(api.lib.getProduct, { id: "prod_123" });

    expect(result?.features).toHaveLength(1);
    expect(result?.features?.[0].id).toBe("feature_123");
    expect(result?.features?.[0].description).toBe("Priority support");
  });
});

describe("insertCustomer mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts new customer when none exists", async () => {
    const customer = createTestCustomer();

    const id = await t.mutation(api.lib.insertCustomer, customer);

    expect(id).toBeDefined();
    const result = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_456",
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("cust_123");
  });

  it("returns existing customer id when customer already exists for entityId", async () => {
    const customer = createTestCustomer();

    const id1 = await t.mutation(api.lib.insertCustomer, customer);

    const customer2 = createTestCustomer({
      id: "cust_different",
    });
    const id2 = await t.mutation(api.lib.insertCustomer, customer2);

    expect(id1).toBe(id2);

    const result = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_456",
    });
    expect(result?.id).toBe("cust_123");
  });

  it("allows different customers for different entityIds", async () => {
    const customer1 = createTestCustomer({
      id: "cust_123",
      entityId: "user_123",
    });
    const customer2 = createTestCustomer({
      id: "cust_456",
      entityId: "user_456",
    });

    await t.mutation(api.lib.insertCustomer, customer1);
    await t.mutation(api.lib.insertCustomer, customer2);

    const result1 = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_123",
    });
    const result2 = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_456",
    });

    expect(result1?.id).toBe("cust_123");
    expect(result2?.id).toBe("cust_456");
  });
});

describe("getCurrentSubscription query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns null when no customer exists", async () => {
    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_nonexistent",
    });

    expect(result).toBeNull();
  });

  it("returns null when customer has no subscriptions", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());

    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });

    expect(result).toBeNull();
  });

  it("returns null when customer only has ended subscriptions", async () => {
    const customer = createTestCustomer();
    await t.mutation(api.lib.insertCustomer, customer);
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: "2025-01-10T10:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });

    expect(result).toBeNull();
  });

  it("returns active subscription with product", async () => {
    const customer = createTestCustomer();
    await t.mutation(api.lib.insertCustomer, customer);
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
      }),
    });

    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("sub_123");
    expect(result?.product.id).toBe("prod_789");
    expect(result?.product.name).toBe("Test Product");
  });

  it("returns null when trial has expired", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2025-01-08T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });

    expect(result).toBeNull();
  });

  it("returns subscription when trial is still active", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2099-01-01T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe("trialing");
  });
});

describe("listUserSubscriptions query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns empty array when no customer exists", async () => {
    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_nonexistent",
    });

    expect(result).toEqual([]);
  });

  it("returns empty array when customer has no subscriptions", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toEqual([]);
  });

  it("excludes ended subscriptions", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_ended",
        customerId: "cust_123",
        endedAt: "2020-01-01T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(0);
  });

  it("returns active subscriptions with products", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
      }),
    });

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sub_123");
    expect(result[0].product?.id).toBe("prod_789");
  });

  it("excludes expired trials", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2025-01-08T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(0);
  });

  it("includes active trials", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2099-01-01T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("trialing");
  });

  it("returns multiple subscriptions", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_1" }),
    });
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_2" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        customerId: "cust_123",
        productId: "prod_1",
        endedAt: null,
      }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_2",
        customerId: "cust_123",
        productId: "prod_2",
        endedAt: null,
      }),
    });

    const result = await t.query(api.lib.listUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(2);
  });
});

describe("listProducts query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns empty array when no products exist", async () => {
    const result = await t.query(api.lib.listProducts, {});

    expect(result).toEqual([]);
  });

  it("returns only active products by default", async () => {
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_1", status: "active" }),
    });
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_2", status: "active" }),
    });
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_inactive", status: "inactive" }),
    });

    const result = await t.query(api.lib.listProducts, {});

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(["prod_1", "prod_2"]);
  });

  it("includes inactive products when includeArchived is true", async () => {
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_1", status: "active" }),
    });
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_inactive", status: "inactive" }),
    });

    const result = await t.query(api.lib.listProducts, {
      includeArchived: true,
    });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(["prod_1", "prod_inactive"]);
  });
});

describe("listCustomerSubscriptions query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns empty array when no subscriptions exist", async () => {
    const result = await t.query(api.lib.listCustomerSubscriptions, {
      customerId: "cust_nonexistent",
    });

    expect(result).toEqual([]);
  });

  it("returns all subscriptions for customer", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        customerId: "cust_123",
      }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_2",
        customerId: "cust_123",
      }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_other",
        customerId: "cust_other",
      }),
    });

    const result = await t.query(api.lib.listCustomerSubscriptions, {
      customerId: "cust_123",
    });

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual(["sub_1", "sub_2"]);
  });
});

describe("listAllUserSubscriptions query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns empty array when no customer exists", async () => {
    const result = await t.query(api.lib.listAllUserSubscriptions, {
      entityId: "user_nonexistent",
    });

    expect(result).toEqual([]);
  });

  it("includes ended subscriptions", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: "2020-01-01T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listAllUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(1);
    expect(result[0].endedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("includes expired trials", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2025-01-08T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listAllUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("trialing");
  });

  it("returns all subscriptions regardless of status", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_789" }),
    });
    // Active subscription
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_active",
        customerId: "cust_123",
        endedAt: null,
        status: "active",
      }),
    });
    // Ended subscription
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_ended",
        customerId: "cust_123",
        endedAt: "2020-01-01T00:00:00.000Z",
        status: "canceled",
      }),
    });
    // Expired trial
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_expired_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialStart: "2025-01-01T00:00:00.000Z",
        trialEnd: "2025-01-08T00:00:00.000Z",
      }),
    });

    const result = await t.query(api.lib.listAllUserSubscriptions, {
      entityId: "user_456",
    });

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id).sort()).toEqual([
      "sub_active",
      "sub_ended",
      "sub_expired_trial",
    ]);
  });
});

// Helper to create a minimal valid order for testing
type DbOrder = Infer<typeof schema.tables.orders.validator>;
function createTestOrder(overrides: Partial<DbOrder> = {}): DbOrder {
  return {
    id: "ord_123",
    customerId: "cust_123",
    productId: "prod_789",
    amount: 2999,
    currency: "USD",
    status: "paid",
    type: "onetime",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("createOrder mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts a new order", async () => {
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder(),
    });
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({ id: "ord_456", amount: 5000 }),
    });
    // Verify by inserting a customer + querying orders
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    const orders = await t.query(api.lib.listUserOrders, {
      entityId: "user_456",
    });
    expect(orders).toHaveLength(2);
  });

  it("updates existing order when incoming is newer", async () => {
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({ updatedAt: "2025-01-15T10:00:00.000Z" }),
    });
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        updatedAt: "2025-01-16T10:00:00.000Z",
        amount: 5000,
      }),
    });
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    const orders = await t.query(api.lib.listUserOrders, {
      entityId: "user_456",
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].amount).toBe(5000);
  });

  it("does not update when existing is newer", async () => {
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({ updatedAt: "2025-01-16T10:00:00.000Z" }),
    });
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        updatedAt: "2025-01-15T10:00:00.000Z",
        amount: 5000,
      }),
    });
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    const orders = await t.query(api.lib.listUserOrders, {
      entityId: "user_456",
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].amount).toBe(2999);
  });
});

describe("listUserOrders query", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns empty array when no customer exists", async () => {
    const orders = await t.query(api.lib.listUserOrders, {
      entityId: "user_nonexistent",
    });
    expect(orders).toEqual([]);
  });

  it("filters to only paid onetime orders", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    // Paid onetime — should be included
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        id: "ord_paid",
        status: "paid",
        type: "onetime",
      }),
    });
    // Pending onetime — should be excluded
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        id: "ord_pending",
        status: "pending",
        type: "onetime",
      }),
    });
    // Paid recurring — should be excluded
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        id: "ord_recurring",
        status: "paid",
        type: "recurring",
      }),
    });
    const orders = await t.query(api.lib.listUserOrders, {
      entityId: "user_456",
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("ord_paid");
  });
});

describe("updateProducts mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("inserts new products", async () => {
    await t.mutation(api.lib.updateProducts, {
      products: [
        createTestProduct({ id: "prod_a", name: "Product A" }),
        createTestProduct({ id: "prod_b", name: "Product B" }),
      ],
    });
    const products = await t.query(api.lib.listProducts, {});
    expect(products).toHaveLength(2);
  });

  it("patches existing products", async () => {
    await t.mutation(api.lib.createProduct, {
      product: createTestProduct({ id: "prod_a", name: "Old Name" }),
    });
    await t.mutation(api.lib.updateProducts, {
      products: [createTestProduct({ id: "prod_a", name: "New Name" })],
    });
    const products = await t.query(api.lib.listProducts, {});
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("New Name");
  });
});

describe("patchSubscription mutation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("throws when subscription not found", async () => {
    await expect(
      t.mutation(api.lib.patchSubscription, {
        subscriptionId: "sub_nonexistent",
      }),
    ).rejects.toThrow("Subscription not found");
  });

  it("patches seats and sets optimistic metadata", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({ id: "sub_1", seats: 3 }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      seats: 5,
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    expect(sub).not.toBeNull();
    expect(sub!.seats).toBe(5);
    const meta = sub!.metadata as Record<string, unknown>;
    expect(meta._optimisticFields).toContain("seats");
    expect(meta._optimisticPendingAt).toBeDefined();
  });

  it("patches productId and sets optimistic metadata", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({ id: "sub_1" }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      productId: "prod_new",
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    expect(sub!.productId).toBe("prod_new");
    const meta = sub!.metadata as Record<string, unknown>;
    expect(meta._optimisticFields).toContain("productId");
  });

  it("clears optimistic metadata with clearOptimistic flag", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({ id: "sub_1" }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      seats: 10,
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      clearOptimistic: true,
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    const meta = sub!.metadata as Record<string, unknown>;
    expect(meta._optimisticPendingAt).toBeUndefined();
    expect(meta._optimisticFields).toBeUndefined();
  });

  it("patches status and cancelAtPeriodEnd", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({ id: "sub_1" }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      status: "scheduled_cancel",
      cancelAtPeriodEnd: true,
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    expect(sub!.status).toBe("scheduled_cancel");
    expect(sub!.cancelAtPeriodEnd).toBe(true);
  });

  it("merges optimistic fields from consecutive patches", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({ id: "sub_1", seats: 3 }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      seats: 5,
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      productId: "prod_new",
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    const meta = sub!.metadata as Record<string, unknown>;
    const fields = meta._optimisticFields as string[];
    expect(fields).toContain("seats");
    expect(fields).toContain("productId");
  });
});

describe("updateSubscription optimistic guard", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("preserves optimistic seats when webhook sends stale value", async () => {
    // Insert subscription with seats=3
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        seats: 3,
        modifiedAt: "2025-01-16T12:00:00.000Z",
      }),
    });
    // Optimistic patch: seats → 5
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      seats: 5,
    });
    // Webhook arrives with seats=3 (stale intermediate) but newer modifiedAt
    await t.mutation(api.lib.updateSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        seats: 3,
        modifiedAt: "2025-01-17T12:00:00.000Z",
      }),
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    // Guard should preserve optimistic seats=5
    expect(sub!.seats).toBe(5);
  });

  it("clears guard when webhook confirms optimistic value", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        seats: 3,
        modifiedAt: "2025-01-16T12:00:00.000Z",
      }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      seats: 5,
    });
    // Webhook arrives confirming seats=5
    await t.mutation(api.lib.updateSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        seats: 5,
        modifiedAt: "2025-01-17T12:00:00.000Z",
      }),
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    expect(sub!.seats).toBe(5);
    const meta = sub!.metadata as Record<string, unknown>;
    expect(meta._optimisticPendingAt).toBeUndefined();
    expect(meta._optimisticFields).toBeUndefined();
  });

  it("preserves optimistic productId when webhook sends stale value", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        productId: "prod_old",
        modifiedAt: "2025-01-16T12:00:00.000Z",
      }),
    });
    await t.mutation(api.lib.patchSubscription, {
      subscriptionId: "sub_1",
      productId: "prod_new",
    });
    // Webhook with stale productId
    await t.mutation(api.lib.updateSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        productId: "prod_old",
        modifiedAt: "2025-01-17T12:00:00.000Z",
      }),
    });
    const sub = await t.query(api.lib.getSubscription, { id: "sub_1" });
    expect(sub!.productId).toBe("prod_new");
  });
});

describe("insertCustomer mutation enrichment", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("enriches existing customer with new email and name", async () => {
    await t.mutation(
      api.lib.insertCustomer,
      createTestCustomer({
        id: "cust_1",
        entityId: "user_1",
      }),
    );
    // Insert again with additional fields
    await t.mutation(
      api.lib.insertCustomer,
      createTestCustomer({
        id: "cust_1",
        entityId: "user_1",
        email: "test@example.com",
        name: "Test User",
        country: "US",
        mode: "live",
        updatedAt: "2025-02-01T00:00:00.000Z",
      }),
    );
    const customer = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_1",
    });
    expect(customer).not.toBeNull();
    expect(customer!.email).toBe("test@example.com");
    expect(customer!.name).toBe("Test User");
    expect(customer!.country).toBe("US");
  });
});

describe("getCurrentSubscription query edge cases", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("throws when product is missing for subscription", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_no_product",
        customerId: "cust_123",
        productId: "prod_nonexistent",
        endedAt: null,
        status: "active",
      }),
    });
    await expect(
      t.query(api.lib.getCurrentSubscription, { entityId: "user_456" }),
    ).rejects.toThrow("Product not found");
  });
});
