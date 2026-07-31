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
    }).index("entityId", ["entityId"]),
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
      // The `trialEnd` a trial-expiry job was actually scheduled for. Tracked
      // rather than inferred from a change in `trialEnd`, so that a row that
      // was already trialing before this field existed still gets a job, and
      // repeated webhooks for an unchanged trial do not pile up duplicates.
      trialExpiryScheduledFor: v.optional(v.string()),
    })
      .index("id", ["id"])
      .index("customerId", ["customerId"])
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
      // `listUserOrders` only ever wants one-time orders. Without this index it
      // would scan every renewal order the customer has ever had, which grows
      // by one row per billing period forever.
      .index("customerId_type", ["customerId", "type"]),
    scheduledSubscriptionUpdates: defineTable({
      entityId: v.string(),
      subscriptionId: v.string(),
      targetProductId: v.optional(v.string()),
      targetPlanId: v.optional(v.string()),
      targetUnits: v.optional(v.number()),
      effectiveAt: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("applying"),
        v.literal("applied"),
        v.literal("superseded"),
        v.literal("failed"),
      ),
      scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
      error: v.optional(v.string()),
      createdAt: v.string(),
      updatedAt: v.string(),
    })
      .index("entityId_status", ["entityId", "status"])
      .index("subscriptionId_status", ["subscriptionId", "status"]),
    appPlanActivations: defineTable({
      entityId: v.string(),
      planId: v.string(),
      firstActivatedAt: v.number(),
      lastActivatedAt: v.number(),
      activationCount: v.number(),
      activatedByUserId: v.optional(v.string()),
    })
      .index("entityId", ["entityId"])
      .index("entityId_planId", ["entityId", "planId"]),
    appPlanAssignments: defineTable({
      entityId: v.string(),
      planId: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("scheduled"),
        v.literal("ended"),
      ),
      startsAt: v.string(),
      endsAt: v.optional(v.union(v.string(), v.null())),
      source: v.optional(v.string()),
      subscriptionId: v.optional(v.string()),
      assignedByUserId: v.optional(v.string()),
      createdAt: v.string(),
      updatedAt: v.string(),
    })
      .index("entityId", ["entityId"])
      .index("entityId_status", ["entityId", "status"])
      .index("subscriptionId_status", ["subscriptionId", "status"]),
  },
  {
    schemaValidation: true,
  },
);
