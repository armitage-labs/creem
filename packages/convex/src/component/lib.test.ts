/// <reference types="vite/client" />
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import type { Infer } from "convex/values";
import schema from "./schema.js";
import { api } from "./_generated/api.js";
import { convertToDatabaseProduct } from "./util.js";
import { STALE_APPLYING_MS } from "./lib.js";
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
      updatedAt: "2025-02-01T00:00:00.000Z",
    });
    const id2 = await t.mutation(api.lib.insertCustomer, customer2);

    expect(id1).toBe(id2);

    // The entity keeps one row, but the Creem customer ID is re-pointed:
    // subscriptions and orders are keyed by it, so a stale ID would make every
    // lookup for this entity miss after a mode switch or customer re-creation.
    const result = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_456",
    });
    expect(result?.id).toBe("cust_different");
  });

  it("does not re-point the mapping backwards for a delayed webhook", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(
      api.lib.insertCustomer,
      createTestCustomer({
        id: "cust_new",
        updatedAt: "2025-02-01T00:00:00.000Z",
      }),
    );

    // A retry for the OLD customer arrives after the re-point. Applying it
    // would hide every subscription and order belonging to the new customer.
    await t.mutation(
      api.lib.insertCustomer,
      createTestCustomer({
        id: "cust_123",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
    );

    const result = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_456",
    });
    expect(result?.id).toBe("cust_new");
  });

  it("does not flip back after a stale event lowers the watermark", async () => {
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_old",
      entityId: "user_1",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_new",
      entityId: "user_1",
      updatedAt: "2025-02-01T00:00:00.000Z",
    });

    // A delayed event for the OLD customer is correctly refused...
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_old",
      entityId: "user_1",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    // ...and must not have lowered the watermark, or this later event — still
    // older than the re-point — would satisfy the guard and flip the mapping
    // back to the replaced customer, hiding every subscription and order.
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_old",
      entityId: "user_1",
      updatedAt: "2025-01-15T00:00:00.000Z",
    });

    const result = await t.query(api.lib.getCustomerByEntityId, {
      entityId: "user_1",
    });
    expect(result?.id).toBe("cust_new");
    expect(result?.updatedAt).toBe("2025-02-01T00:00:00.000Z");
  });

  it("leaves the mapping alone when there is no ordering information", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    // No `updatedAt` on either side: without an ordering we cannot tell a
    // re-point from a stale replay, so the safe move is to keep the mapping.
    await t.mutation(
      api.lib.insertCustomer,
      createTestCustomer({ id: "cust_unknown_order" }),
    );

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
    expect(result?.product?.id).toBe("prod_789");
    expect(result?.product?.name).toBe("Test Product");
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

  it("filters to only onetime orders and keeps payment statuses", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createOrder, {
      order: createTestOrder({
        id: "ord_paid",
        status: "paid",
        type: "onetime",
      }),
    });
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
    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.id).sort()).toEqual([
      "ord_paid",
      "ord_pending",
    ]);
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

describe("scheduled subscription update mutations", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("reclaims a scheduled update abandoned mid-flight", async () => {
    const id = await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });

    // First run claims it, then dies before finishing (deploy, timeout, OOM).
    expect(
      await t.mutation(api.lib.markScheduledSubscriptionUpdateApplying, {
        scheduledUpdateId: id,
      }),
    ).toBe(true);

    // A second run must not steal it while the first may still be alive.
    expect(
      await t.mutation(api.lib.markScheduledSubscriptionUpdateApplying, {
        scheduledUpdateId: id,
      }),
    ).toBe(false);

    // Once the claim goes stale it becomes recoverable — otherwise the
    // downgrade never happens and the customer keeps paying the old price.
    await t.run(async (ctx) => {
      const doc = await ctx.db.get(id);
      await ctx.db.patch(id, {
        updatedAt: new Date(
          Date.now() - (STALE_APPLYING_MS + 60_000),
        ).toISOString(),
      });
      expect(doc?.status).toBe("applying");
    });

    expect(
      await t.mutation(api.lib.markScheduledSubscriptionUpdateApplying, {
        scheduledUpdateId: id,
      }),
    ).toBe(true);
  });

  it("does not reclaim an update that already finished", async () => {
    const id = await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });
    await t.mutation(api.lib.markScheduledSubscriptionUpdateApplied, {
      scheduledUpdateId: id,
    });

    expect(
      await t.mutation(api.lib.markScheduledSubscriptionUpdateApplying, {
        scheduledUpdateId: id,
      }),
    ).toBe(false);
  });

  it("creates and lists pending scheduled updates", async () => {
    const id = await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });

    const update = await t.query(api.lib.getScheduledSubscriptionUpdate, {
      scheduledUpdateId: id,
    });
    expect(update).toMatchObject({
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
      status: "pending",
    });

    const pending = await t.query(
      api.lib.listPendingScheduledSubscriptionUpdates,
      {
        entityId: "user_456",
      },
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].subscriptionId).toBe("sub_1");
  });

  it("supersedes an existing pending update for the same subscription", async () => {
    await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });
    await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetUnits: 2,
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });

    const pending = await t.query(
      api.lib.listPendingScheduledSubscriptionUpdates,
      {
        entityId: "user_456",
      },
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].targetUnits).toBe(2);
  });

  it("cancels a pending scheduled update", async () => {
    await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetPlanId: "free",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });

    const canceled = await t.mutation(
      api.lib.cancelScheduledSubscriptionUpdate,
      {
        entityId: "user_456",
        subscriptionId: "sub_1",
      },
    );

    expect(canceled).toMatchObject({
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetPlanId: "free",
      status: "superseded",
    });

    const pending = await t.query(
      api.lib.listPendingScheduledSubscriptionUpdates,
      {
        entityId: "user_456",
      },
    );
    expect(pending).toHaveLength(0);
  });

  it("cancels all pending scheduled updates for a subscription", async () => {
    await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });
    await t.mutation(api.lib.createScheduledSubscriptionUpdate, {
      entityId: "user_456",
      subscriptionId: "sub_2",
      targetPlanId: "free",
      effectiveAt: "2026-03-01T00:00:00.000Z",
    });

    const canceled = await t.mutation(
      api.lib.cancelPendingScheduledSubscriptionUpdates,
      {
        entityId: "user_456",
        subscriptionId: "sub_1",
      },
    );

    expect(canceled).toHaveLength(1);
    expect(canceled[0]).toMatchObject({
      subscriptionId: "sub_1",
      targetProductId: "prod_basic",
      status: "superseded",
    });

    const pending = await t.query(
      api.lib.listPendingScheduledSubscriptionUpdates,
      {
        entityId: "user_456",
      },
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].subscriptionId).toBe("sub_2");
  });

  it("rejects scheduled updates without a target", async () => {
    await expect(
      t.mutation(api.lib.createScheduledSubscriptionUpdate, {
        entityId: "user_456",
        subscriptionId: "sub_1",
        effectiveAt: "2026-03-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(
      "Provide exactly one scheduled target: targetProductId, targetPlanId, or targetUnits",
    );
  });
});

describe("app plan activation history", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("records the first activation for an app-owned plan", async () => {
    const activation = await t.mutation(api.lib.recordAppPlanActivation, {
      entityId: "org_1",
      planId: "trial",
      activatedByUserId: "user_1",
      oncePerEntity: true,
    });

    expect(activation).toMatchObject({
      entityId: "org_1",
      planId: "trial",
      activationCount: 1,
      activatedByUserId: "user_1",
    });

    const stored = await t.query(api.lib.getAppPlanActivation, {
      entityId: "org_1",
      planId: "trial",
    });
    expect(stored?.firstActivatedAt).toBe(activation.firstActivatedAt);
  });

  it("rejects repeated activation when oncePerEntity is enabled", async () => {
    await t.mutation(api.lib.recordAppPlanActivation, {
      entityId: "org_1",
      planId: "trial",
      oncePerEntity: true,
    });

    await expect(
      t.mutation(api.lib.recordAppPlanActivation, {
        entityId: "org_1",
        planId: "trial",
        oncePerEntity: true,
      }),
    ).rejects.toThrow('Plan "trial" was already activated');
  });

  it("increments activation count when repeat activation is allowed", async () => {
    await t.mutation(api.lib.recordAppPlanActivation, {
      entityId: "org_1",
      planId: "open",
    });
    const activation = await t.mutation(api.lib.recordAppPlanActivation, {
      entityId: "org_1",
      planId: "open",
    });

    expect(activation.activationCount).toBe(2);

    const activations = await t.query(api.lib.listAppPlanActivations, {
      entityId: "org_1",
    });
    expect(activations).toHaveLength(1);
    expect(activations[0].activationCount).toBe(2);
  });

  it("stores a current app-owned plan assignment", async () => {
    const assignment = await t.mutation(api.lib.assignAppPlan, {
      entityId: "org_1",
      planId: "free",
      assignedByUserId: "user_1",
      source: "manual",
    });

    expect(assignment).toMatchObject({
      entityId: "org_1",
      planId: "free",
      status: "active",
      assignedByUserId: "user_1",
      source: "manual",
    });

    const assignments = await t.query(api.lib.listAppPlanAssignments, {
      entityId: "org_1",
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0].status).toBe("active");
  });

  it("replaces the previous active app-owned plan assignment", async () => {
    await t.mutation(api.lib.assignAppPlan, {
      entityId: "org_1",
      planId: "trial",
    });
    await t.mutation(api.lib.assignAppPlan, {
      entityId: "org_1",
      planId: "free",
    });

    const assignments = await t.query(api.lib.listAppPlanAssignments, {
      entityId: "org_1",
    });
    expect(assignments.filter((item) => item.status === "active")).toHaveLength(
      1,
    );
    expect(assignments.find((item) => item.planId === "trial")?.status).toBe(
      "ended",
    );
    expect(assignments.find((item) => item.planId === "free")?.status).toBe(
      "active",
    );
  });

  it("activates or cancels scheduled app-owned plan assignments", async () => {
    await t.mutation(api.lib.assignAppPlan, {
      entityId: "org_1",
      planId: "free",
      status: "scheduled",
      startsAt: "2026-03-01T00:00:00.000Z",
      subscriptionId: "sub_1",
    });

    const activated = await t.mutation(
      api.lib.activateScheduledAppPlanAssignment,
      {
        subscriptionId: "sub_1",
        planId: "free",
      },
    );
    expect(activated?.status).toBe("active");

    await t.mutation(api.lib.assignAppPlan, {
      entityId: "org_1",
      planId: "trial",
      status: "scheduled",
      startsAt: "2026-04-01T00:00:00.000Z",
      subscriptionId: "sub_2",
    });
    const canceled = await t.mutation(
      api.lib.cancelScheduledAppPlanAssignment,
      {
        subscriptionId: "sub_2",
        planId: "trial",
      },
    );
    expect(canceled?.status).toBe("ended");
  });
});

describe("subscription lifecycle compensation", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("restores subscription state and aborts an immediate app-plan assignment", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        status: "canceled",
      }),
    });
    const assignment = await t.mutation(api.lib.assignAppPlan, {
      entityId: "user_456",
      planId: "community",
      source: "paid_to_app_plan",
      subscriptionId: "sub_1",
    });

    await t.mutation(api.lib.compensateSubscriptionLifecycle, {
      subscriptionId: "sub_1",
      previousStatus: "active",
      previousCancelAtPeriodEnd: false,
      error: "Creem cancel failed",
      rollback: {
        abortAppPlanTransitions: [
          {
            planId: "community",
            assignmentCreatedAt: assignment.createdAt,
          },
        ],
      },
    });

    const subscription = await t.query(api.lib.getSubscription, {
      id: "sub_1",
    });
    const assignments = await t.query(api.lib.listAppPlanAssignments, {
      entityId: "user_456",
    });
    expect(subscription).toMatchObject({
      status: "active",
      cancelAtPeriodEnd: false,
    });
    expect(assignments[0]).toMatchObject({
      planId: "community",
      status: "ended",
    });
  });

  it("fails a scheduled replacement and ends its app-plan assignment", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        status: "scheduled_cancel",
        cancelAtPeriodEnd: true,
      }),
    });
    const scheduledUpdateId = await t.mutation(
      api.lib.createScheduledSubscriptionUpdate,
      {
        entityId: "user_456",
        subscriptionId: "sub_1",
        targetPlanId: "community",
        effectiveAt: "2026-08-30T12:00:00.000Z",
      },
    );
    const assignment = await t.mutation(api.lib.assignAppPlan, {
      entityId: "user_456",
      planId: "community",
      status: "scheduled",
      startsAt: "2026-08-30T12:00:00.000Z",
      source: "paid_to_app_plan",
      subscriptionId: "sub_1",
    });

    await t.mutation(api.lib.compensateSubscriptionLifecycle, {
      subscriptionId: "sub_1",
      previousStatus: "active",
      previousCancelAtPeriodEnd: false,
      error: "Creem cancel failed",
      rollback: {
        abortAppPlanTransitions: [
          {
            planId: "community",
            scheduledUpdateId,
            assignmentCreatedAt: assignment.createdAt,
          },
        ],
      },
    });

    const update = await t.query(api.lib.getScheduledSubscriptionUpdate, {
      scheduledUpdateId,
    });
    const assignments = await t.query(api.lib.listAppPlanAssignments, {
      entityId: "user_456",
    });
    expect(update).toMatchObject({
      status: "failed",
      error: "Creem cancel failed",
    });
    expect(assignments[0]?.status).toBe("ended");
  });

  it("restores a canceled scheduled transition when resume fails", async () => {
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_1",
        status: "active",
        cancelAtPeriodEnd: false,
      }),
    });
    const scheduledUpdateId = await t.mutation(
      api.lib.createScheduledSubscriptionUpdate,
      {
        entityId: "user_456",
        subscriptionId: "sub_1",
        targetPlanId: "community",
        effectiveAt: "2026-08-30T12:00:00.000Z",
      },
    );
    const assignment = await t.mutation(api.lib.assignAppPlan, {
      entityId: "user_456",
      planId: "community",
      status: "scheduled",
      startsAt: "2026-08-30T12:00:00.000Z",
      subscriptionId: "sub_1",
    });
    const canceledUpdate = await t.mutation(
      api.lib.cancelScheduledSubscriptionUpdate,
      {
        entityId: "user_456",
        subscriptionId: "sub_1",
      },
    );
    await t.mutation(api.lib.cancelScheduledAppPlanAssignment, {
      subscriptionId: "sub_1",
      planId: "community",
    });

    await t.mutation(api.lib.compensateSubscriptionLifecycle, {
      subscriptionId: "sub_1",
      previousStatus: "scheduled_cancel",
      previousCancelAtPeriodEnd: true,
      error: "Creem resume failed",
      rollback: {
        restoreAppPlanTransitions: [
          {
            planId: "community",
            scheduledUpdateCreatedAt: canceledUpdate?.createdAt,
            assignmentCreatedAt: assignment.createdAt,
          },
        ],
      },
    });

    const subscription = await t.query(api.lib.getSubscription, {
      id: "sub_1",
    });
    const update = await t.query(api.lib.getScheduledSubscriptionUpdate, {
      scheduledUpdateId,
    });
    const assignments = await t.query(api.lib.listAppPlanAssignments, {
      entityId: "user_456",
    });
    expect(subscription).toMatchObject({
      status: "scheduled_cancel",
      cancelAtPeriodEnd: true,
    });
    expect(update?.status).toBe("pending");
    expect(assignments[0]).toMatchObject({
      status: "scheduled",
      endsAt: null,
    });
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

  it("returns the subscription with a null product when the product is not synced", async () => {
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
    // Products only land via `syncProducts`, so an unsynced product must not
    // take down this query and everything composed on top of it.
    const result = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });
    expect(result?.id).toBe("sub_no_product");
    expect(result?.product).toBeNull();
  });
});

describe("trial expiry", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("closes out a trial that lapsed without converting", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialEnd: "2020-01-01T00:00:00.000Z",
      }),
    });

    await t.mutation(api.lib.expireTrialIfElapsed, {
      subscriptionId: "sub_trial",
    });

    const subscription = await t.query(api.lib.getSubscription, {
      id: "sub_trial",
    });
    expect(subscription?.endedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(
      await t.query(api.lib.getCurrentSubscription, { entityId: "user_456" }),
    ).toBeNull();
  });

  it("leaves a trial that has not lapsed yet untouched", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialEnd: "2999-01-01T00:00:00.000Z",
      }),
    });

    await t.mutation(api.lib.expireTrialIfElapsed, {
      subscriptionId: "sub_trial",
    });

    const subscription = await t.query(api.lib.getSubscription, {
      id: "sub_trial",
    });
    expect(subscription?.endedAt).toBeNull();
  });

  it("is a no-op once the trial converted to a paid subscription", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "active",
        trialEnd: "2020-01-01T00:00:00.000Z",
      }),
    });

    await t.mutation(api.lib.expireTrialIfElapsed, {
      subscriptionId: "sub_trial",
    });

    const subscription = await t.query(api.lib.getSubscription, {
      id: "sub_trial",
    });
    expect(subscription?.endedAt).toBeNull();
  });
});

describe("trial conversion after expiry sweep", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("reopens the subscription when Creem converts the trial to paid", async () => {
    await t.mutation(api.lib.insertCustomer, createTestCustomer());
    await t.mutation(api.lib.createSubscription, {
      subscription: createTestSubscription({
        id: "sub_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "trialing",
        trialEnd: "2020-01-01T00:00:00.000Z",
        modifiedAt: "2020-01-01T00:00:00.000Z",
      }),
    });
    await t.mutation(api.lib.expireTrialIfElapsed, {
      subscriptionId: "sub_trial",
    });
    expect(
      (await t.query(api.lib.getSubscription, { id: "sub_trial" }))?.endedAt,
    ).toBe("2020-01-01T00:00:00.000Z");

    // The conversion webhook arrives with status active and endedAt null; the
    // row must come back to life rather than stay closed by the sweep.
    await t.mutation(api.lib.updateSubscription, {
      subscription: createTestSubscription({
        id: "sub_trial",
        customerId: "cust_123",
        endedAt: null,
        status: "active",
        trialEnd: null,
        modifiedAt: "2020-01-02T00:00:00.000Z",
      }),
    });

    const current = await t.query(api.lib.getCurrentSubscription, {
      entityId: "user_456",
    });
    expect(current?.id).toBe("sub_trial");
    expect(current?.status).toBe("active");
    expect(current?.endedAt).toBeNull();
  });
});
