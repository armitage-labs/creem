import type {
  AvailableActionFromValidator,
  PaymentRecoveryStateFromValidator,
  RecurringCycleFromValidator,
} from "./validators.js";

/**
 * Structural billing types are derived from the Convex validators in
 * `validators.ts` so the wire format and the TypeScript contract cannot drift.
 * The simple string unions below stay hand-written for readable docs and are
 * asserted against their validators at the bottom of this file.
 */
export type {
  AppPlanActivation,
  AppPlanAssignment,
  BillingAccessItem,
  BillingSnapshot,
  BillingSnapshotOrder,
  BillingSnapshotSubscription,
  ConnectedActiveSubscription,
  ConnectedBillingUser,
  ConnectedPagination,
  ConnectedProduct,
  ConnectedTransaction,
  ConnectedTransactionList,
  ScheduledSubscriptionUpdate,
  CreditBalance,
  CreditEntry,
  CreditEntryList,
  CheckoutCreateArgs,
  SubscriptionUpdateArgs,
  SubscriptionUpdateWireArgs,
  SubscriptionCancelArgs,
  SubscriptionResumeArgs,
  SubscriptionCancelScheduledUpdateArgs,
  SubscriptionPauseArgs,
  AppPlanActivateArgs,
  TransactionsSearchArgs,
  CreditsListEntriesArgs,
} from "./validators.js";

/** Category of a billing plan. Determines default UI behavior and available actions. */
export type PlanCategory = "free" | "trial" | "paid" | "enterprise" | "custom";

/** Billing model type. `"recurring"` for subscriptions, `"onetime"` for single purchases. */
export type BillingType = "recurring" | "onetime" | "custom";

/** Billing cycles supported by the Creem API. */
export type SupportedRecurringCycle =
  | "every-month"
  | "every-three-months"
  | "every-six-months"
  | "every-year";

/** Billing cycle including a `"custom"` fallback for unrecognized intervals. */
export type RecurringCycle = SupportedRecurringCycle | "custom";

/** Status of a one-time payment order. */
export type OneTimePaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "partially_refunded";

/**
 * Actions the current billing entity is allowed to perform.
 * Resolved by `resolveBillingSnapshot` based on subscription state.
 * Use with `<BillingGate requiredActions="...">` for conditional UI rendering.
 */
export type AvailableAction =
  | "checkout"
  | "portal"
  | "cancel"
  | "reactivate"
  | "switch_interval"
  | "update_units"
  | "contact_sales";

/**
 * Payment recovery state derived from subscription status.
 * - `"none"` — all subscriptions healthy
 * - `"warning"` — a subscription is past due but still active
 * - `"blocked"` — a subscription is unpaid or expired
 */
export type PaymentRecoveryState = "none" | "warning" | "blocked";

export type CatalogProductRef =
  | string
  | {
      productId: string;
      productSlug?: string;
    };

export type CreditGrantRefundBehavior =
  | "revoke_on_full_refund"
  | "prorate"
  | "debit"
  | "none";

/** App-side Customer Credits grant fulfilled after successful Creem commerce events. */
export type CreditGrant = {
  /** Amount of credits to grant. String to preserve large integer values. */
  amount: string;
  /** Creem Customer Credits account name. Defaults to `"credits"`. */
  accountName?: string;
  /** Unit label to use if the account must be created. Defaults to `"credits"`. */
  unitLabel?: string;
  /**
   * Refund behavior for the grant.
   * - `"revoke_on_full_refund"` deducts the full grant only when a refund covers the full order amount. This is the default.
   * - `"prorate"` deducts a proportional amount for partial refunds and the full grant for full refunds.
   * - `"debit"` deducts the full grant whenever a refund succeeds.
   * - `"none"` leaves credits untouched.
   */
  refundBehavior?: CreditGrantRefundBehavior;
};

/**
 * Eligibility policy for app-owned plans such as no-card trials, free plans,
 * beta access, or other custom entitlements that are activated by the host app.
 */
export type AppPlanEligibility = {
  /**
   * Allow this plan to be activated only once for a billing entity.
   * Use for no-card app trials where replaying the trial after downgrade/cancel
   * would be abuse.
   */
  oncePerEntity?: boolean;
  /**
   * Make this plan ineligible when another non-trial plan in the same
   * `eligibilityScopeId` is active or scheduled.
   *
   * Use for scoped no-card trials, e.g. a base-plan trial that should disappear
   * after choosing a base plan, while addon trials remain available until that
   * addon scope is chosen.
   */
  expiresWhenScopeHasNonTrialPlan?: boolean;
  /**
   * Hide the card when this plan is no longer eligible and it is not the active plan.
   * When false/omitted, custom compositions may still show or disable the option.
   */
  hideWhenIneligible?: boolean;
  /** Optional UI copy for apps that choose to show disabled ineligible plans. */
  ineligibleLabel?: string;
};

/** A single plan definition in the billing catalog. */
export type PlanCatalogEntry = {
  /** Unique plan identifier (e.g. `"basic"`, `"premium"`). */
  planId: string;
  /** Plan category — drives default UI behavior and action resolution. */
  category: PlanCategory;
  /** Billing model. Defaults to `"recurring"` if omitted. */
  billingType?: BillingType;
  /** Supported billing cycles for this plan (e.g. `["every-month", "every-year"]`). */
  billingCycles?: RecurringCycle[];
  /** Optional app-facing pricing audience or product-line group (e.g. `"individual"`, `"teams"`). */
  groupId?: string;
  /** Optional display label for `groupId`. */
  groupTitle?: string;
  /**
   * Optional eligibility scope for mutually exclusive alternatives.
   * Plans sharing the same scope can affect scoped app-owned trial eligibility
   * without coupling that logic to pricing layout groups.
   */
  eligibilityScopeId?: string;
  /** Optional app-authored plan title. Creem product name is used when omitted. */
  title?: string;
  /** Optional app-authored plan description. Creem product description is used when omitted. */
  description?: string;
  /** Pricing model — `"unit"` enables quantity/unit controls in widgets. */
  pricingModel?: "flat" | "unit";
  /** Preferred recurring product map for catalog-backed widgets. */
  products?: Readonly<Record<string, CatalogProductRef>>;
  /** Map of billing cycle → Creem product ID (e.g. `{ "every-month": "prod_xxx" }`). */
  creemProductIds?: Readonly<Record<string, string>>;
  /** "Contact sales" URL for enterprise plans. */
  contactUrl?: string;
  /** Highlight this plan as recommended in the UI. */
  recommended?: boolean;
  /** Plan-specific usage limits. Keys are app-defined limit names, values are numeric caps. Used by `evaluateUsageLimits`. */
  limits?: Readonly<Record<string, number>>;
  /** Optional app-side Customer Credits grant fulfilled from webhook events for this product. */
  creditGrant?: CreditGrant;
  /** Optional eligibility policy for app-owned plan activations. */
  eligibility?: AppPlanEligibility;
  /** Arbitrary metadata for custom logic. */
  metadata?: Readonly<Record<string, unknown>>;
};

/** Plan catalog entry enriched with resolved UI display fields from Creem product data. */
export type UIPlanEntry = PlanCatalogEntry & {
  /** Display title (auto-resolved from Creem product name if omitted). */
  title?: string;
  /** Display description (auto-resolved from Creem product description, rendered as Markdown). */
  description?: string;
};

/** Static plan catalog configuration. Defines available plans and their Creem product mappings. */
export type PlanCatalog = {
  /** Catalog version string (included in `BillingSnapshot.catalogVersion`). */
  version: string;
  /** Ordered list of plan definitions. */
  plans: readonly PlanCatalogEntry[];
  /** Plan ID to use when no subscription is active (e.g. `"free"`). */
  defaultPlanId?: string;
};

export type PlanId<TCatalog extends { plans: readonly { planId: string }[] }> =
  TCatalog["plans"][number]["planId"];

/** Lightweight subscription state used by the billing resolver. */
export type SubscriptionSnapshot = {
  /** Creem subscription ID. */
  id?: string;
  /** Creem product ID of the subscribed plan. */
  productId?: string;
  /** Subscription status (e.g. `"active"`, `"trialing"`, `"canceled"`, `"paused"`, `"scheduled_cancel"`). */
  status?: string;
  /** Billing interval (e.g. `"every-month"`, `"every-year"`). */
  recurringInterval?: string | null;
  /** Number of units. A unit may represent a seat, credit pack quantity, or another billable unit. */
  units?: number | null;
  /** Whether the subscription is set to cancel at the end of the current period. */
  cancelAtPeriodEnd?: boolean;
  /** ISO timestamp of the current period end. */
  currentPeriodEnd?: string | null;
  /** ISO timestamp when the trial expires. */
  trialEnd?: string | null;
};

/** Snapshot of a one-time payment, parsed from checkout success query params. */
export type PaymentSnapshot = {
  /** Payment status. */
  status: OneTimePaymentStatus;
  /** Creem checkout ID. */
  checkoutId?: string;
  /** Creem order ID. */
  orderId?: string;
  /** Creem customer ID. */
  customerId?: string;
  /** Creem product ID. */
  productId?: string;
  /** Your custom request ID (passed via checkout metadata). */
  requestId?: string;
};

/** Query parameters from a Creem checkout success redirect URL. Parsed by `parseCheckoutSuccessParams`. */
export type CheckoutSuccessParams = {
  /** Creem checkout session ID (`checkout_id` query param). */
  checkoutId?: string;
  /** Creem order ID (`order_id` query param). */
  orderId?: string;
  /** Creem customer ID (`customer_id` query param). */
  customerId?: string;
  /** Creem product ID (`product_id` query param). */
  productId?: string;
  /** Your custom request ID (`request_id` query param). */
  requestId?: string;
  /** Creem signature for verification (`signature` query param). */
  signature?: string;
};

/**
 * Intent object passed to `onBeforeCheckout` and stored by `pendingCheckout`.
 * Represents the product and optional unit count the user wants to purchase.
 */
export type CheckoutIntent = {
  /** Creem product ID to purchase. */
  productId: string;
  /** Number of units for unit-based plans. A unit may represent a seat. */
  units?: number;
};

/** Prorate and charge the price difference immediately. Creem paid subscription updates only. */
export type ProrationChargeImmediatelyBehavior = "proration-charge-immediately";

/** Prorate the price difference and apply it to the next invoice. Creem paid subscription updates only. */
export type ProrationChargeBehavior = "proration-charge";

/** Apply the paid subscription update without proration. Creem paid subscription updates only. */
export type ProrationNoneBehavior = "proration-none";

/** Keep current paid access until the period boundary, then apply the update or free-plan assignment. */
export type PeriodEndUpdateBehavior = "period-end";

/** Cancel the paid subscription immediately and activate the app-owned target plan now. Paid-to-free/app-plan switches only. */
export type ImmediateFreePlanUpdateBehavior = "immediate";

/** Creem paid subscription update behavior for paid-to-paid plan switches and unit changes. */
export type PaidSubscriptionUpdateBehavior =
  | ProrationChargeImmediatelyBehavior
  | ProrationChargeBehavior
  | ProrationNoneBehavior
  | PeriodEndUpdateBehavior;

/** Cancellation behavior for paid-to-free or paid-to-app-owned plan switches. */
export type FreePlanUpdateBehavior =
  | PeriodEndUpdateBehavior
  | ImmediateFreePlanUpdateBehavior;

/** Backwards-compatible name for paid subscription update behavior. */
export type UpdateBehavior = PaidSubscriptionUpdateBehavior;

/** Internal resolved behavior sent to the update mutation. */
export type ResolvedUpdateBehavior =
  | PaidSubscriptionUpdateBehavior
  | FreePlanUpdateBehavior;

type BaseUpdateBehaviorIntent = {
  fromPlanId?: string | null;
  toPlanId?: string | null;
  fromPlan?: PlanCatalogEntry | null;
  toPlan?: PlanCatalogEntry | null;
  fromProductId?: string | null;
  toProductId?: string | null;
  fromPrice?: number | null;
  toPrice?: number | null;
  currentUnits?: number | null;
  targetUnits?: number;
};

export type PaidPlanUpdateBehaviorIntent = BaseUpdateBehaviorIntent & {
  /** Paid product switch. `updateBehavior` may return Creem proration values or `"period-end"`. */
  kind: "plan-switch";
  target: "paid-plan";
};

export type UnitUpdateBehaviorIntent = BaseUpdateBehaviorIntent & {
  /** Unit/seat quantity update. `updateBehavior` may return Creem proration values or `"period-end"`. */
  kind: "unit-update";
  target: "units";
};

export type FreePlanUpdateBehaviorIntent = BaseUpdateBehaviorIntent & {
  /** Paid subscription to app-owned target plan. `freePlanUpdateBehavior` may return only `"period-end"` or `"immediate"`. */
  kind: "plan-switch";
  target: "free-plan";
  freePlanId: string;
  appPlanId?: string;
};

/** Intent passed to `updateBehavior` for paid subscription updates. */
export type UpdateBehaviorIntent =
  | PaidPlanUpdateBehaviorIntent
  | UnitUpdateBehaviorIntent;

export type UpdateBehaviorResolver = (
  intent: UpdateBehaviorIntent,
) => UpdateBehavior;

export type UpdateBehaviorSetting = UpdateBehavior | UpdateBehaviorResolver;

export type FreePlanUpdateBehaviorResolver = (
  intent: FreePlanUpdateBehaviorIntent,
) => FreePlanUpdateBehavior;

export type FreePlanUpdateBehaviorSetting =
  | FreePlanUpdateBehavior
  | FreePlanUpdateBehaviorResolver;

/** Get a human-readable description for a plan switch based on the proration behavior. */
export const getSwitchPlanDescription = (
  updateBehavior: ResolvedUpdateBehavior,
  planTitle?: string,
): string => {
  const prefix = planTitle
    ? `You are about to switch to the ${planTitle} plan.`
    : "You are about to switch your plan.";

  switch (updateBehavior) {
    case "proration-charge-immediately":
      return `${prefix} The price difference will be prorated and charged immediately.`;
    case "proration-charge":
      return `${prefix} The price difference will be prorated and applied to your next invoice.`;
    case "proration-none":
      return `${prefix} The new price will take effect at your next billing cycle.`;
    case "period-end":
      return `${prefix} The current plan stays active until the end of the current billing period.`;
    case "immediate":
      return `${prefix} The current paid subscription will be canceled immediately.`;
  }
};

/** A single evaluated usage-limit check result. */
export type UsageLimitEntry = {
  /** Current usage count provided by the app. */
  used: number;
  /** Limit from the catalog plan's `limits` metadata, or `Infinity` when unlimited. */
  limit: number;
  /** Whether the usage has reached or exceeded the limit. */
  exceeded: boolean;
};

/** Result of `evaluateUsageLimits`. Keys match the limit keys defined in the catalog plan. */
export type UsageLimitResult = Record<string, UsageLimitEntry>;

/**
 * Intent object passed to `onBeforePlanChange`.
 * Describes the plan change the user is about to make.
 */
export type PlanChangeIntent = {
  /** Plan ID the user is switching from, or `null` if no current plan. */
  fromPlanId: string | null;
  /** Plan ID the user is switching to. */
  toPlanId: string;
  /** Creem product ID of the target paid plan. Undefined for app-owned free plans. */
  productId?: string;
  /** Stable app plan ID of the target app-owned plan. */
  appPlanId?: string;
  /** Stable app plan ID of the target free plan. */
  freePlanId?: string;
  /** Number of units (for unit-based plans). */
  units?: number;
};

// ── Validator/type parity assertions ────────────────────────
// The string unions above are hand-written for readable documentation.
// These assertions fail to compile if they ever drift from the validators
// in `validators.ts`, which define the wire format.

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type _RecurringCycleMatchesValidator = Assert<
  Exact<RecurringCycle, RecurringCycleFromValidator>
>;
export type _PaymentRecoveryStateMatchesValidator = Assert<
  Exact<PaymentRecoveryState, PaymentRecoveryStateFromValidator>
>;
export type _AvailableActionMatchesValidator = Assert<
  Exact<AvailableAction, AvailableActionFromValidator>
>;
