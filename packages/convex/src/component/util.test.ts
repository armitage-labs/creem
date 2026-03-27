import { describe, expect, it } from "vitest";
import {
  convertToDatabaseSubscription,
  convertToOrder,
  convertToDatabaseProduct,
} from "./util.js";

describe("convertToDatabaseSubscription", () => {
  const baseSubscription = {
    id: "sub_1",
    customer: "cus_1",
    product: "prod_1",
    status: "active" as const,
    items: [{ productId: "prod_1", priceId: "price_1", units: 1 }],
    currentPeriodStartDate: "2026-01-01T00:00:00.000Z",
    currentPeriodEndDate: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    canceledAt: null,
    lastTransactionId: "txn_1",
    nextTransactionDate: "2026-02-01T00:00:00.000Z",
    mode: "live",
    discount: null,
  };

  it("converts an active subscription", () => {
    const result = convertToDatabaseSubscription(baseSubscription as any);
    expect(result.id).toBe("sub_1");
    expect(result.customerId).toBe("cus_1");
    expect(result.productId).toBe("prod_1");
    expect(result.status).toBe("active");
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.endedAt).toBeNull();
    expect(result.trialStart).toBeNull();
    expect(result.trialEnd).toBeNull();
    expect(result.seats).toBe(1);
  });

  it("converts a trialing subscription with trial dates", () => {
    const sub = {
      ...baseSubscription,
      status: "trialing" as const,
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.trialStart).toBe("2026-01-01T00:00:00.000Z");
    expect(result.trialEnd).toBe("2026-02-01T00:00:00.000Z");
  });

  it("converts a scheduled_cancel subscription with cancelAtPeriodEnd", () => {
    const sub = {
      ...baseSubscription,
      status: "scheduled_cancel" as const,
      canceledAt: "2026-01-20T00:00:00.000Z",
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.endsAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.canceledAt).toBe("2026-01-20T00:00:00.000Z");
  });

  it("converts a canceled subscription with endedAt", () => {
    const sub = {
      ...baseSubscription,
      status: "canceled" as const,
      canceledAt: "2026-01-20T00:00:00.000Z",
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.endedAt).toBe("2026-01-20T00:00:00.000Z");
    expect(result.endsAt).toBeNull();
  });

  it("throws ConvexError when customer id is missing", () => {
    const sub = { ...baseSubscription, customer: null };
    expect(() => convertToDatabaseSubscription(sub as any)).toThrow(
      "Creem subscription is missing customer id",
    );
  });

  it("throws ConvexError when product id is missing", () => {
    const sub = { ...baseSubscription, product: null, items: [] };
    expect(() => convertToDatabaseSubscription(sub as any)).toThrow(
      "Creem subscription is missing product id",
    );
  });

  it("extracts product id from items when product entity id is null", () => {
    const sub = {
      ...baseSubscription,
      product: null as any,
      customer: "cus_1",
      items: [{ productId: "prod_from_items", priceId: "p1", units: 2 }],
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.productId).toBe("prod_from_items");
  });

  it("passes rawMetadata option through", () => {
    const meta = { convexUserId: "user_123" };
    const result = convertToDatabaseSubscription(baseSubscription as any, {
      rawMetadata: meta,
    });
    expect(result.metadata).toEqual(meta);
  });

  it("handles customer as object with id", () => {
    const sub = {
      ...baseSubscription,
      customer: { id: "cus_obj" },
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.customerId).toBe("cus_obj");
  });

  it("handles product as object with id and extracts price/currency", () => {
    const sub = {
      ...baseSubscription,
      product: {
        id: "prod_obj",
        price: 1999,
        currency: "USD",
        billingPeriod: "every-month",
      },
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.productId).toBe("prod_obj");
    expect(result.amount).toBe(1999);
    expect(result.currency).toBe("USD");
    expect(result.recurringInterval).toBe("every-month");
  });

  it("uses discount id when discount is an object", () => {
    const sub = {
      ...baseSubscription,
      discount: { id: "disc_1" },
    };
    const result = convertToDatabaseSubscription(sub as any);
    expect(result.discountId).toBe("disc_1");
  });
});

describe("convertToOrder", () => {
  const baseOrder = {
    id: "ord_1",
    customer: "cus_1",
    product: "prod_1",
    amount: 2999,
    currency: "USD",
    status: "completed",
    type: "one_time",
    transaction: "txn_1",
  };

  it("converts a basic order with camelCase fields", () => {
    const order = {
      ...baseOrder,
      subTotal: 2500,
      taxAmount: 499,
      discountAmount: 0,
      amountDue: 2999,
      amountPaid: 2999,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = convertToOrder(order);
    expect(result.id).toBe("ord_1");
    expect(result.customerId).toBe("cus_1");
    expect(result.productId).toBe("prod_1");
    expect(result.subTotal).toBe(2500);
    expect(result.taxAmount).toBe(499);
    expect(result.transactionId).toBe("txn_1");
  });

  it("falls back to snake_case fields when camelCase is undefined", () => {
    const order = {
      ...baseOrder,
      sub_total: 2500,
      tax_amount: 499,
      discount_amount: 0,
      amount_due: 2999,
      amount_paid: 2999,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const result = convertToOrder(order);
    expect(result.subTotal).toBe(2500);
    expect(result.taxAmount).toBe(499);
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("includes checkoutId and metadata from options", () => {
    const result = convertToOrder(baseOrder, {
      checkoutId: "chk_1",
      metadata: { source: "test" },
    });
    expect(result.checkoutId).toBe("chk_1");
    expect(result.metadata).toEqual({ source: "test" });
  });

  it("defaults customerId to empty string when customer is null", () => {
    const order = { ...baseOrder, customer: null };
    const result = convertToOrder(order);
    expect(result.customerId).toBe("");
  });

  it("handles optional fields as null/undefined", () => {
    const result = convertToOrder(baseOrder);
    expect(result.discountId).toBeNull();
    expect(result.affiliate).toBeNull();
    expect(result.checkoutId).toBeNull();
  });
});

describe("convertToDatabaseProduct", () => {
  const baseProduct = {
    id: "prod_1",
    name: "Pro Plan",
    description: "Full access",
    price: 1999,
    currency: "USD",
    billingType: "recurring",
    billingPeriod: "every-month",
    status: "active",
    taxMode: "inclusive",
    taxCategory: "saas",
    defaultSuccessUrl: "https://example.com/success",
    mode: "live",
    features: [
      { id: "feat_1", description: "Unlimited access" },
      { id: "feat_2", description: "Priority support" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };

  it("converts a full product entity", () => {
    const result = convertToDatabaseProduct(baseProduct as any);
    expect(result.id).toBe("prod_1");
    expect(result.name).toBe("Pro Plan");
    expect(result.price).toBe(1999);
    expect(result.currency).toBe("USD");
    expect(result.billingType).toBe("recurring");
    expect(result.billingPeriod).toBe("every-month");
    expect(result.status).toBe("active");
    expect(result.features).toHaveLength(2);
    expect(result.features?.[0]?.description).toBe("Unlimited access");
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.modifiedAt).toBe("2026-01-15T00:00:00.000Z");
  });

  it("handles missing optional fields", () => {
    const product = {
      id: "prod_2",
      name: "Basic",
      price: 0,
      currency: "EUR",
      billingType: "onetime",
      status: "active",
      mode: "test",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const result = convertToDatabaseProduct(product as any);
    expect(result.id).toBe("prod_2");
    expect(result.description).toBeUndefined();
    expect(result.billingPeriod).toBeUndefined();
    expect(result.features).toBeUndefined();
    expect(result.modifiedAt).toBeNull();
  });

  it("extracts imageUrl and productUrl via cast", () => {
    const product = {
      ...baseProduct,
      imageUrl: "https://img.example.com/pro.png",
      productUrl: "https://example.com/pro",
    };
    const result = convertToDatabaseProduct(product as any);
    expect(result.imageUrl).toBe("https://img.example.com/pro.png");
    expect(result.productUrl).toBe("https://example.com/pro");
  });
});
