import type {
  OneTimePaymentStatus,
  RecurringCycle,
  ResolvedUpdateBehavior,
  SupportedRecurringCycle,
} from "./types.js";

export type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? PartialDeep<T[K]>
      : T[K];
};

/**
 * Input handed to a custom `formatCurrency` implementation: the amount in minor
 * units plus its currency.
 */
export type BillingCurrencyFormatInput = {
  amount: number;
  currency: string;
  locale?: string;
};

/**
 * Input handed to a custom `formatDate` implementation.
 */
export type BillingDateFormatInput = {
  date: Date;
  locale?: string;
};

/**
 * The complete, resolved set of UI strings.
 *
 * Widgets read this shape; pass `BillingLabelOverrides` to change only some of
 * it.
 */
export type BillingLabels = {
  common: {
    loading: string;
    cancel: string;
    confirm: string;
    closeDialog: string;
  };
  billingCycle: Record<RecurringCycle, string>;
  priceInterval: Record<SupportedRecurringCycle, string>;
  accessibility: {
    decreaseValue: string;
    increaseValue: string;
    previousPage: string;
    nextPage: string;
    closeDialog: string;
  };
  checkout: {
    checkout: string;
    loading: string;
    buyNow: string;
    success: string;
    failed: string;
  };
  portal: {
    manageBilling: string;
    loading: string;
    failedToOpen: string;
  };
  subscription: {
    loadingBillingModel: string;
    currentPlan: string;
    current: string;
    scheduledPlan: string;
    scheduledPlanWithDate: (formattedDate: string) => string;
    recommended: string;
    freeTrial: string;
    startTrial: string;
    trialDaysLeft: (days: number) => string;
    /** Pre-checkout CTA for a plan with a Creem-managed trial. */
    startFreeTrial: string;
    /** Microcopy under that CTA, stating the trial length. */
    trialDaysFree: (days: number) => string;
    free: string;
    custom: string;
    switchInterval: string;
    switchPlan: string;
    buyNow: string;
    subscribe: string;
    getStarted: string;
    units: string;
    unitCount: (units: number) => string;
    unitPriceCalculation: (input: {
      unitPrice: string;
      units: number;
      total: string;
    }) => string;
    changeUnits: string;
    update: string;
    cancelSubscription: string;
    contactSales: string;
    configureCheckout: string;
    newPlan: string;
    checkoutFailed: string;
    switchFailed: string;
    unitUpdateFailed: string;
    cancelFailed: string;
    resumeFailed: string;
    dialogs: {
      cancelTitle: string;
      cancelDescription: (input: { formattedDate?: string }) => string;
      confirmCancel: string;
      keepSubscription: string;
      switchPlanTitle: string;
      updateUnitsTitle: string;
      confirmSwitch: string;
      confirmUpdate: string;
      behaviorDescription: (
        behavior: ResolvedUpdateBehavior,
        input?: { isDowngrade?: boolean },
      ) => string;
      periodEndNote: (input: {
        behavior: ResolvedUpdateBehavior;
        formattedDate: string;
      }) => string | null;
      trialEndNote: (formattedDate: string) => string;
      trialContinues: string;
    };
  };
  scheduledChange: {
    cancellationScheduled: string;
    updateScheduled: string;
    accessUntilPeriodEnd: (formattedDate?: string) => string;
    updateAtPeriodEnd: (formattedDate?: string) => string;
    targetUpdate: (target: string) => string;
    undoCancellation: string;
    undoUpdate: string;
    resuming: string;
  };
  paymentRecovery: {
    blocked: string;
    warning: string;
    updatePaymentMethod: string;
    openingPortal: string;
  };
  trialBanner: {
    /** Shown when the trial end date is unknown. */
    active: string;
    /** Shown when a trial end date is available. */
    activeUntil: (formattedDate: string) => string;
  };
  paymentWarning: {
    pending: string;
    partiallyRefunded: string;
    refunded: string;
  };
  billingHistory: {
    title: string;
    loading: string;
    loadError: string;
    unknown: string;
    columns: {
      date: string;
      description: string;
      type: string;
      status: string;
      amount: string;
    };
    loadingHistory: string;
    empty: string;
  };
  credits: {
    title: string;
    loading: string;
    refreshBalance: string;
    refreshing: string;
    idle: string;
    apiNotConfigured: string;
    loadFailed: string;
  };
  product: {
    owned: string;
    included: string;
    upgrade: string;
    buyNow: string;
    checkoutFailed: string;
  };
  oneTimePaymentStatus: Record<OneTimePaymentStatus, string>;
};

/**
 * Partial `BillingLabels`.
 *
 * Any key you leave out keeps its default string.
 */
export type BillingLabelOverrides = PartialDeep<BillingLabels>;

/**
 * Locale, label, and formatter overrides accepted by the provider and by
 * individual widgets.
 *
 * Every field is optional and falls back to the defaults.
 */
export type BillingI18n = {
  locale?: string;
  labels?: BillingLabelOverrides;
  formatCurrency?: (input: BillingCurrencyFormatInput) => string;
  formatDate?: (input: BillingDateFormatInput) => string;
};

export type ResolvedBillingI18n = {
  locale?: string;
  labels: BillingLabels;
  formatCurrency: (input: BillingCurrencyFormatInput) => string;
  formatDate: (input: BillingDateFormatInput) => string;
};

const defaultBehaviorDescription = (
  behavior: ResolvedUpdateBehavior,
  input?: { isDowngrade?: boolean },
): string => {
  switch (behavior) {
    case "proration-charge-immediately":
      if (input?.isDowngrade) {
        return "The price difference will be prorated and refunded immediately.";
      }
      return "The price difference will be prorated and charged immediately.";
    case "proration-charge":
      return "The price difference will be prorated and applied to your next invoice.";
    case "proration-none":
      return "The new price will take effect at your next billing cycle.";
    case "period-end":
      return "The current plan stays active until the end of the billing period, then the change is applied.";
    case "immediate":
      return "The current paid subscription will be canceled immediately.";
  }
};

export const defaultBillingLabels: BillingLabels = {
  common: {
    loading: "Loading...",
    cancel: "Cancel",
    confirm: "Confirm",
    closeDialog: "Close dialog",
  },
  billingCycle: {
    "every-month": "Monthly",
    "every-three-months": "Quarterly",
    "every-six-months": "Semi-annual",
    "every-year": "Yearly",
    custom: "Custom",
  },
  priceInterval: {
    "every-month": "/mo",
    "every-three-months": "/3mo",
    "every-six-months": "/6mo",
    "every-year": "/yr",
  },
  accessibility: {
    decreaseValue: "Decrease value",
    increaseValue: "Increase value",
    previousPage: "Previous page",
    nextPage: "Next page",
    closeDialog: "Close dialog",
  },
  checkout: {
    checkout: "Checkout",
    loading: "Loading...",
    buyNow: "Buy now",
    success: "Checkout completed successfully.",
    failed: "Checkout failed",
  },
  portal: {
    manageBilling: "Manage billing",
    loading: "Loading...",
    failedToOpen: "Failed to open billing portal",
  },
  subscription: {
    loadingBillingModel: "Loading billing model...",
    currentPlan: "Current plan",
    current: "Current",
    scheduledPlan: "Scheduled",
    scheduledPlanWithDate: (formattedDate) => `Scheduled for ${formattedDate}`,
    recommended: "Recommended",
    freeTrial: "Free trial",
    startTrial: "Start trial",
    trialDaysLeft: (days) => `${days} day${days === 1 ? "" : "s"} left`,
    startFreeTrial: "Start free trial",
    trialDaysFree: (days) => `${days} days free`,
    free: "Free",
    custom: "Custom",
    switchInterval: "Switch interval",
    switchPlan: "Switch plan",
    buyNow: "Buy now",
    subscribe: "Subscribe",
    getStarted: "Get started",
    units: "Units:",
    unitCount: (units) => `${units} unit${units === 1 ? "" : "s"}`,
    unitPriceCalculation: ({ unitPrice, units }) =>
      `${unitPrice} × ${units} unit${units === 1 ? "" : "s"}`,
    changeUnits: "Change units",
    update: "Update",
    cancelSubscription: "Cancel subscription",
    contactSales: "Contact sales",
    configureCheckout: "Configure a checkout handler to activate this plan.",
    newPlan: "New plan",
    checkoutFailed: "Checkout failed",
    switchFailed: "Switch failed",
    unitUpdateFailed: "Unit update failed",
    cancelFailed: "Cancel failed",
    resumeFailed: "Resume failed",
    dialogs: {
      cancelTitle: "Cancel subscription?",
      cancelDescription: ({ formattedDate }) =>
        `Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period${formattedDate ? ` (${formattedDate})` : ""}.`,
      confirmCancel: "Yes, cancel",
      keepSubscription: "Keep subscription",
      switchPlanTitle: "Switch plan?",
      updateUnitsTitle: "Update units?",
      confirmSwitch: "Confirm switch",
      confirmUpdate: "Confirm update",
      behaviorDescription: defaultBehaviorDescription,
      periodEndNote: ({ behavior, formattedDate }) => {
        if (behavior === "proration-charge") {
          return `Your next invoice is on ${formattedDate}.`;
        }
        if (behavior === "proration-none") {
          return `Your next billing cycle starts on ${formattedDate}.`;
        }
        if (behavior === "period-end") {
          return `The scheduled change will apply on ${formattedDate}.`;
        }
        return null;
      },
      trialEndNote: (formattedDate) =>
        `Your trial continues until ${formattedDate}. The new price will apply once the trial ends.`,
      trialContinues:
        "Your free trial will continue. The new price will take effect once the trial ends.",
    },
  },
  scheduledChange: {
    cancellationScheduled: "Cancellation scheduled",
    updateScheduled: "Plan change scheduled",
    accessUntilPeriodEnd: (formattedDate) =>
      `You will continue to have access until the end of your current billing period${formattedDate ? ` (${formattedDate})` : ""}.`,
    updateAtPeriodEnd: (formattedDate) =>
      `Your current plan stays active until the end of this billing period${formattedDate ? ` (${formattedDate})` : ""}. The scheduled change will apply after that.`,
    targetUpdate: (target) => `Scheduled change: ${target}`,
    undoCancellation: "Undo cancellation",
    undoUpdate: "Undo change",
    resuming: "Resuming...",
  },
  paymentRecovery: {
    blocked:
      "Your subscription payment has failed. Please update your payment method to restore access.",
    warning:
      "Your subscription payment is past due. Please update your payment method to avoid service interruption.",
    updatePaymentMethod: "Update payment method",
    openingPortal: "Opening portal...",
  },
  trialBanner: {
    active:
      "Trial plan active. Upgrade before your trial ends to avoid interruptions.",
    activeUntil: (formattedDate) => `Trial plan active until ${formattedDate}.`,
  },
  paymentWarning: {
    pending:
      "Your payment is pending confirmation. Wait for webhook confirmation before granting permanent access.",
    partiallyRefunded:
      "This payment was partially refunded. Review entitlements that depend on purchase amount.",
    refunded:
      "This payment was refunded. Access should generally be revoked or downgraded.",
  },
  billingHistory: {
    title: "Billing history",
    loading: "Loading...",
    loadError: "Could not load billing history",
    unknown: "Unknown",
    columns: {
      date: "Date",
      description: "Description",
      type: "Type",
      status: "Status",
      amount: "Amount",
    },
    loadingHistory: "Loading billing history...",
    empty: "No transactions yet",
  },
  credits: {
    title: "Credit Balance",
    loading: "Loading...",
    refreshBalance: "Refresh balance",
    refreshing: "Refreshing...",
    idle: "Idle",
    apiNotConfigured: "Credits API is not configured.",
    loadFailed: "Failed to load balance",
  },
  product: {
    owned: "Owned",
    included: "Included",
    upgrade: "Upgrade",
    buyNow: "Buy now",
    checkoutFailed: "Checkout failed",
  },
  oneTimePaymentStatus: {
    pending: "Pending",
    paid: "Paid",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value != null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

export const mergeBillingLabels = (
  overrides?: BillingLabelOverrides,
  base: BillingLabels = defaultBillingLabels,
): BillingLabels => {
  if (!overrides) return base;

  const merge = (
    baseValue: Record<string, unknown>,
    overrideValue: Record<string, unknown>,
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...baseValue };
    for (const [key, value] of Object.entries(overrideValue)) {
      if (value === undefined) continue;
      const existing = result[key];
      result[key] =
        isPlainObject(existing) && isPlainObject(value)
          ? merge(existing, value)
          : value;
    }
    return result;
  };

  return merge(
    base as unknown as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as unknown as BillingLabels;
};

export const resolveBillingI18n = (i18n?: BillingI18n): ResolvedBillingI18n => {
  const locale = i18n?.locale;
  return {
    locale,
    labels: mergeBillingLabels(i18n?.labels),
    formatCurrency:
      i18n?.formatCurrency ??
      (({ amount, currency, locale: inputLocale }) =>
        new Intl.NumberFormat(inputLocale ?? locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount / 100)),
    formatDate:
      i18n?.formatDate ??
      (({ date, locale: inputLocale }) =>
        date.toLocaleDateString(inputLocale ?? locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })),
  };
};
