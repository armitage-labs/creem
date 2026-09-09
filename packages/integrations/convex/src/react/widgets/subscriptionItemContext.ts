import { createContext, useContext } from "react";
import type { UIPlanEntry, RecurringCycle } from "../../core/types.js";
import type { BillingLabels } from "../../core/i18n.js";

/** Context value exposed to Subscription.Item slot components. */
export type SubscriptionItemContextValue = {
  plan: UIPlanEntry;
  isActive: boolean;
  isSwitchPlan: boolean;
  isScheduledTarget: boolean;
  scheduledEffectiveDate: string | null;
  isRecommended: boolean;
  selectedCycle: RecurringCycle;
  currentProductId: string | undefined;
  price: string | null;
  priceCaption: string | null;
  checkoutUnits: number;
  subscribedUnits: number | null;
  disableUnits: boolean;
  /** Checkout is not permitted (`permissions.canCheckout === false`). */
  disableCheckout: boolean;
  /** Plan changes are not permitted (`permissions.canChangeSubscription === false`). */
  disableSwitch: boolean;
  unstyled: boolean;
  labels: BillingLabels;
  setCheckoutUnits: (units: number) => void;
  onCheckout?: () => void;
  onSwitch?: () => void;
  onUpdateUnits?: (units: number) => void;
  onCancelSubscription?: () => void;
};

export const SubscriptionItemContext = createContext<
  SubscriptionItemContextValue | undefined
>(undefined);

/** Hook to access the current Subscription.Item context. Throws if used outside a Subscription.Item. */
export const useSubscriptionItem = (): SubscriptionItemContextValue => {
  const ctx = useContext(SubscriptionItemContext);
  if (!ctx) {
    throw new Error(
      "useSubscriptionItem must be used inside a <Subscription.Item> component",
    );
  }
  return ctx;
};
