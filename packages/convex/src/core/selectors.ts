import type {
  AvailableAction,
  BillingSnapshotSubscription,
  BillingSnapshot,
  OneTimePaymentStatus,
  PaymentRecoveryState,
  SubscriptionSnapshot,
} from "./types.js";
import { isActiveSubscriptionStatus } from "./subscriptionStatus.js";

const TERMINAL_PAYMENT_STATUSES = new Set<OneTimePaymentStatus>([
  "paid",
  "refunded",
  "partially_refunded",
]);

/** Check whether a specific action is available in the given billing snapshot. */
export const hasBillingAction = (
  snapshot: Pick<BillingSnapshot, "availableBillingActions">,
  action: AvailableAction,
) => snapshot.availableBillingActions.includes(action);

/** Check whether the billing snapshot contains one-time orders but no subscriptions. */
export const isOneTimeBilling = (
  snapshot: Pick<BillingSnapshot, "orders" | "subscriptions">,
) => snapshot.subscriptions.length === 0 && snapshot.orders.length > 0;

/** Check whether the billing snapshot has no paid subscription/order ownership. */
export const isEmptyBilling = (
  snapshot: Pick<BillingSnapshot, "orders" | "subscriptions">,
) => snapshot.subscriptions.length === 0 && snapshot.orders.length === 0;

/** Select the first active-like base subscription from a billing snapshot. */
export const selectBaseSubscription = (
  snapshot: Pick<BillingSnapshot, "subscriptions">,
) => {
  const active = snapshot.subscriptions.filter((subscription) =>
    isActiveSubscriptionStatus(subscription.status),
  );
  return (
    active.find((subscription) => subscription.kind === "base") ??
    active.find((subscription) => subscription.kind == null) ??
    active[0] ??
    null
  );
};

/** Select active-like add-on subscriptions from a billing snapshot. */
export const selectActiveAddOns = (
  snapshot: Pick<BillingSnapshot, "subscriptions">,
) =>
  snapshot.subscriptions.filter(
    (subscription) =>
      subscription.kind === "addon" &&
      isActiveSubscriptionStatus(subscription.status),
  );

/** Whether the payment status is terminal (paid, refunded, or partially refunded). */
export const isTerminalPaymentStatus = (status: OneTimePaymentStatus) =>
  TERMINAL_PAYMENT_STATUSES.has(status);

/**
 * Derive payment recovery state from one or more subscriptions.
 *
 * - `"none"` — no payment issues - `"warning"` — at least one subscription is
 * `past_due` - `"blocked"` — at least one subscription is `unpaid` or `expired`
 */
export const derivePaymentRecoveryState = (
  subscriptions:
    | SubscriptionSnapshot
    | SubscriptionSnapshot[]
    | BillingSnapshotSubscription
    | BillingSnapshotSubscription[]
    | null
    | undefined,
): PaymentRecoveryState => {
  if (!subscriptions) return "none";
  const list = Array.isArray(subscriptions) ? subscriptions : [subscriptions];
  if (list.length === 0) return "none";

  let hasWarning = false;
  for (const sub of list) {
    const status = sub.status;
    if (status === "unpaid" || status === "expired") {
      return "blocked";
    }
    if (status === "past_due") {
      hasWarning = true;
    }
  }
  return hasWarning ? "warning" : "none";
};

/**
 * Extract owned product IDs from paid orders.
 *
 * Accepts the `ownedProductIds` array from `ConnectedBillingModel` or an array
 * of order-like objects with a `productId` and `status` field.
 */
export const selectOwnedProductIds = (
  orders:
    | string[]
    | Array<{ productId?: string; status?: string }>
    | null
    | undefined,
): string[] => {
  if (!orders || orders.length === 0) return [];
  if (typeof orders[0] === "string") {
    return orders as string[];
  }
  return (orders as Array<{ productId?: string; status?: string }>)
    .filter((o) => o.productId && o.status === "paid")
    .map((o) => o.productId!);
};

/**
 * Resolve the plan ID of the primary/base subscription from a list of subscriptions.
 * Returns the `planId` of the first subscription with an active-like status, or `null`.
 *
 * Requires a plan lookup function (e.g. `findPlanByProductId` bound to a catalog).
 */
export const resolveBasePlanId = (
  subscriptions:
    | Array<{ productId?: string; status?: string; kind?: string }>
    | null
    | undefined,
  findPlan: (productId: string) => { planId: string } | undefined,
): string | null => {
  if (!subscriptions || subscriptions.length === 0) return null;
  const activeSubscriptions = subscriptions.filter((sub) =>
    isActiveSubscriptionStatus(sub.status),
  );
  const ordered = [
    ...activeSubscriptions.filter((sub) => sub.kind === "base"),
    ...activeSubscriptions.filter((sub) => sub.kind == null),
    ...activeSubscriptions.filter(
      (sub) => sub.kind != null && sub.kind !== "base",
    ),
  ];
  for (const sub of ordered) {
    if (sub.productId && sub.status) {
      const plan = findPlan(sub.productId);
      if (plan) return plan.planId;
    }
  }
  return null;
};
