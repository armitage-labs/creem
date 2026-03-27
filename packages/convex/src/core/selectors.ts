import type {
  AvailableAction,
  BillingSnapshot,
  OneTimePaymentStatus,
} from "./types.js";

const TERMINAL_PAYMENT_STATUSES = new Set<OneTimePaymentStatus>([
  "paid",
  "refunded",
  "partially_refunded",
]);

/** Check whether a specific action is available in the given billing snapshot. */
export const hasBillingAction = (
  snapshot: BillingSnapshot,
  action: AvailableAction,
) => snapshot.availableActions.includes(action);

/** Check whether the billing snapshot represents a one-time purchase (not a subscription). */
export const isOneTimeBilling = (snapshot: BillingSnapshot) =>
  snapshot.billingType === "onetime";

/** Check whether the billing snapshot represents an enterprise plan. */
export const isEnterpriseBilling = (snapshot: BillingSnapshot) =>
  snapshot.activeCategory === "enterprise";

/** Whether the billing cycle toggle (e.g. Monthly/Yearly) should be shown in the UI. */
export const shouldShowBillingCycleToggle = (snapshot: BillingSnapshot) =>
  snapshot.billingType === "recurring" &&
  snapshot.availableBillingCycles.length > 1 &&
  hasBillingAction(snapshot, "switch_interval");

/** Whether the payment status is terminal (paid, refunded, or partially refunded). */
export const isTerminalPaymentStatus = (status: OneTimePaymentStatus) =>
  TERMINAL_PAYMENT_STATUSES.has(status);
