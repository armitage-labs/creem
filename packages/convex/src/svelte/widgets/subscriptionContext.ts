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
  getSelectedCycle: () => RecurringCycle | undefined;
  getActivePlanId: () => string | null;
  getProducts: () => ConnectedProduct[];
  getSubscriptionProductId: () => string | null;
  getSubscriptionStatus: () => string | null;
  getSubscriptionTrialEnd: () => string | null;
  getScheduledUpdate: () => ScheduledSubscriptionUpdate | null;
  getScheduledEffectiveDate: () => string | null;
  getSubscribedUnits: () => number | null;
  getUnits: () => number | undefined;
  getShowUnitPicker: () => boolean;
  getIsGroupSubscribed: () => boolean;
  getDisableCheckout: () => boolean;
  getDisableSwitch: () => boolean;
  getDisableUnits: () => boolean;
  getUnstyled: () => boolean;
  /** Preferred pricing column count resolved by the root. */
  getColumns: () => "auto" | 1 | 2 | 3 | 4;
  getLabels: () => BillingLabels;
  getCycleBadge: (cycle: SupportedRecurringCycle) => string | undefined;
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
  groupItems: () => Array<{ value: string; label: string }>;
  activeGroupId: () => string | null;
  setGroup: (group: string) => void;
  availableCycles: () => RecurringCycle[];
  setCycle: (cycle: RecurringCycle) => void;
};

export const SUBSCRIPTION_CONTEXT_KEY = Symbol("creem.subscription.context");
