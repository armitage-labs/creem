// @creem_io/webhook-types 2.0 opens its value fields (ENG-2623). Better Auth's
// webhook callbacks hand those payloads to your code, so the open types must
// arrive through the plugin's exports, and identifying fields must stay closed.
import type {
  CreemOptions,
  DiscountDuration,
  DiscountStatus,
  DiscountType,
  FlatCheckoutCompleted,
  FlatDisputeCreated,
  FlatRefundCreated,
  FlatSubscriptionEvent,
  GrantAccessContext,
  RevokeAccessContext,
} from "@creem_io/better-auth";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type KnownValues<T> = T extends string ? (string extends T ? never : T) : never;

const unknownValue = "added_by_creem_later" as string;

type RefundCallbackData = Parameters<NonNullable<CreemOptions["onRefundCreated"]>>[0];

export const acceptsUnknown = {
  refundReason: unknownValue satisfies FlatRefundCreated["reason"],
  refundStatus: unknownValue satisfies FlatRefundCreated["status"],
  callbackRefundReason: unknownValue satisfies RefundCallbackData["reason"],
  checkoutStatus: unknownValue satisfies FlatCheckoutCompleted["status"],
  checkoutMode: unknownValue satisfies FlatCheckoutCompleted["mode"],
  productStatus: unknownValue satisfies FlatCheckoutCompleted["product"]["status"],
  disputeMode: unknownValue satisfies FlatDisputeCreated["mode"],
  subscriptionStatus: unknownValue satisfies FlatSubscriptionEvent<"subscription.paid">["status"],
  collectionMethod:
    unknownValue satisfies FlatSubscriptionEvent<"subscription.paid">["collection_method"],
  grantStatus: unknownValue satisfies GrantAccessContext["status"],
  revokeStatus: unknownValue satisfies RevokeAccessContext["status"],
  discountStatus: unknownValue satisfies DiscountStatus,
  discountType: unknownValue satisfies DiscountType,
  discountDuration: unknownValue satisfies DiscountDuration,
};

export type KnownValuesKeepTheirLiterals = [
  Assert<
    Equal<
      KnownValues<FlatRefundCreated["reason"]>,
      "duplicate" | "fraudulent" | "requested_by_customer" | "other"
    >
  >,
  Assert<Equal<KnownValues<DiscountType>, "percentage" | "fixed">>,
  // Identifying fields stay closed.
  Assert<Equal<FlatRefundCreated["webhookEventType"], "refund.created">>,
  Assert<Equal<FlatRefundCreated["object"], "refund">>,
  // Better Auth's own access reasons are not payload values and stay closed.
  Assert<Equal<[string] extends [GrantAccessContext["reason"]] ? true : false, false>>,
];

// The ticket's example: a refund handler that switches over the reason needs a
// default branch, because Creem can send a reason added later.
export const onRefundCreated: NonNullable<CreemOptions["onRefundCreated"]> = ({ reason }) => {
  switch (reason) {
    case "duplicate":
    case "fraudulent":
      return;
    default:
      // e.g. a reason Creem added after this version
      return;
  }
};
