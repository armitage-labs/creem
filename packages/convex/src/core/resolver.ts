import {
  findPlanById,
  findPlanByProductId,
  normalizePlanCatalog,
  normalizeRecurringCycle,
} from "./catalog.js";
import type {
  AvailableAction,
  BillingResolverInput,
  BillingSnapshot,
  BillingType,
  PlanCategory,
  PlanCatalogEntry,
  SubscriptionSnapshot,
} from "./types.js";

const toCategoryFromSubscription = (
  subscription: SubscriptionSnapshot | null | undefined,
): PlanCategory => {
  const status = subscription?.status;
  if (status === "trialing") {
    return "trial";
  }
  if (
    status === "active" ||
    status === "scheduled_cancel" ||
    status === "past_due" ||
    status === "canceled"
  ) {
    return "paid";
  }
  return "custom";
};

const toBillingType = (
  plan: PlanCatalogEntry | undefined,
  input: BillingResolverInput,
): BillingType => {
  if (plan?.billingType) {
    return plan.billingType;
  }
  if (input.payment) {
    return "onetime";
  }
  if (input.currentSubscription) {
    return "recurring";
  }
  return "custom";
};

const buildActions = (
  input: BillingResolverInput,
  plan: PlanCatalogEntry | undefined,
  billingType: BillingType,
): AvailableAction[] => {
  const actions = new Set<AvailableAction>();
  const subscription = input.currentSubscription;

  if (plan?.category === "enterprise") {
    actions.add("contact_sales");
    return Array.from(actions);
  }

  if (billingType === "onetime") {
    actions.add("checkout");
    return Array.from(actions);
  }

  if (!subscription) {
    actions.add("checkout");
    return Array.from(actions);
  }

  actions.add("portal");

  if (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "scheduled_cancel"
  ) {
    actions.add("cancel");
  }

  if (
    subscription.status === "canceled" ||
    subscription.status === "scheduled_cancel"
  ) {
    actions.add("reactivate");
  }

  if ((plan?.billingCycles?.length ?? 0) > 1) {
    actions.add("switch_interval");
  }

  if (
    (plan?.pricingModel === "seat" || subscription.seats != null) &&
    billingType === "recurring"
  ) {
    actions.add("update_seats");
  }

  return Array.from(actions);
};

/**
 * Resolve a `BillingSnapshot` from subscription, catalog, and payment data.
 * This is the core billing state resolver — determines the active plan, category,
 * available actions, and metadata based on the current subscription state.
 *
 * Used internally by `creem.getBillingSnapshot()`. Can also be called directly
 * for custom billing UIs that don't use the Creem class.
 */
export const resolveBillingSnapshot = (
  input: BillingResolverInput,
): BillingSnapshot => {
  const catalog = normalizePlanCatalog(input.catalog);
  const subscription = input.currentSubscription ?? null;
  const planFromSubscription = findPlanByProductId(
    catalog,
    subscription?.productId,
  );
  const fallbackPlan = catalog?.defaultPlanId
    ? findPlanById(catalog, catalog.defaultPlanId)
    : undefined;
  const activePlan = planFromSubscription ?? fallbackPlan;

  const billingType = toBillingType(activePlan, input);
  const recurringCycle = normalizeRecurringCycle(
    subscription?.recurringInterval,
  );
  const availableBillingCycles =
    activePlan?.billingCycles && activePlan.billingCycles.length > 0
      ? activePlan.billingCycles
      : recurringCycle
        ? [recurringCycle]
        : [];

  return {
    resolvedAt: input.now ?? new Date().toISOString(),
    catalogVersion: catalog?.version,
    activePlanId: activePlan?.planId ?? null,
    activeCategory:
      subscription?.status === "trialing"
        ? "trial"
        : (activePlan?.category ?? toCategoryFromSubscription(subscription)),
    billingType,
    recurringCycle,
    availableBillingCycles,
    subscriptionState: subscription?.status,
    seats: subscription?.seats ?? undefined,
    payment: input.payment ?? null,
    availableActions: buildActions(input, activePlan, billingType),
    metadata: {
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      trialEnd: subscription?.trialEnd ?? null,
      userContext: input.userContext ?? {},
    },
  };
};
