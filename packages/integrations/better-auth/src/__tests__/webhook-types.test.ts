import { describe, it, expect } from "vitest";
import {
  isWebhookEventEntity,
  isWebhookEntity,
  isCheckoutEntity,
  isCustomerEntity,
  isOrderEntity,
  isProductEntity,
  isSubscriptionEntity,
  isRefundEntity,
  isDisputeEntity,
  isTransactionEntity,
  isDiscountEntity,
} from "@creem_io/webhook-types";
import type { ProductEntity, DiscountEntity, DiscountStatus } from "@creem_io/webhook-types";
import {
  mockCustomer,
  mockProduct,
  mockOrder,
  mockSubscription,
  mockRefund,
  mockDispute,
  mockTransaction,
  mockCheckout,
  mockDiscount,
} from "./fixtures.js";

describe("isWebhookEntity", () => {
  it("returns true for valid entities", () => {
    expect(isWebhookEntity(mockCustomer)).toBe(true);
    expect(isWebhookEntity(mockProduct)).toBe(true);
    expect(isWebhookEntity(mockOrder)).toBe(true);
    expect(isWebhookEntity(mockSubscription)).toBe(true);
    expect(isWebhookEntity(mockRefund)).toBe(true);
    expect(isWebhookEntity(mockDispute)).toBe(true);
    expect(isWebhookEntity(mockTransaction)).toBe(true);
    expect(isWebhookEntity(mockCheckout)).toBe(true);
    expect(isWebhookEntity(mockDiscount)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isWebhookEntity(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isWebhookEntity("string")).toBe(false);
    expect(isWebhookEntity(123)).toBe(false);
    expect(isWebhookEntity(undefined)).toBe(false);
  });

  it("returns false for objects without object field", () => {
    expect(isWebhookEntity({ id: "test" })).toBe(false);
  });

  it("returns false for objects with unknown object type", () => {
    expect(isWebhookEntity({ object: "unknown_type" })).toBe(false);
  });
});

describe("isWebhookEventEntity", () => {
  it("returns true for valid webhook event", () => {
    const event = {
      eventType: "checkout.completed",
      id: "evt_1",
      created_at: 123456,
      object: mockCheckout,
    };
    expect(isWebhookEventEntity(event)).toBe(true);
  });

  it("returns false for missing eventType", () => {
    expect(isWebhookEventEntity({ id: "evt_1", created_at: 123, object: mockCheckout })).toBe(
      false,
    );
  });

  it("returns false for missing id", () => {
    expect(
      isWebhookEventEntity({
        eventType: "checkout.completed",
        created_at: 123,
        object: mockCheckout,
      }),
    ).toBe(false);
  });

  it("returns false for missing created_at", () => {
    expect(
      isWebhookEventEntity({
        eventType: "checkout.completed",
        id: "evt_1",
        object: mockCheckout,
      }),
    ).toBe(false);
  });

  it("returns false for invalid object", () => {
    expect(
      isWebhookEventEntity({
        eventType: "checkout.completed",
        id: "evt_1",
        created_at: 123,
        object: { invalid: true },
      }),
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isWebhookEventEntity(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isWebhookEventEntity(42)).toBe(false);
    expect(isWebhookEventEntity("string")).toBe(false);
  });
});

describe("individual type guards", () => {
  it("isCheckoutEntity", () => {
    expect(isCheckoutEntity(mockCheckout)).toBe(true);
    expect(isCheckoutEntity(mockCustomer)).toBe(false);
    expect(isCheckoutEntity(null)).toBe(false);
    expect(isCheckoutEntity("string")).toBe(false);
  });

  it("isCustomerEntity", () => {
    expect(isCustomerEntity(mockCustomer)).toBe(true);
    expect(isCustomerEntity(mockProduct)).toBe(false);
    expect(isCustomerEntity(null)).toBe(false);
  });

  it("isOrderEntity", () => {
    expect(isOrderEntity(mockOrder)).toBe(true);
    expect(isOrderEntity(mockCustomer)).toBe(false);
    expect(isOrderEntity(null)).toBe(false);
  });

  it("isProductEntity", () => {
    expect(isProductEntity(mockProduct)).toBe(true);
    expect(isProductEntity(mockCustomer)).toBe(false);
    expect(isProductEntity(null)).toBe(false);
  });

  it("isSubscriptionEntity", () => {
    expect(isSubscriptionEntity(mockSubscription)).toBe(true);
    expect(isSubscriptionEntity(mockCustomer)).toBe(false);
    expect(isSubscriptionEntity(null)).toBe(false);
  });

  it("isRefundEntity", () => {
    expect(isRefundEntity(mockRefund)).toBe(true);
    expect(isRefundEntity(mockCustomer)).toBe(false);
    expect(isRefundEntity(null)).toBe(false);
  });

  it("isDisputeEntity", () => {
    expect(isDisputeEntity(mockDispute)).toBe(true);
    expect(isDisputeEntity(mockCustomer)).toBe(false);
    expect(isDisputeEntity(null)).toBe(false);
  });

  it("isTransactionEntity", () => {
    expect(isTransactionEntity(mockTransaction)).toBe(true);
    expect(isTransactionEntity(mockCustomer)).toBe(false);
    expect(isTransactionEntity(null)).toBe(false);
  });

  it("isDiscountEntity", () => {
    expect(isDiscountEntity(mockDiscount)).toBe(true);
    expect(isDiscountEntity(mockCustomer)).toBe(false);
    expect(isDiscountEntity(null)).toBe(false);
    expect(isDiscountEntity("string")).toBe(false);
  });
});

describe("ProductEntity with custom_fields", () => {
  it("accepts a product with custom_fields", () => {
    const product: ProductEntity = {
      ...mockProduct,
      custom_fields: [
        {
          type: "text",
          key: "company_name",
          label: "Company Name",
          optional: false,
          text: { max_length: 100 },
        },
        {
          type: "checkbox",
          key: "agree_tos",
          label: "I agree to TOS",
          checkbox: { label: "Accept terms", value: true },
        },
      ],
    };
    expect(product.custom_fields).toHaveLength(2);
    expect(product.custom_fields![0].key).toBe("company_name");
  });

  it("accepts a product with null custom_fields", () => {
    const product: ProductEntity = {
      ...mockProduct,
      custom_fields: null,
    };
    expect(product.custom_fields).toBeNull();
  });

  it("accepts a product without custom_fields", () => {
    const product: ProductEntity = { ...mockProduct };
    expect(product.custom_fields).toBeUndefined();
  });
});

describe("DiscountEntity", () => {
  it("accepts all valid statuses", () => {
    const statuses: DiscountStatus[] = ["deleted", "active", "draft", "expired", "scheduled"];
    for (const status of statuses) {
      const discount: DiscountEntity = { ...mockDiscount, status };
      expect(discount.status).toBe(status);
    }
  });

  it("accepts a percentage discount", () => {
    const discount: DiscountEntity = {
      ...mockDiscount,
      type: "percentage",
      percentage: 25,
    };
    expect(discount.type).toBe("percentage");
    expect(discount.percentage).toBe(25);
  });

  it("accepts a fixed discount", () => {
    const discount: DiscountEntity = {
      ...mockDiscount,
      type: "fixed",
      amount: 500,
      currency: "USD",
    };
    expect(discount.type).toBe("fixed");
    expect(discount.amount).toBe(500);
  });

  it("accepts all duration values", () => {
    const discount: DiscountEntity = {
      ...mockDiscount,
      duration: "repeating",
      duration_in_months: 3,
    };
    expect(discount.duration).toBe("repeating");
    expect(discount.duration_in_months).toBe(3);
  });
});
