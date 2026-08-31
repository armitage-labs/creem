import { getContext } from "svelte";
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

export const SUBSCRIPTION_ITEM_CONTEXT_KEY = Symbol(
  "creem.subscription.item.context",
);

/** Get the current Subscription.Item context. Throws if used outside a Subscription.Item. */
export const getSubscriptionItemContext = (): SubscriptionItemContextValue => {
  const ctx = getContext<SubscriptionItemContextValue | undefined>(
    SUBSCRIPTION_ITEM_CONTEXT_KEY,
  );
  if (!ctx) {
    throw new Error(
      "getSubscriptionItemContext must be used inside a <Subscription.Item> component",
    );
  }
  return ctx;
};
