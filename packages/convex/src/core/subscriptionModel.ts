import { findPlanById, shouldShowPlan } from "./catalog.js";
import type { ConnectedBillingModel, ConnectedProduct } from "./model.js";
import type {
  SubscriptionGroupRegistration,
  SubscriptionPlanRegistration,
  SubscriptionPlanType,
} from "./model.js";
import type {
  PlanCatalog,
  PlanCatalogEntry,
  RecurringCycle,
  UIPlanEntry,
} from "./types.js";

/**
 * Framework-agnostic derivation for `<Subscription.Root>`.
 *
 * The React and Svelte roots differ only in how they hold state and render;
 * everything they compute from `(registrations, catalog, products, model)` is
 * the same and lives here. Keeping it in one place is what stops the two roots
 * from drifting, and it is unit-testable without a renderer.
 */

/** Group option shown in the root's group selector. */
export type SubscriptionGroupItem = { value: string; label: string };

export const formatGroupTitle = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const planTypeToCategory = (
  type: SubscriptionPlanType | undefined,
  fallback?: PlanCatalogEntry,
): PlanCatalogEntry["category"] => {
  if (type === "free") return "free";
  if (type === "enterprise") return "enterprise";
  return fallback?.category ?? "paid";
};

const planTypeToBillingType = (
  type: SubscriptionPlanType | undefined,
  fallback?: PlanCatalogEntry,
): PlanCatalogEntry["billingType"] => {
  if (type === "free" || type === "enterprise") return "custom";
  return fallback?.billingType ?? "recurring";
};

/**
 * Turn `plans` / `groups` props into plan registrations.
 *
 * `groups` wins when present: its plan IDs carry the group value and label that
 * the selector renders.
 */
export const buildCatalogRegistrations = ({
  groups,
  planIds,
}: {
  groups?: readonly SubscriptionGroupRegistration[];
  planIds?: readonly string[];
}): SubscriptionPlanRegistration[] => {
  const ids =
    groups && groups.length > 0
      ? groups.flatMap((entry) => entry.plans)
      : (planIds ?? []);
  return ids.map((planId) => {
    const groupEntry = groups?.find((entry) => entry.plans.includes(planId));
    return {
      planId,
      groupId: groupEntry?.value,
      groupTitle: groupEntry?.label,
    };
  });
};

/**
 * Resolve registrations into display-ready plan entries.
 *
 * Precedence for every display field is registration prop → catalog entry →
 * synced Creem product → derived fallback.
 */
export const resolveUIPlans = ({
  registrations,
  catalog,
  products,
}: {
  registrations: readonly SubscriptionPlanRegistration[];
  catalog?: PlanCatalog;
  products: readonly ConnectedProduct[];
}): UIPlanEntry[] =>
  registrations.map((plan) => {
    const catalogEntry = catalog
      ? findPlanById(catalog, plan.planId)
      : undefined;
    const productIds = plan.productIds ?? catalogEntry?.creemProductIds ?? {};
    const firstProductId = Object.values(productIds)[0];
    const firstProduct = firstProductId
      ? products.find((product) => product.id === firstProductId)
      : undefined;

    const cycleKeys = Object.keys(productIds).filter(
      (key): key is RecurringCycle => key !== "custom",
    );

    const entry: UIPlanEntry = {
      planId: plan.planId,
      category: planTypeToCategory(plan.type, catalogEntry),
      billingType: planTypeToBillingType(plan.type, catalogEntry),
      pricingModel:
        plan.type === "unit-based"
          ? "unit"
          : (catalogEntry?.pricingModel ?? "flat"),
      trialDays: catalogEntry?.trialDays,
      groupId: plan.groupId ?? catalogEntry?.groupId,
      groupTitle: plan.groupTitle ?? catalogEntry?.groupTitle,
      eligibilityScopeId: catalogEntry?.eligibilityScopeId,
      title:
        plan.title ??
        catalogEntry?.title ??
        firstProduct?.name ??
        plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1),
      description:
        plan.description ??
        catalogEntry?.description ??
        firstProduct?.description ??
        undefined,
      contactUrl: plan.contactUrl ?? catalogEntry?.contactUrl,
      recommended: plan.recommended ?? catalogEntry?.recommended,
      limits: catalogEntry?.limits,
      creditGrant: catalogEntry?.creditGrant,
      eligibility: catalogEntry?.eligibility,
      metadata: catalogEntry?.metadata,
      creemProductIds:
        Object.keys(productIds).length > 0
          ? (productIds as Record<string, string>)
          : undefined,
    };
    if (cycleKeys.length > 0) {
      entry.billingCycles = cycleKeys;
    }
    return entry;
  });

/** Explicit `groups` when provided, otherwise groups inferred from plan `groupId`s. */
export const deriveGroupItems = ({
  groups,
  plans,
}: {
  groups?: readonly SubscriptionGroupRegistration[];
  plans: readonly UIPlanEntry[];
}): SubscriptionGroupItem[] => {
  if (groups && groups.length > 0) {
    return groups.map((entry) => ({ value: entry.value, label: entry.label }));
  }
  const inferred = new Map<string, string>();
  for (const plan of plans) {
    if (!plan.groupId || inferred.has(plan.groupId)) continue;
    inferred.set(
      plan.groupId,
      plan.groupTitle ?? formatGroupTitle(plan.groupId),
    );
  }
  return Array.from(inferred, ([value, label]) => ({ value, label }));
};

/** Clamp a requested group to one that exists; falls back to the first group. */
export const resolveActiveGroupId = ({
  groupItems,
  requestedGroupId,
}: {
  groupItems: readonly SubscriptionGroupItem[];
  requestedGroupId: string | null;
}): string | null =>
  groupItems.length > 1 &&
  requestedGroupId &&
  groupItems.some((item) => item.value === requestedGroupId)
    ? requestedGroupId
    : (groupItems[0]?.value ?? null);

/** Plans visible for the active group. With one group or none, all plans show. */
export const filterPlansByGroup = ({
  plans,
  groupItems,
  activeGroupId,
}: {
  plans: readonly UIPlanEntry[];
  groupItems: readonly SubscriptionGroupItem[];
  activeGroupId: string | null;
}): UIPlanEntry[] => {
  if (groupItems.length <= 1 || !activeGroupId) return [...plans];
  return plans.filter((plan) => plan.groupId === activeGroupId);
};

/** Distinct billing cycles across the given plans, in first-seen order. */
export const deriveAvailableCycles = (
  plans: readonly UIPlanEntry[],
): RecurringCycle[] => {
  const cycles = new Set<RecurringCycle>();
  for (const plan of plans) {
    for (const cycle of plan.billingCycles ?? []) {
      cycles.add(cycle);
    }
  }
  return Array.from(cycles);
};

/** Clamp a requested cycle to one the visible plans actually offer. */
export const resolveEffectiveCycle = ({
  availableCycles,
  requestedCycle,
}: {
  availableCycles: readonly RecurringCycle[];
  requestedCycle: RecurringCycle;
}): RecurringCycle => {
  if (
    availableCycles.length === 0 ||
    availableCycles.includes(requestedCycle)
  ) {
    return requestedCycle;
  }
  return availableCycles[0] ?? requestedCycle;
};

/** Every Creem product ID owned by this root's plans. */
export const deriveOwnProductIds = (
  plans: readonly UIPlanEntry[],
): Set<string> => {
  const ids = new Set<string>();
  for (const plan of plans) {
    for (const productId of Object.values(plan.creemProductIds ?? {})) {
      if (productId) ids.add(productId);
    }
  }
  return ids;
};

const findPlanIdByProductId = (
  plans: readonly UIPlanEntry[],
  productId: string | null | undefined,
): string | null => {
  if (!productId) return null;
  const plan = plans.find((candidate) =>
    Object.values(candidate.creemProductIds ?? {})
      .filter(Boolean)
      .includes(productId),
  );
  return plan?.planId ?? null;
};

/**
 * The active subscription that belongs to this root.
 *
 * Roots on the same page can render different product lines, so a subscription
 * only counts when its product is one of this root's own.
 */
export const resolveMatchedSubscription = ({
  model,
  ownProductIds,
}: {
  model: ConnectedBillingModel | null;
  ownProductIds: ReadonlySet<string>;
}):
  | NonNullable<ConnectedBillingModel["activeSubscriptions"]>[number]
  | null => {
  const subscriptions = model?.activeSubscriptions;
  if (!subscriptions || ownProductIds.size === 0) return null;
  return (
    subscriptions.find((subscription) =>
      ownProductIds.has(subscription.productId),
    ) ?? null
  );
};

/**
 * Currently active plan for this root.
 *
 * Precedence: the paid subscription's plan → an explicit `activePlanId` from
 * the resolver → a component-owned active app-plan assignment → an explicit
 * `activeFreePlanId` → the first catalog free plan for a signed-in user.
 */
export const resolveActivePlanId = ({
  model,
  plans,
  subscriptionProductId,
}: {
  model: ConnectedBillingModel | null;
  plans: readonly UIPlanEntry[];
  subscriptionProductId: string | null;
}): string | null => {
  if (!model) return null;
  if (subscriptionProductId) {
    return findPlanIdByProductId(plans, subscriptionProductId);
  }
  if (model.activePlanId !== undefined) {
    return model.activePlanId;
  }
  const assignedPlanId =
    model.appPlanAssignments?.find(
      (assignment) =>
        assignment.status === "active" &&
        plans.some((plan) => plan.planId === assignment.planId),
    )?.planId ?? null;
  if (assignedPlanId) return assignedPlanId;
  if (model.activeFreePlanId !== undefined) {
    return model.activeFreePlanId;
  }
  if (model.user) {
    return plans.find((plan) => plan.category === "free")?.planId ?? null;
  }
  return null;
};

/**
 * Plan IDs this entity currently holds or has scheduled.
 *
 * Feeds scoped app-plan eligibility, so it must include pending period-end
 * updates as well as live subscriptions and assignments.
 */
export const resolveActiveOrScheduledPlanIds = ({
  model,
  plans,
  subscriptionProductId,
}: {
  model: ConnectedBillingModel | null;
  plans: readonly UIPlanEntry[];
  subscriptionProductId: string | null;
}): string[] => {
  if (!model) return [];
  const planIds = new Set<string>();
  const addPlanId = (planId: string | null | undefined) => {
    if (planId && plans.some((plan) => plan.planId === planId)) {
      planIds.add(planId);
    }
  };
  const addProductId = (productId: string | null | undefined) => {
    const planId = findPlanIdByProductId(plans, productId);
    if (planId) planIds.add(planId);
  };

  addProductId(subscriptionProductId);
  addPlanId(model.activePlanId);
  addPlanId(model.activeFreePlanId);

  for (const subscription of model.activeSubscriptions ?? []) {
    addProductId(subscription.productId);
  }
  for (const assignment of model.appPlanAssignments ?? []) {
    if (assignment.status === "active" || assignment.status === "scheduled") {
      addPlanId(assignment.planId);
    }
  }
  for (const update of model.scheduledSubscriptionUpdates ?? []) {
    addProductId(update.targetProductId);
    addPlanId(update.targetPlanId);
  }

  return Array.from(planIds);
};

/** Apply catalog eligibility rules to the group-filtered plans. */
export const filterVisiblePlans = ({
  groupedPlans,
  allPlans,
  model,
  activePlanId,
  activeOrScheduledPlanIds,
}: {
  groupedPlans: readonly UIPlanEntry[];
  allPlans: readonly UIPlanEntry[];
  model: ConnectedBillingModel | null;
  activePlanId: string | null;
  activeOrScheduledPlanIds: readonly string[];
}): UIPlanEntry[] =>
  groupedPlans.filter((plan) =>
    shouldShowPlan(plan, model?.appPlanActivations, {
      activePlanId,
      activeOrScheduledPlanIds,
      catalogPlans: allPlans,
    }),
  );

/**
 * Billing cycles offered by a specific group, after eligibility filtering.
 *
 * Used when switching groups so the clamped cycle matches what will actually
 * render — the same rule `deriveAvailableCycles(visiblePlans)` applies for the
 * active group.
 */
export const cyclesForGroup = ({
  plans,
  groupItems,
  groupId,
  model,
  activePlanId,
  activeOrScheduledPlanIds,
}: {
  plans: readonly UIPlanEntry[];
  groupItems: readonly SubscriptionGroupItem[];
  groupId: string | null;
  model: ConnectedBillingModel | null;
  activePlanId: string | null;
  activeOrScheduledPlanIds: readonly string[];
}): RecurringCycle[] =>
  deriveAvailableCycles(
    filterVisiblePlans({
      groupedPlans: filterPlansByGroup({
        plans,
        groupItems,
        activeGroupId: groupId,
      }),
      allPlans: plans,
      model,
      activePlanId,
      activeOrScheduledPlanIds,
    }),
  );
