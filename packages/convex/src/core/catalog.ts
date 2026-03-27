import type {
  BillingType,
  PlanCatalog,
  PlanCatalogEntry,
  PlanCategory,
  RecurringCycle,
  SupportedRecurringCycle,
} from "./types.js";

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
