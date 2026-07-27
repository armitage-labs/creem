import type { PlanCatalog, RecurringCycle } from "./types.js";
import type {
  AppPlanActivation,
  AppPlanAssignment,
  BillingSnapshot,
  ConnectedActiveSubscription,
  ConnectedBillingUser,
  ConnectedProduct,
  ScheduledSubscriptionUpdate,
} from "./types.js";

export type {
  ConnectedProduct,
  ConnectedActiveSubscription,
  ConnectedBillingUser,
  ConnectedTransaction,
  ConnectedPagination,
  ConnectedTransactionList,
  CreditBalance,
  CreditEntry,
  CreditEntryList,
} from "./types.js";

/**
 * UI-side permission flags for billing widgets.
 * Controls which buttons are enabled/visible. This is **cosmetic gating only** —
 * enforce real permissions server-side in your Convex functions.
 *
 * When a permission is `false`, the corresponding button renders as disabled.
 * When omitted or `undefined`, all actions default to enabled.
 */
export type BillingPermissions = {
  /** Allow creating new checkouts (subscribe / buy buttons). */
  canCheckout?: boolean;
  /** Allow switching plans or billing intervals. */
  canChangeSubscription?: boolean;
  /** Allow cancelling the active subscription. */
  canCancelSubscription?: boolean;
  /** Allow resuming a paused or scheduled-cancel subscription. */
  canResumeSubscription?: boolean;
  /** Allow changing the unit count on unit-based plans. */
  canUpdateUnits?: boolean;
  /** Allow opening the Creem customer billing portal. */
  canAccessPortal?: boolean;
};

/**
 * Complete billing state returned by the `uiModel` query.
 *
 * Derived from `connectedBillingModelValidator`, so this type and the Convex
 * `returns` validator can never drift. `catalog` is overridden because it is
 * app-authored data round-tripping through the query rather than Creem data.
 *
 * Consumed internally by all connected widgets — you typically don't need to
 * access this directly.
 */
export type ConnectedBillingModel = {
  /** Authenticated user info, or `null` when unauthenticated (public pricing page). */
  user: ConnectedBillingUser | null;
  /** Optional server-resolved billing catalog. Used by connected widgets when the provider has no catalog. */
  catalog?: PlanCatalog | null;
  /** Billing state. `null` when unauthenticated. */
  snapshot: BillingSnapshot | null;
  /** All synced products from the Creem dashboard. */
  allProducts: ConnectedProduct[];
  /** Product IDs the entity has purchased (one-time orders). */
  ownedProductIds: string[];
  /** Product ID of the current subscription, or `null`. */
  subscriptionProductId: string | null;
  /**
   * App-owned active plan ID. Prefer this over `activeFreePlanId` for
   * trial/free/custom plans.
   */
  activePlanId?: string | null;
  /**
   * App-owned active free plan ID.
   * `undefined` preserves the default widget behavior of treating the first free
   * plan as active for signed-in users without a paid subscription.
   * `null` means the app explicitly has no active free plan.
   */
  activeFreePlanId?: string | null;
  /** Activation history for app-owned plans, used for once-per-entity eligibility. */
  appPlanActivations: AppPlanActivation[];
  /** Current and scheduled assignments for app-owned plans. */
  appPlanAssignments: AppPlanAssignment[];
  /** All active subscriptions with full details. */
  activeSubscriptions: ConnectedActiveSubscription[];
  /** App-side period-end subscription updates that have not applied yet. */
  scheduledSubscriptionUpdates: ScheduledSubscriptionUpdate[];
  /** Whether this entity has a Creem customer record (needed for billing portal). */
  hasCreemCustomer: boolean;
};

/**
 * Plan type for `<Subscription.Item>`.
 * - `"free"` — free tier, no checkout
 * - `"single"` — standard paid plan (flat pricing)
 * - `"unit-based"` — per-unit pricing with optional unit picker
 * - `"enterprise"` — "Contact sales" CTA, no checkout
 */
export type SubscriptionPlanType =
  | "free"
  | "single"
  | "unit-based"
  | "enterprise";

export type SubscriptionPlanRegistration = {
  planId: string;
  type?: SubscriptionPlanType;
  groupId?: string;
  groupTitle?: string;
  title?: string;
  description?: string;
  contactUrl?: string;
  recommended?: boolean;
  productIds?: Partial<Record<RecurringCycle, string>>;
};

export type SubscriptionGroupRegistration = {
  value: string;
  label: string;
  description?: string;
  plans: readonly string[];
};

/**
 * Product type for `<Product.Item>`.
 * - `"one-time"` — purchased once, shows "Owned" badge after purchase
 * - `"recurring"` — can be purchased multiple times (consumable), no "Owned" badge
 */
export type ProductType = "one-time" | "recurring";

/**
 * Upgrade path rule for `<Product.Root transition={[...]}>`.
 * - `"direct"` — checkout uses the target product directly
 * - `"via_product"` — checkout uses a dedicated upgrade product (delta pricing)
 */
export type Transition =
  | { from: string; to: string; kind: "direct" }
  | {
      from: string;
      to: string;
      kind: "via_product";
      /** Creem product ID for the upgrade (e.g. a delta-priced "Basic → Premium" product). */
      viaProductId: string;
    };

export type ProductItemRegistration = {
  productId: string;
  type: ProductType;
  title?: string;
  description?: string;
};
