import type {
  BillingType,
  CatalogProductRef,
  CreditGrant,
  PlanId,
  PlanCatalog,
  PlanCatalogEntry,
  PlanCategory,
  RecurringCycle,
  SupportedRecurringCycle,
  AppPlanActivation,
} from "./types.js";

/**
 * The state an eligibility rule is evaluated against: prior activations and the
 * entity's current plans.
 */
export type AppPlanEligibilityContext = {
  /**
   * Currently active catalog plan ID.
   * Keeps the active plan visible even when it is otherwise ineligible.
   */
  activePlanId?: string | null;
  /** Explicitly active or scheduled catalog plan IDs in this billing context. */
  activeOrScheduledPlanIds?: readonly string[];
  /** Catalog entries used to resolve scopes/categories for active plan IDs. */
  catalogPlans?: readonly PlanCatalogEntry[];
};

/** All billing cycles supported by the Creem API, in display order. */
export const SUPPORTED_RECURRING_CYCLES: SupportedRecurringCycle[] = [
  "every-month",
  "every-three-months",
  "every-six-months",
  "every-year",
];

const PLAN_CATEGORIES: PlanCategory[] = [
  "free",
  "trial",
  "paid",
  "enterprise",
  "custom",
];

const BILLING_TYPES: BillingType[] = ["recurring", "onetime", "custom"];

const PLAN_CATEGORY_SET = new Set(PLAN_CATEGORIES);
const BILLING_TYPE_SET = new Set(BILLING_TYPES);
const RECURRING_CYCLE_SET = new Set(SUPPORTED_RECURRING_CYCLES);

/**
 * Defines the app-owned billing catalog: the plan IDs your UI renders and the
 * Creem product IDs behind them.
 *
 * Pass the literal with `as const` so plan IDs stay literal types and `plansOf`
 * can reject a typo at compile time. The same catalog is used on the client for
 * rendering and on the server for fulfillment and eligibility.
 */
export const defineBillingCatalog = <const TCatalog extends PlanCatalog>(
  catalog: TCatalog,
): TCatalog => catalog;

/**
 * Selects plans from a catalog by ID, preserving their order.
 *
 * Plan IDs are checked against the catalog, so a renamed or misspelled plan is a
 * compile error rather than a card that silently fails to render.
 */
export const plansOf = <
  const TCatalog extends PlanCatalog,
  const TPlanIds extends readonly PlanId<TCatalog>[],
>(
  _catalog: TCatalog,
  planIds: TPlanIds,
): TPlanIds => planIds;

const toProductId = (ref: CatalogProductRef): string =>
  typeof ref === "string" ? ref : ref.productId;

/** Type guard: check if a string is a supported Creem billing cycle. */
export const isSupportedRecurringCycle = (
  value: string,
): value is SupportedRecurringCycle =>
  RECURRING_CYCLE_SET.has(value as SupportedRecurringCycle);

/** Normalize a billing cycle string to a `RecurringCycle`. Returns `"custom"` for unrecognized values, `undefined` for nullish. */
export const normalizeRecurringCycle = (
  value: string | null | undefined,
): RecurringCycle | undefined => {
  if (!value) {
    return undefined;
  }
  if (isSupportedRecurringCycle(value)) {
    return value;
  }
  return "custom";
};

/** Normalize a plan category string. Returns `"custom"` for unrecognized or nullish values. */
export const normalizePlanCategory = (
  value: string | null | undefined,
): PlanCategory => {
  if (!value) {
    return "custom";
  }
  if (PLAN_CATEGORY_SET.has(value as PlanCategory)) {
    return value as PlanCategory;
  }
  return "custom";
};

/** Normalize a billing type string. Returns `"custom"` for unrecognized or nullish values. */
export const normalizeBillingType = (
  value: string | null | undefined,
): BillingType => {
  if (!value) {
    return "custom";
  }
  if (BILLING_TYPE_SET.has(value as BillingType)) {
    return value as BillingType;
  }
  return "custom";
};

/** Normalize all entries in a plan catalog (categories, billing types, cycles). Returns `undefined` for nullish input. */
export const normalizePlanCatalog = (
  catalog: PlanCatalog | null | undefined,
): PlanCatalog | undefined => {
  if (!catalog) {
    return undefined;
  }
  return {
    ...catalog,
    plans: catalog.plans.map((plan) => ({
      ...plan,
      category: normalizePlanCategory(plan.category),
      billingType: normalizeBillingType(plan.billingType),
      billingCycles: (plan.billingCycles ?? [])
        .map((cycle) => normalizeRecurringCycle(cycle))
        .flatMap((cycle) => (cycle ? [cycle] : [])),
      creemProductIds:
        plan.creemProductIds ??
        (plan.products
          ? Object.fromEntries(
              Object.entries(plan.products).map(([cycle, ref]) => [
                cycle,
                toProductId(ref),
              ]),
            )
          : undefined),
    })),
  };
};

/** Find a plan in the catalog by its `planId`. */
export const findPlanById = (
  catalog: PlanCatalog | undefined,
  planId: string,
): PlanCatalogEntry | undefined => {
  if (!catalog) {
    return undefined;
  }
  return catalog.plans.find((plan) => plan.planId === planId);
};

/** Find a plan in the catalog that contains the given Creem product ID in its `creemProductIds`. */
export const findPlanByProductId = (
  catalog: PlanCatalog | undefined,
  productId: string | undefined,
): PlanCatalogEntry | undefined => {
  if (!catalog || !productId) {
    return undefined;
  }
  return catalog.plans.find((plan) =>
    Object.values(plan.creemProductIds ?? {}).includes(productId),
  );
};

/** Find the app-side credit grant configured for a Creem product ID. */
export const findCreditGrantByProductId = (
  catalog: PlanCatalog | undefined,
  productId: string | undefined,
): CreditGrant | undefined =>
  findPlanByProductId(catalog, productId)?.creditGrant;

/** Whether a catalog plan is owned by the host app rather than a Creem checkout. */
export const isAppOwnedPlan = (plan: PlanCatalogEntry): boolean =>
  plan.category !== "enterprise" &&
  (plan.billingType === "custom" ||
    plan.category === "free" ||
    plan.category === "trial" ||
    plan.category === "custom");

/** Whether an app-owned plan has already been activated for this billing entity. */
export const hasAppPlanActivation = (
  activations: readonly AppPlanActivation[] | undefined,
  planId: string,
): boolean =>
  (activations ?? []).some((activation) => activation.planId === planId);

/** Whether an app-owned plan is currently eligible under its catalog policy. */
export const isAppPlanEligible = (
  plan: PlanCatalogEntry,
  activations: readonly AppPlanActivation[] | undefined,
  context: AppPlanEligibilityContext = {},
): boolean => {
  const activePlanId = context.activePlanId;
  const activeOrScheduledPlanIds = new Set(context.activeOrScheduledPlanIds);

  if (activePlanId === plan.planId) {
    return true;
  }
  if (activeOrScheduledPlanIds.has(plan.planId)) {
    return true;
  }
  if (
    plan.eligibility?.expiresWhenScopeHasNonTrialPlan &&
    plan.eligibilityScopeId &&
    context.catalogPlans
  ) {
    const scopeHasNonTrialPlan = context.catalogPlans.some(
      (catalogPlan) =>
        catalogPlan.planId !== plan.planId &&
        catalogPlan.eligibilityScopeId === plan.eligibilityScopeId &&
        catalogPlan.category !== "trial" &&
        activeOrScheduledPlanIds.has(catalogPlan.planId),
    );
    if (scopeHasNonTrialPlan) {
      return false;
    }
  }
  if (!plan.eligibility?.oncePerEntity) {
    return true;
  }
  return !hasAppPlanActivation(activations, plan.planId);
};

/** Whether the default composed pricing widgets should render this plan. */
export const shouldShowPlan = (
  plan: PlanCatalogEntry,
  activations: readonly AppPlanActivation[] | undefined,
  context: AppPlanEligibilityContext = {},
): boolean =>
  isAppPlanEligible(plan, activations, context) ||
  !plan.eligibility?.hideWhenIneligible;

export const resolvePlanProductId = (
  catalog: PlanCatalog | undefined,
  planId: string,
  cycle: RecurringCycle,
): string => {
  const plan = findPlanById(catalog, planId);
  if (!plan) {
    throw new Error(`Unknown billing plan "${planId}"`);
  }
  const productIds = plan.creemProductIds;
  const productId = productIds?.[cycle] ?? productIds?.custom;
  if (!productId) {
    throw new Error(`Billing plan "${planId}" has no product for "${cycle}"`);
  }
  return productId;
};

const hasProductMappings = (plan: PlanCatalogEntry | undefined): boolean =>
  Object.keys(plan?.creemProductIds ?? {}).length > 0 ||
  Object.keys(plan?.products ?? {}).length > 0;

/**
 * Merge plan catalogs from least to most specific.
 *
 * Widgets can receive a catalog from three places: the server (published on
 * `ConnectedBillingModel.catalog`), the provider, and the widget's own
 * `catalog` prop. Later arguments win per field, but a later entry never
 * clears product mappings an earlier one supplied — an app that overrides only
 * a plan's title must not lose the server's product IDs and end up rendering a
 * card with no price and a dead CTA.
 *
 * Plan order follows first appearance across the inputs.
 */
export const mergePlanCatalogs = (
  ...catalogs: Array<PlanCatalog | null | undefined>
): PlanCatalog | undefined => {
  const defined = catalogs.filter(
    (entry): entry is PlanCatalog => entry != null,
  );
  if (defined.length === 0) return undefined;

  const order: string[] = [];
  const plansById = new Map<string, PlanCatalogEntry>();

  for (const entry of defined) {
    for (const plan of entry.plans) {
      const existing = plansById.get(plan.planId);
      if (!existing) {
        order.push(plan.planId);
        plansById.set(plan.planId, plan);
        continue;
      }

      const merged: PlanCatalogEntry = {
        ...existing,
        ...plan,
        creemProductIds:
          Object.keys(plan.creemProductIds ?? {}).length > 0
            ? plan.creemProductIds
            : existing.creemProductIds,
        products:
          Object.keys(plan.products ?? {}).length > 0
            ? plan.products
            : existing.products,
      };
      if (!hasProductMappings(merged) && hasProductMappings(existing)) {
        merged.creemProductIds = existing.creemProductIds;
        merged.products = existing.products;
      }
      plansById.set(plan.planId, merged);
    }
  }

  // Scalars follow the same "later wins" rule as plan fields: scan backwards for
  // the most specific catalog that actually supplies the field. Reading only the
  // last entry with a fallback to the first would skip a middle catalog — the
  // provider's `defaultPlanId` would lose to the server's whenever the widget's
  // own catalog omits it.
  const lastDefined = <TKey extends keyof PlanCatalog>(
    key: TKey,
  ): PlanCatalog[TKey] | undefined => {
    for (let index = defined.length - 1; index >= 0; index -= 1) {
      const value = defined[index][key];
      if (value !== undefined) return value;
    }
    return undefined;
  };

  return {
    version: lastDefined("version") ?? defined[0].version,
    defaultPlanId: lastDefined("defaultPlanId"),
    plans: order.flatMap((planId) => {
      const plan = plansById.get(planId);
      return plan ? [plan] : [];
    }),
  };
};
