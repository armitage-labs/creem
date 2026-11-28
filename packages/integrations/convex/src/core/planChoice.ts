import { resolveProductIdForPlan } from "./display.js";
import type { RecurringCycle, UIPlanEntry } from "./types.js";

/** One option of the plan choice (`layout="choice"`). */
export type PlanChoiceOption = {
  plan: UIPlanEntry;
  /** The Creem product a checkout of this plan buys at the selected cycle. */
  productId: string | undefined;
  /** The entity is subscribed to exactly this product: shown, not choosable. */
  current: boolean;
};

/**
 * The plans a person can check out from a single choice: the paid plans of the
 * catalog with their product at the selected cycle. Free, trial and enterprise
 * plans, and app-owned plans without a Creem product, have no checkout and are
 * left out.
 */
export const choosablePlans = (
  plans: readonly UIPlanEntry[],
  selectedCycle: RecurringCycle | undefined,
  subscriptionProductId: string | null = null,
): PlanChoiceOption[] =>
  plans
    .filter(
      (plan) =>
        plan.category !== "free" &&
        plan.category !== "trial" &&
        plan.category !== "enterprise",
    )
    .map((plan) => {
      const productId = resolveProductIdForPlan(plan, selectedCycle);
      return {
        plan,
        productId,
        current:
          productId !== undefined &&
          subscriptionProductId !== null &&
          productId === subscriptionProductId,
      };
    })
    .filter((option) => option.productId !== undefined);

/**
 * The plan chosen at first: the requested one, else the recommended one, else
 * the first, never the current one. Null when nothing can be chosen.
 */
export const initialChoice = (
  options: readonly PlanChoiceOption[],
  defaultPlanId?: string,
): string | null => {
  const open = options.filter((option) => !option.current);
  return (
    open.find((option) => option.plan.planId === defaultPlanId)?.plan.planId ??
    open.find((option) => option.plan.recommended)?.plan.planId ??
    open[0]?.plan.planId ??
    null
  );
};
