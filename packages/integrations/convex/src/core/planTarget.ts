import { isAppOwnedPlan } from "./catalog.js";
import type { PlanCatalogEntry } from "./types.js";

/** Canonical action target for a catalog plan in connected billing widgets. */
export type PlanTarget =
  | { kind: "app-plan"; appPlanId: string }
  | { kind: "creem-product"; productId: string }
  | { kind: "contact-sales"; contactUrl?: string }
  | { kind: "unconfigured" };

/**
 * Resolve who owns fulfillment for a plan.
 *
 * Category checks must not be repeated in framework widgets: this function is
 * the single boundary between app-owned access, Creem commerce, and sales-led
 * enterprise plans.
 */
export const resolvePlanTarget = (
  plan: PlanCatalogEntry,
  productId?: string | null,
): PlanTarget => {
  if (plan.category === "enterprise") {
    return {
      kind: "contact-sales",
      ...(plan.contactUrl ? { contactUrl: plan.contactUrl } : {}),
    };
  }
  if (isAppOwnedPlan(plan)) {
    return { kind: "app-plan", appPlanId: plan.planId };
  }
  if (productId) {
    return { kind: "creem-product", productId };
  }
  return { kind: "unconfigured" };
};
