import type { ConnectedBillingModel } from "./model.js";
import type {
  PlanCatalog,
  PlanChangeIntent,
  RecurringCycle,
  UpdateBehavior,
} from "./types.js";
import type { BillingI18n } from "./i18n.js";

/**
 * Integration-agnostic billing contract consumed by the UI widgets.
 *
 * This is the seam that decouples widgets from any particular backend. An
 * integration package supplies it through a framework-specific provider —
 * `CreemConvexProvider` populates it from Convex queries, actions, and
 * mutations — and the widgets only ever depend on this shape.
 *
 * Actions take a **stable catalog plan ID plus billing cycle**, never a remote
 * Creem product ID. The provider resolves those to the environment-specific
 * product ID, so the same UI code works against test and live deployments where
 * the same plan has different remote IDs.
 */
export type BillingContextValue = {
  // ── State ──────────────────────────────────────────────────

  /** Reactive billing model. `null` while loading or when unavailable. */
  model: ConnectedBillingModel | null;

  /** Whether the billing model is currently loading. */
  isLoading: boolean;

  /** Error from the most recent load or action, or `null`. */
  error: Error | null;

  // ── Actions ────────────────────────────────────────────────

  /**
   * Create a checkout session and return the hosted checkout URL.
   *
   * `planId` is a catalog plan ID. The provider resolves it to a Creem product
   * ID for the requested cycle.
   */
  createCheckout: (args: {
    planId: string;
    cycle?: RecurringCycle;
    successUrl?: string;
    units?: number;
    discountCode?: string;
    metadata?: Record<string, string>;
  }) => Promise<{ url: string }>;

  /** Switch to another paid catalog plan. */
  switchPlan?: (args: {
    planId: string;
    cycle?: RecurringCycle;
    subscriptionId?: string;
    units?: number;
    updateBehavior?: UpdateBehavior;
  }) => Promise<void>;

  /** Change the unit quantity on an active paid subscription. */
  updateUnits?: (args: {
    units: number;
    subscriptionId?: string;
    updateBehavior?: UpdateBehavior;
  }) => Promise<void>;

  /** Move from a paid subscription to an app-owned plan (free, trial, custom). */
  switchToAppPlan?: (args: {
    planId: string;
    subscriptionId?: string;
    updateBehavior?: "period-end" | "immediate";
  }) => Promise<void>;

  /** Activate an app-owned catalog plan for the current billing entity. */
  activatePlan?: (args: { planId: string }) => Promise<void>;

  /** Cancel a subscription. */
  cancelSubscription?: (args?: {
    subscriptionId?: string;
    revokeImmediately?: boolean;
  }) => Promise<void>;

  /** Resume a paused or scheduled-cancel subscription. */
  resumeSubscription?: (args?: { subscriptionId?: string }) => Promise<void>;

  /** Undo a pending app-side period-end update. */
  cancelScheduledUpdate?: (args?: { subscriptionId?: string }) => Promise<void>;

  /** Get the customer billing portal URL. */
  getPortalUrl?: () => Promise<{ url: string }>;

  /** Search paginated transaction history. */
  searchTransactions?: (args: {
    orderId?: string;
    productId?: string;
    pageNumber?: number;
    pageSize?: number;
  }) => Promise<{
    items: Array<Record<string, unknown>>;
    pagination: {
      totalRecords: number;
      totalPages: number;
      currentPage: number;
      nextPage: number | null;
      prevPage: number | null;
    };
  }>;

  /** Trigger a refresh. No-op for reactive integrations such as Convex. */
  invalidate: () => void;

  // ── Consent gates ──────────────────────────────────────────

  /** Called before checkout — return `false` to block. */
  onBeforeCheckout?: (intent: {
    productId: string;
    units?: number;
  }) => Promise<boolean> | boolean;

  /** Called before a paid plan change — return `false` to block. */
  onBeforePlanChange?: (intent: PlanChangeIntent) => Promise<boolean> | boolean;

  /** Called before app-owned plan activation — return `false` to block. */
  onBeforePlanActivation?: (intent: {
    planId: string;
  }) => Promise<boolean> | boolean;

  // ── Optional capabilities ──────────────────────────────────

  /** Optional customer credits capability. */
  credits?: {
    /** Read the current entity's default credit balance. */
    getBalance: () => Promise<{ balance: string }>;
  };

  /** Plan catalog used for plan resolution and metadata. */
  catalog?: PlanCatalog | null;

  /** Optional UI label and formatting configuration. */
  i18n?: BillingI18n;
};
