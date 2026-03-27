import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const vNullableString = v.union(v.string(), v.null());

export default defineSchema(
  {
    customers: defineTable({
      id: v.string(),
      entityId: v.string(),
      email: v.optional(v.string()),
      name: v.optional(vNullableString),
      country: v.optional(v.string()),
      mode: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.optional(v.string()),
      updatedAt: v.optional(v.string()),
    })
      .index("entityId", ["entityId"])
      .index("id", ["id"]),
    products: defineTable({
      id: v.string(),
      name: v.string(),
      description: v.union(v.string(), v.null()),
      price: v.number(),
      currency: v.string(),
      billingType: v.string(),
      billingPeriod: v.optional(v.string()),
      status: v.string(),
      taxMode: v.optional(v.string()),
      taxCategory: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      productUrl: v.optional(v.string()),
      defaultSuccessUrl: v.optional(vNullableString),
      mode: v.optional(v.string()),
      features: v.optional(
        v.array(
          v.object({
            id: v.string(),
            description: v.string(),
          }),
        ),
      ),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.string(),
      modifiedAt: v.union(v.string(), v.null()),
    })
      .index("id", ["id"])
      .index("status", ["status"]),
    subscriptions: defineTable({
      id: v.string(),
      customerId: v.string(),
      productId: v.string(),
      status: v.string(),
      amount: v.union(v.number(), v.null()),
      currency: v.union(v.string(), v.null()),
      recurringInterval: vNullableString,
      currentPeriodStart: v.string(),
      currentPeriodEnd: v.union(v.string(), v.null()),
      cancelAtPeriodEnd: v.boolean(),
      startedAt: v.union(v.string(), v.null()),
      endedAt: v.union(v.string(), v.null()),
      priceId: v.optional(v.string()),
      checkoutId: v.union(v.string(), v.null()),
      metadata: v.record(v.string(), v.any()),
      collectionMethod: v.optional(v.string()),
      discountId: v.optional(v.union(v.string(), v.null())),
      canceledAt: v.optional(v.union(v.string(), v.null())),
      endsAt: v.optional(v.union(v.string(), v.null())),
      trialStart: v.optional(v.union(v.string(), v.null())),
      trialEnd: v.optional(v.union(v.string(), v.null())),
      seats: v.optional(v.union(v.number(), v.null())),
      lastTransactionId: v.optional(v.union(v.string(), v.null())),
      nextTransactionDate: v.optional(v.union(v.string(), v.null())),
      mode: v.optional(v.string()),
      createdAt: v.string(),
      modifiedAt: v.union(v.string(), v.null()),
    })
      .index("id", ["id"])
      .index("customerId", ["customerId"])
      .index("customerId_status", ["customerId", "status"])
      .index("customerId_endedAt", ["customerId", "endedAt"]),
    orders: defineTable({
      id: v.string(),
      customerId: v.string(),
      productId: v.string(),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      type: v.string(),
      subTotal: v.optional(v.number()),
      taxAmount: v.optional(v.number()),
      discountAmount: v.optional(v.number()),
      amountDue: v.optional(v.number()),
      amountPaid: v.optional(v.number()),
      transactionId: v.optional(v.union(v.string(), v.null())),
      checkoutId: v.optional(v.union(v.string(), v.null())),
      discountId: v.optional(v.union(v.string(), v.null())),
      affiliate: v.optional(v.union(v.string(), v.null())),
      mode: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.string(),
      updatedAt: v.string(),
    })
      .index("id", ["id"])
      .index("customerId", ["customerId"])
      .index("customerId_productId", ["customerId", "productId"]),
  },
  {
    schemaValidation: true,
  },
);
