import { useMemo } from "react";
import { BillingToggle } from "./BillingToggle.js";
import { PricingCard } from "./PricingCard.js";
import type {
  UIPlanEntry,
  RecurringCycle,
  ScheduledSubscriptionUpdate,
  SupportedRecurringCycle,
} from "../../core/types.js";
import {
  defaultBillingLabels,
  type BillingCurrencyFormatInput,
  type BillingLabels,
} from "../../core/i18n.js";
import type { ConnectedProduct } from "../widgets/types.js";

export const PricingSection = ({
  plans = [],
  activePlanId,
  selectedCycle,
  products = [],
  subscriptionProductId,
  subscriptionStatus,
  subscriptionTrialEnd,
  scheduledUpdate,
  scheduledEffectiveDate,
  units,
  showUnitPicker = false,
  showCycleToggle = true,
  cycleBadges,
  columns = "auto",
  subscribedUnits,
  isGroupSubscribed = false,
  disableCheckout = false,
  disableSwitch = false,
  disableUnits = false,
  className = "",
  onCycleChange,
  onCheckout,
  onSwitchPlan,
  onUpdateUnits,
  onContactSales,
  onCancelSubscription,
  labels = defaultBillingLabels,
  formatCurrency,
}: {
  plans?: UIPlanEntry[];
  activePlanId?: string | null;
  selectedCycle?: RecurringCycle;
  products?: ConnectedProduct[];
  subscriptionProductId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionTrialEnd?: string | null;
  scheduledUpdate?: ScheduledSubscriptionUpdate | null;
  scheduledEffectiveDate?: string | null;
  units?: number;
  showUnitPicker?: boolean;
  showCycleToggle?: boolean;
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  columns?: "auto" | 1 | 2 | 3 | 4;
  subscribedUnits?: number | null;
  isGroupSubscribed?: boolean;
  disableCheckout?: boolean;
  disableSwitch?: boolean;
  disableUnits?: boolean;
  className?: string;
  onCycleChange?: (cycle: RecurringCycle) => void;
  onCheckout?: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  onSwitchPlan?: (payload: {
    plan: UIPlanEntry;
    productId?: string;
    appPlanId?: string;
    freePlanId?: string;
    units?: number;
  }) => Promise<void> | void;
  onUpdateUnits?: (payload: { units: number }) => Promise<void> | void;
  onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
  onCancelSubscription?: () => void;
  labels?: BillingLabels;
  formatCurrency?: (input: BillingCurrencyFormatInput) => string;
}) => {
  const primaryPlans = useMemo(
    () => plans.filter((plan) => plan.category !== "trial"),
    [plans],
  );
  const trialPlans = useMemo(
    () => plans.filter((plan) => plan.category === "trial"),
    [plans],
  );

  const availableCycles = useMemo(() => {
    const set = new Set<RecurringCycle>();
    for (const plan of primaryPlans) {
      for (const cycle of plan.billingCycles ?? []) {
        set.add(cycle);
      }
    }
    return Array.from(set);
  }, [primaryPlans]);

  const hasEnterprisePlan = primaryPlans.some(
    (p) => p.category === "enterprise",
  );
  const effectiveCycle = selectedCycle ?? availableCycles[0];
  const showToggle = showCycleToggle && availableCycles.length > 1;
  const gridColumnsClass = (() => {
    switch (columns) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-1 sm:grid-cols-2";
      case 3:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
      case "auto":
        if (showUnitPicker || primaryPlans.length <= 2) {
          return "grid-cols-1 sm:grid-cols-2";
        }
        return hasEnterprisePlan
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
    }
  })();

  // Only the section knows whether a sibling plan offers a trial, so it decides
  // whether every card reserves the caption row under its CTA. Each grid is its
  // own alignment context, so the two grids are measured separately.
  const reservesTrialCaption = (group: UIPlanEntry[]) =>
    group.some((candidate) => (candidate.trialDays ?? 0) > 0);
  const reserveTrialCaption = reservesTrialCaption(primaryPlans);
  const reserveTrialCaptionForTrials = reservesTrialCaption(trialPlans);

  return (
    <section className={className}>
      {showToggle && (
        <div className="mb-6 flex justify-center">
          <BillingToggle
            cycles={availableCycles}
            value={effectiveCycle}
            cycleBadges={cycleBadges}
            onValueChange={onCycleChange}
            labels={labels}
          />
        </div>
      )}

      <div className={`grid gap-1 ${gridColumnsClass}`}>
        {primaryPlans.map((plan) => (
          <PricingCard
            key={plan.planId}
            plan={plan}
            selectedCycle={effectiveCycle}
            activePlanId={activePlanId}
            subscriptionProductId={subscriptionProductId}
            subscriptionStatus={subscriptionStatus}
            subscriptionTrialEnd={subscriptionTrialEnd}
            scheduledUpdate={scheduledUpdate}
            scheduledEffectiveDate={scheduledEffectiveDate}
            products={products}
            units={units}
            showUnitPicker={showUnitPicker}
            reserveTrialCaption={reserveTrialCaption}
            subscribedUnits={subscribedUnits}
            isGroupSubscribed={isGroupSubscribed}
            disableCheckout={disableCheckout}
            disableSwitch={disableSwitch}
            disableUnits={disableUnits}
            onCheckout={onCheckout}
            onSwitchPlan={onSwitchPlan}
            onUpdateUnits={onUpdateUnits}
            onContactSales={onContactSales}
            onCancelSubscription={onCancelSubscription}
            labels={labels}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>

      {trialPlans.length > 0 && (
        <div className="mt-8 grid gap-1">
          {trialPlans.map((plan) => (
            <PricingCard
              key={plan.planId}
              plan={plan}
              selectedCycle={effectiveCycle}
              activePlanId={activePlanId}
              subscriptionProductId={subscriptionProductId}
              subscriptionStatus={subscriptionStatus}
              subscriptionTrialEnd={subscriptionTrialEnd}
              scheduledUpdate={scheduledUpdate}
              scheduledEffectiveDate={scheduledEffectiveDate}
              products={products}
              units={units}
              showUnitPicker={showUnitPicker}
              reserveTrialCaption={reserveTrialCaptionForTrials}
              subscribedUnits={subscribedUnits}
              isGroupSubscribed={isGroupSubscribed}
              disableCheckout={disableCheckout}
              disableSwitch={disableSwitch}
              disableUnits={disableUnits}
              onCheckout={onCheckout}
              onSwitchPlan={onSwitchPlan}
              onUpdateUnits={onUpdateUnits}
              onContactSales={onContactSales}
              onCancelSubscription={onCancelSubscription}
              labels={labels}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}
    </section>
  );
};
