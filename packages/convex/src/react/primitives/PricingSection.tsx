import { useMemo } from "react";
import { BillingToggle } from "./BillingToggle.js";
import { PricingCard } from "./PricingCard.js";
import type {
  BillingSnapshot,
  UIPlanEntry,
  RecurringCycle,
} from "../../core/types.js";
import type { ConnectedProduct } from "../widgets/types.js";

export const PricingSection = ({
  plans = [],
  snapshot,
  selectedCycle,
  products = [],
  subscriptionProductId,
  subscriptionStatus,
  subscriptionTrialEnd,
  units,
  showSeatPicker = false,
  twoColumnLayout = false,
  subscribedSeats,
  isGroupSubscribed = false,
  disableCheckout = false,
  disableSwitch = false,
  disableSeats = false,
  className = "",
  onCycleChange,
  onCheckout,
  onSwitchPlan,
  onUpdateSeats,
  onContactSales,
  onCancelSubscription,
}: {
  plans?: UIPlanEntry[];
  snapshot?: BillingSnapshot | null;
  selectedCycle?: RecurringCycle;
  products?: ConnectedProduct[];
  subscriptionProductId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionTrialEnd?: string | null;
  units?: number;
  showSeatPicker?: boolean;
  twoColumnLayout?: boolean;
  subscribedSeats?: number | null;
  isGroupSubscribed?: boolean;
  disableCheckout?: boolean;
  disableSwitch?: boolean;
  disableSeats?: boolean;
  className?: string;
  onCycleChange?: (cycle: RecurringCycle) => void;
  onCheckout?: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  onSwitchPlan?: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  onUpdateSeats?: (payload: { units: number }) => Promise<void> | void;
  onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
  onCancelSubscription?: () => void;
}) => {
  const availableCycles = useMemo(() => {
    const set = new Set<RecurringCycle>();
    for (const plan of plans) {
      for (const cycle of plan.billingCycles ?? []) {
        set.add(cycle);
      }
    }
    return Array.from(set);
  }, [plans]);

  const hasEnterprisePlan = plans.some((p) => p.category === "enterprise");
  const effectiveCycle =
    selectedCycle ?? snapshot?.recurringCycle ?? availableCycles[0];
  const showToggle = availableCycles.length > 1;

  return (
    <section className={className}>
      {showToggle && (
        <div className="mb-[6.5rem] flex justify-center">
          <BillingToggle
            cycles={availableCycles}
            value={effectiveCycle}
            onValueChange={onCycleChange}
          />
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-1 ${
          showSeatPicker || twoColumnLayout
            ? "md:grid-cols-2"
            : hasEnterprisePlan
              ? "sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              : "sm:grid-cols-2 md:grid-cols-3"
        }`}
      >
        {plans.map((plan) => (
          <PricingCard
            key={plan.planId}
            plan={plan}
            selectedCycle={effectiveCycle}
            activePlanId={snapshot?.activePlanId}
            subscriptionProductId={subscriptionProductId}
            subscriptionStatus={subscriptionStatus}
            subscriptionTrialEnd={subscriptionTrialEnd}
            products={products}
            units={units}
            showSeatPicker={showSeatPicker}
            subscribedSeats={subscribedSeats}
            isGroupSubscribed={isGroupSubscribed}
            disableCheckout={disableCheckout}
            disableSwitch={disableSwitch}
            disableSeats={disableSeats}
            onCheckout={onCheckout}
            onSwitchPlan={onSwitchPlan}
            onUpdateSeats={onUpdateSeats}
            onContactSales={onContactSales}
            onCancelSubscription={onCancelSubscription}
          />
        ))}
      </div>
    </section>
  );
};
