import { createContext } from "react";
import type {
  RecurringCycle,
  ScheduledSubscriptionUpdate,
  SupportedRecurringCycle,
  UIPlanEntry,
} from "../../core/types.js";
import type {
  BillingCurrencyFormatInput,
  BillingDateFormatInput,
  BillingLabels,
} from "../../core/i18n.js";
import type {
  ConnectedProduct,
  SubscriptionPlanRegistration,
} from "./types.js";

export type SubscriptionContextValue = {
  registerPlan: (plan: SubscriptionPlanRegistration) => () => void;
  getPlan: (planId: string) => UIPlanEntry | undefined;
  isPlanVisible: (planId: string) => boolean;
  selectedCycle?: RecurringCycle;
  activePlanId: string | null;
  products: ConnectedProduct[];
  subscriptionProductId: string | null;
  subscriptionStatus: string | null;
  subscriptionTrialEnd: string | null;
  scheduledUpdate: ScheduledSubscriptionUpdate | null;
  scheduledEffectiveDate: string | null;
  subscribedUnits: number | null;
  units?: number;
  showUnitPicker: boolean;
  /**
   * True when any visible plan offers a Creem-managed trial, so every card
   * reserves the caption row under its CTA and the grid rows stay aligned.
   */
  reserveTrialCaption: boolean;
  isGroupSubscribed: boolean;
  disableCheckout: boolean;
  disableSwitch: boolean;
  disableUnits: boolean;
  unstyled: boolean;
  /** Preferred pricing column count resolved by the root. */
  columns: "auto" | 1 | 2 | 3 | 4;
  labels: BillingLabels;
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  formatCurrency: (input: BillingCurrencyFormatInput) => string;
  formatDate: (input: BillingDateFormatInput) => string;
  checkout: (payload: {
    plan: UIPlanEntry;
    productId: string;
    units?: number;
  }) => Promise<void> | void;
  switchPlan?: (payload: {
    plan: UIPlanEntry;
    productId?: string;
    appPlanId?: string;
    freePlanId?: string;
    units?: number;
  }) => Promise<void> | void;
  updateUnits?: (payload: { units: number }) => Promise<void> | void;
  cancelSubscription?: () => void;
  groupItems: Array<{ value: string; label: string }>;
  activeGroupId: string | null;
  setGroup: (group: string) => void;
  availableCycles: RecurringCycle[];
  setCycle: (cycle: RecurringCycle) => void;
};

export const SubscriptionContext = createContext<
  SubscriptionContextValue | undefined
>(undefined);
