import {
  findPlanByProductId,
  normalizePlanCatalog,
  normalizeRecurringCycle,
} from "./catalog.js";
import { derivePaymentRecoveryState } from "./selectors.js";
import type {
  AppPlanAssignment,
  AvailableAction,
  BillingAccessItem,
  BillingSnapshotOrder,
  BillingSnapshotSubscription,
  BillingSnapshot,
  PlanCatalog,
  PaymentRecoveryState,
  SubscriptionSnapshot,
} from "./types.js";

/** Input for `resolveBillingSnapshot`. */
export type BillingSnapshotResolverInput = {
  /** Billing entity ID. */
  entityId: string;
  /** Plan catalog for plan-aware resolution. */
  catalog?: PlanCatalog;
  /** All subscriptions for the entity (active, ended, etc.). */
  subscriptions?: SubscriptionSnapshot[];
  /** One-time orders with basic metadata. */
  orders?: Array<{
    orderId: string;
    productId: string;
    status: string;
  }>;
  /** App-owned plan assignment rows for the entity. */
  appPlanAssignments?: AppPlanAssignment[];
  /** Override for the current timestamp (ISO string). */
  now?: string;
};

const ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "scheduled_cancel",
]);

/**
 * Resolve a `BillingSnapshot` from subscriptions, orders, and catalog.
 *
 * The snapshot is array-based so it supports multiple simultaneous subscriptions
 * (base + add-ons) and one-time orders as first-class citizens, with payment
 * recovery state derived from all subscription statuses.
 */
export const resolveBillingSnapshot = (
  input: BillingSnapshotResolverInput,
): BillingSnapshot => {
  const catalog = normalizePlanCatalog(input.catalog);
  const now = input.now ?? new Date().toISOString();

  // Map raw subscriptions to snapshot rows.
  const subscriptions: BillingSnapshotSubscription[] = (
    input.subscriptions ?? []
  ).map((sub) => {
    const plan = findPlanByProductId(catalog, sub.productId);
    return {
      planId: plan?.planId ?? null,
      productId: sub.productId ?? "",
      subscriptionId: sub.id ?? "",
      status: sub.status ?? "unknown",
      recurringCycle: normalizeRecurringCycle(sub.recurringInterval) ?? null,
      // `metadata` is app-authored `Record<string, unknown>`, so only surface
      // `kind` when it really is a string — the snapshot validator rejects
      // anything else, and one odd catalog entry must not fail the whole query.
      kind:
        typeof plan?.metadata?.kind === "string"
          ? plan.metadata.kind
          : undefined,
      units: sub.units,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
    };
  });

  // Map raw orders to snapshot rows.
  const orders: BillingSnapshotOrder[] = (input.orders ?? []).map((order) => {
    const plan = findPlanByProductId(catalog, order.productId);
    return {
      planId: plan?.planId ?? null,
      orderId: order.orderId,
      productId: order.productId,
      status: order.status,
    };
  });

  const appPlanAssignments = input.appPlanAssignments ?? [];
  const access = buildBillingAccess(subscriptions, orders, appPlanAssignments);

  // Derive payment recovery from all subscriptions
  const paymentRecoveryState: PaymentRecoveryState =
    derivePaymentRecoveryState(subscriptions);

  // Build available actions from active subscriptions
  const actions = buildBillingActions(subscriptions, orders);

  return {
    entityId: input.entityId,
    catalogVersion: catalog?.version,
    subscriptions,
    orders,
    appPlanAssignments,
    access,
    paymentRecoveryState,
    availableBillingActions: actions,
    resolvedAt: now,
  };
};

const buildBillingAccess = (
  subscriptions: BillingSnapshotSubscription[],
  orders: BillingSnapshotOrder[],
  appPlanAssignments: AppPlanAssignment[],
): BillingAccessItem[] => [
  ...subscriptions
    .filter((subscription) => ACTIVE_STATUSES.has(subscription.status))
    .map(
      (subscription): BillingAccessItem => ({
        source: "creem_subscription",
        kind: "subscription",
        planId: subscription.planId,
        productId: subscription.productId,
        subscriptionId: subscription.subscriptionId,
        status: subscription.status,
        recurringCycle: subscription.recurringCycle,
        units: subscription.units,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
      }),
    ),
  ...orders
    .filter((order) => order.status === "paid")
    .map(
      (order): BillingAccessItem => ({
        source: "creem_order",
        kind: "one_time",
        planId: order.planId,
        productId: order.productId,
        orderId: order.orderId,
        status: order.status,
      }),
    ),
  ...appPlanAssignments
    .filter((assignment) => assignment.status === "active")
    .map(
      (assignment): BillingAccessItem => ({
        source: "app_plan_assignment",
        kind: "app_plan",
        planId: assignment.planId,
        status: assignment.status,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        assignmentSource: assignment.source,
        subscriptionId: assignment.subscriptionId,
      }),
    ),
];

const buildBillingActions = (
  subscriptions: BillingSnapshotSubscription[],
  orders: BillingSnapshotOrder[],
): AvailableAction[] => {
  const actions = new Set<AvailableAction>();
  const activeSubs = subscriptions.filter((s) => ACTIVE_STATUSES.has(s.status));
  const hasReactivatable = subscriptions.some(
    (s) => s.status === "canceled" || s.status === "scheduled_cancel",
  );

  if (activeSubs.length === 0 && !hasReactivatable && orders.length === 0) {
    actions.add("checkout");
    return Array.from(actions);
  }

  if (activeSubs.length > 0) {
    actions.add("portal");
    actions.add("cancel");
  }

  if (hasReactivatable) {
    actions.add("reactivate");
    // No active subs means the user can also start fresh
    if (activeSubs.length === 0) {
      actions.add("checkout");
    }
  }

  // One-time orders can always add more
  if (orders.length > 0) {
    actions.add("checkout");
  }

  return Array.from(actions);
};
