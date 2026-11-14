// Type tests, compiled by `pnpm --filter @creem_io/webhook-types typecheck`.
//
// Creem adds values to webhook payload fields over time (a refund reason, a
// subscription status). The parser passes them through unchanged, so every
// value field must admit a string next to its known values, or a handler's
// `switch` treats a real value as impossible. The fields that identify an event
// (`eventType`) or an object (`object`) stay closed: they select the shape.
import type {
  BaseEntity,
  CheckoutEntity,
  CheckoutStatus,
  CustomField,
  CustomerEntity,
  DiscountDuration,
  DiscountEntity,
  DiscountStatus,
  DiscountType,
  DisputeEntity,
  FeatureEntity,
  LicenseEntity,
  LicenseInstanceEntity,
  NormalizedCheckoutEntity,
  NormalizedRefundEntity,
  NormalizedSubscriptionEntity,
  OpenValue,
  OrderEntity,
  ProductEntity,
  ProductFeatureEntity,
  RefundCreatedEvent,
  RefundEntity,
  SubscriptionEntity,
  SubscriptionItemEntity,
  SubscriptionStatus,
  TransactionEntity,
  WebhookEvent,
  WebhookEventEntity,
} from "../../src/index.js";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

/** The literal values of a field, without the open `string` part. */
type KnownValues<T> = T extends string ? (string extends T ? never : T) : never;

/** True when the field accepts a value this package version doesn't list. */
type AdmitsUnknown<T> = [string] extends [T] ? true : false;

const unknownValue = "added_by_creem_later" as string;

// ---------------------------------------------------------------------------
// Every value field admits an unknown string.
// ---------------------------------------------------------------------------

export const values = {
  mode: unknownValue satisfies BaseEntity["mode"],
  customFieldType: unknownValue satisfies CustomField["type"],
  featureType: unknownValue satisfies FeatureEntity["type"],
  productBillingType: unknownValue satisfies ProductEntity["billing_type"],
  productBillingPeriod: unknownValue satisfies ProductEntity["billing_period"],
  productStatus: unknownValue satisfies ProductEntity["status"],
  productTaxMode: unknownValue satisfies ProductEntity["tax_mode"],
  productTaxCategory: unknownValue satisfies ProductEntity["tax_category"],
  transactionType: unknownValue satisfies TransactionEntity["type"],
  transactionStatus: unknownValue satisfies TransactionEntity["status"],
  orderStatus: unknownValue satisfies OrderEntity["status"],
  orderType: unknownValue satisfies OrderEntity["type"],
  discountStatus: unknownValue satisfies DiscountStatus,
  discountType: unknownValue satisfies DiscountType,
  discountDuration: unknownValue satisfies DiscountDuration,
  licenseInstanceStatus: unknownValue satisfies LicenseInstanceEntity["status"],
  licenseStatus: unknownValue satisfies LicenseEntity["status"],
  productFeatureType: unknownValue satisfies ProductFeatureEntity["type"],
  subscriptionStatus: unknownValue satisfies SubscriptionStatus,
  collectionMethod: unknownValue satisfies SubscriptionEntity["collection_method"],
  checkoutStatus: unknownValue satisfies CheckoutStatus,
  refundStatus: unknownValue satisfies RefundEntity["status"],
  refundReason: unknownValue satisfies RefundEntity["reason"],
  // Through the entities that carry them, and the normalized events.
  discountEntityStatus: unknownValue satisfies DiscountEntity["status"],
  checkoutEntityStatus: unknownValue satisfies CheckoutEntity["status"],
  normalizedSubscriptionStatus: unknownValue satisfies NormalizedSubscriptionEntity["status"],
  normalizedCheckoutStatus: unknownValue satisfies NormalizedCheckoutEntity["status"],
  normalizedRefundReason: unknownValue satisfies NormalizedRefundEntity["reason"],
  disputeMode: unknownValue satisfies DisputeEntity["mode"],
};

// ---------------------------------------------------------------------------
// Known values keep their literal types (editors suggest them, comparisons compile).
// ---------------------------------------------------------------------------

export type KnownLiteralTypes = [
  Assert<
    Equal<
      KnownValues<RefundEntity["reason"]>,
      "duplicate" | "fraudulent" | "requested_by_customer" | "other"
    >
  >,
  Assert<
    Equal<
      KnownValues<SubscriptionStatus>,
      | "active"
      | "canceled"
      | "expired"
      | "past_due"
      | "unpaid"
      | "paused"
      | "trialing"
      | "scheduled_cancel"
    >
  >,
  Assert<Equal<KnownValues<SubscriptionEntity["collection_method"]>, "charge_automatically">>,
  Assert<Equal<KnownValues<BaseEntity["mode"]>, "test" | "prod" | "sandbox">>,
  Assert<Equal<KnownValues<ProductEntity["status"]>, "active" | "archived">>,
  // A field that is optional or nullable stays so.
  Assert<Equal<Extract<ProductFeatureEntity["type"], null | undefined>, null | undefined>>,
  Assert<Equal<OpenValue<"a" | "b">, "a" | "b" | (string & {})>>,
];

export function comparesWithAKnownValue(reason: RefundEntity["reason"]): boolean {
  return reason === "duplicate" || reason === "requested_by_customer";
}

// A `switch` over every known value needs a `default` branch now: without it
// the function can fall through for a value Creem adds later.
// @ts-expect-error TS2366: function lacks ending return statement
export function labelWithoutDefault(reason: RefundEntity["reason"]): string {
  switch (reason) {
    case "duplicate":
      return "Duplicate";
    case "fraudulent":
      return "Fraudulent";
    case "requested_by_customer":
      return "Requested by customer";
    case "other":
      return "Other";
  }
}

export function labelWithDefault(reason: RefundEntity["reason"]): string {
  switch (reason) {
    case "duplicate":
      return "Duplicate";
    default:
      return reason;
  }
}

// ---------------------------------------------------------------------------
// Identifying fields stay closed.
// ---------------------------------------------------------------------------

export type IdentifyingFieldsStayClosed = [
  Assert<Equal<AdmitsUnknown<WebhookEventEntity["eventType"]>, false>>,
  Assert<Equal<AdmitsUnknown<WebhookEvent["eventType"]>, false>>,
  Assert<Equal<RefundCreatedEvent["eventType"], "refund.created">>,
  Assert<Equal<RefundEntity["object"], "refund">>,
  Assert<Equal<CustomerEntity["object"], "customer">>,
  Assert<Equal<SubscriptionItemEntity["object"], "subscription_item">>,
  // And the value fields really are open (the helper isn't vacuous).
  Assert<Equal<AdmitsUnknown<RefundEntity["reason"]>, true>>,
];

// @ts-expect-error an event type is never an arbitrary string
export const eventType: WebhookEventEntity["eventType"] = unknownValue;
// @ts-expect-error an object kind is never an arbitrary string
export const objectKind: RefundEntity["object"] = unknownValue;

// Discriminating on eventType still narrows the event's object.
export function refundReasonOf(event: WebhookEvent): RefundEntity["reason"] | undefined {
  return event.eventType === "refund.created" ? event.object.reason : undefined;
}
