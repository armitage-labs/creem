// Type tests, compiled by `pnpm --filter @creem_io/nextjs typecheck`.
// @creem_io/webhook-types 2.0 opens its value fields (ENG-2623). The Webhook
// callbacks hand those payloads to your code, so the open types must arrive
// through this package's exports, and identifying fields must stay closed.
import type {
  FlatCheckoutCompleted,
  FlatDisputeCreated,
  FlatRefundCreated,
  FlatSubscriptionEvent,
  GrantAccessContext,
  WebhookOptions,
} from "../../index";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type KnownValues<T> = T extends string ? (string extends T ? never : T) : never;

const unknownValue = "added_by_creem_later" as string;

type RefundCallbackData = Parameters<NonNullable<WebhookOptions["onRefundCreated"]>>[0];

export const acceptsUnknown = {
  refundReason: unknownValue satisfies FlatRefundCreated["reason"],
  callbackRefundReason: unknownValue satisfies RefundCallbackData["reason"],
  checkoutStatus: unknownValue satisfies FlatCheckoutCompleted["status"],
  productBillingType: unknownValue satisfies FlatCheckoutCompleted["product"]["billing_type"],
  disputeMode: unknownValue satisfies FlatDisputeCreated["mode"],
  subscriptionStatus: unknownValue satisfies FlatSubscriptionEvent<"subscription.paid">["status"],
  grantStatus: unknownValue satisfies GrantAccessContext["status"],
};

export type KnownValuesKeepTheirLiterals = [
  Assert<
    Equal<
      KnownValues<FlatRefundCreated["reason"]>,
      "duplicate" | "fraudulent" | "requested_by_customer" | "other"
    >
  >,
  Assert<Equal<FlatRefundCreated["webhookEventType"], "refund.created">>,
  Assert<Equal<FlatRefundCreated["object"], "refund">>,
];

export const onRefundCreated: NonNullable<WebhookOptions["onRefundCreated"]> = ({ reason }) => {
  switch (reason) {
    case "duplicate":
      return;
    default:
      // e.g. a reason Creem added after this version
      return;
  }
};
