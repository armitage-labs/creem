import type {
  GenericMutationCtx,
  GenericActionCtx,
  GenericQueryCtx,
  GenericDataModel,
} from "convex/server";
import type {
  ProductEntity as CreemProduct,
  SubscriptionEntity as CreemSubscription,
} from "creem/models/components";
import { ConvexError, type Infer } from "convex/values";
import type schema from "./schema.js";

/** Minimal context type for Convex functions that only need `runQuery`. */
export type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};
/** Minimal context type for Convex functions that need `runQuery` + `runMutation`. */
export type RunMutationCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};
/** Mutation context that also includes `scheduler` for scheduling async follow-up actions. */
export type RunSchedulerMutationCtx = RunMutationCtx & {
  scheduler: GenericMutationCtx<GenericDataModel>["scheduler"];
};
/** Minimal context type for Convex actions that need `runQuery` + `runMutation` + `runAction`. */
export type RunActionCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

const toIsoString = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
};

const toIsoStringOrNow = (value: unknown): string => {
  return toIsoString(value) ?? new Date().toISOString();
};

const entityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
};

/** Convert a Creem SDK `SubscriptionEntity` to the Convex DB subscription schema shape. Handles snake_case/camelCase, metadata recovery, and trial/cancel state. */
export const convertToDatabaseSubscription = (
  subscription: CreemSubscription,
  options?: { rawMetadata?: Record<string, unknown> },
): Infer<typeof schema.tables.subscriptions.validator> => {
  const customerId = entityId(subscription.customer);
  if (!customerId) {
    throw new ConvexError("Creem subscription is missing customer id");
  }
  const productId =
    entityId(subscription.product) ??
    subscription.items?.[0]?.productId ??
    null;
  if (!productId) {
    throw new ConvexError("Creem subscription is missing product id");
  }
  const product =
    typeof subscription.product === "object" && subscription.product
      ? subscription.product
      : null;
  const now = new Date().toISOString();

  const periodStartStr = toIsoString(subscription.currentPeriodStartDate);
  const periodEndStr = toIsoString(subscription.currentPeriodEndDate);

  // Only `scheduled_cancel` is the resumable cancel-at-period-end state.
  // `canceled` means truly ended (even if currentPeriodEnd is in the future).
  const isScheduledCancel = subscription.status === "scheduled_cancel";
  const isTrialing = subscription.status === "trialing";

  // SDK's SubscriptionEntity type does not include `metadata` — zod strips it.
  // Accept rawMetadata from the caller (extracted from the raw webhook object).
  const metadata =
    options?.rawMetadata ??
    (subscription as { metadata?: Record<string, unknown> }).metadata ??
    {};

  return {
    id: subscription.id,
    customerId,
    productId,
    status: subscription.status,
    amount: product?.price ?? null,
    currency: product?.currency ?? null,
    recurringInterval: product?.billingPeriod ?? null,
    currentPeriodStart:
      periodStartStr ?? toIsoStringOrNow(subscription.createdAt),
    currentPeriodEnd: periodEndStr,
    cancelAtPeriodEnd: isScheduledCancel,
    startedAt: periodStartStr ?? toIsoString(subscription.createdAt),
    endedAt:
      subscription.status === "canceled"
        ? (toIsoString(subscription.canceledAt) ?? now)
        : null,
    checkoutId: null,
    metadata,
    collectionMethod:
      (subscription as { collectionMethod?: string }).collectionMethod ??
      "charge_automatically",
    discountId:
      (subscription.discount as { id?: string } | undefined)?.id ?? null,
    canceledAt: toIsoString(subscription.canceledAt),
    endsAt: isScheduledCancel ? periodEndStr : null,
    // Fix: populate trial dates from period dates when status is trialing
    trialStart: isTrialing ? periodStartStr : null,
    trialEnd: isTrialing ? periodEndStr : null,
    seats: subscription.items?.[0]?.units ?? null,
    lastTransactionId: subscription.lastTransactionId ?? null,
    nextTransactionDate: toIsoString(subscription.nextTransactionDate),
    mode: subscription.mode,
    priceId: subscription.items?.[0]?.priceId,
    createdAt: toIsoStringOrNow(subscription.createdAt),
    modifiedAt: toIsoString(subscription.updatedAt),
  };
};

/** Convert a raw order object (from checkout webhook) to the Convex DB order schema shape. Handles both snake_case and camelCase field names. */
export const convertToOrder = (
  order: {
    id: string;
    customer?: string | null;
    product: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    transaction?: string | null;
    sub_total?: number;
    subTotal?: number;
    tax_amount?: number;
    taxAmount?: number;
    discount_amount?: number;
    discountAmount?: number;
    amount_due?: number;
    amountDue?: number;
    amount_paid?: number;
    amountPaid?: number;
    discount?: string | null;
    affiliate?: string | null;
    mode?: string;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    created_at?: string | null;
    updated_at?: string | null;
  },
  options?: {
    checkoutId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Infer<typeof schema.tables.orders.validator> => {
  const now = new Date().toISOString();
  return {
    id: order.id,
    customerId: order.customer ?? "",
    productId: order.product,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    type: order.type,
    subTotal: order.subTotal ?? order.sub_total,
    taxAmount: order.taxAmount ?? order.tax_amount,
    discountAmount: order.discountAmount ?? order.discount_amount,
    amountDue: order.amountDue ?? order.amount_due,
    amountPaid: order.amountPaid ?? order.amount_paid,
    transactionId: order.transaction ?? null,
    checkoutId: options?.checkoutId ?? null,
    discountId: order.discount ?? null,
    affiliate: order.affiliate ?? null,
    mode: order.mode,
    metadata: (options?.metadata as Record<string, string>) ?? undefined,
    createdAt:
      toIsoString(order.createdAt) ?? toIsoString(order.created_at) ?? now,
    updatedAt:
      toIsoString(order.updatedAt) ?? toIsoString(order.updated_at) ?? now,
  };
};

/** Convert a Creem SDK `ProductEntity` to the Convex DB product schema shape. */
export const convertToDatabaseProduct = (
  product: CreemProduct,
): Infer<typeof schema.tables.products.validator> => {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    billingType: product.billingType,
    billingPeriod: product.billingPeriod,
    status: product.status,
    taxMode: product.taxMode,
    taxCategory: product.taxCategory,
    imageUrl: (product as { imageUrl?: string }).imageUrl,
    productUrl: (product as { productUrl?: string }).productUrl,
    defaultSuccessUrl: product.defaultSuccessUrl,
    mode: product.mode,
    features: product.features?.map((f) => ({
      id: f.id,
      description: f.description,
    })),
    metadata: {},
    createdAt: toIsoStringOrNow(product.createdAt),
    modifiedAt: toIsoString(product.updatedAt),
  };
};
