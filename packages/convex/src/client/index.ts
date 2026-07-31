import "./polyfill.js";
import { Creem as CreemSDK } from "creem";
import type {
  AccountResponseDto,
  CheckoutEntity,
  CustomerEntity,
  RefundEntity,
  SubscriptionEntity,
  TransactionListEntity,
  WebhookEventEntity,
} from "creem/models/components";
import {
  constructWebhookEventEntity,
  WebhookVerificationError,
} from "creem/webhooks";
import { getEntityId } from "./helpers.js";
import {
  type CreemWebhookEvent,
  getEventType,
  getCustomerId,
  getConvexEntityId,
} from "./parsers.js";
import {
  type FunctionReference,
  type HttpRouter,
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import schema from "../component/schema.js";
import {
  type RunMutationCtx,
  type RunSchedulerMutationCtx,
  type RunQueryCtx,
  convertToDatabaseSubscription,
  convertToOrder,
  type RunActionCtx,
} from "../component/util.js";
import type { ComponentApi } from "../component/_generated/component.js";
import { resolveBillingSnapshot } from "../core/resolver.js";
import {
  findCreditGrantByProductId,
  findPlanById,
  findPlanByProductId,
  isAppOwnedPlan,
  isAppPlanEligible,
  normalizePlanCatalog,
} from "../core/catalog.js";
import type {
  AppPlanAssignment,
  CreditBalance,
  CreditEntryList,
  CreditGrant,
  BillingSnapshot,
  ConnectedTransactionList,
  PlanCatalog,
  ResolvedUpdateBehavior,
  ScheduledSubscriptionUpdate,
  SubscriptionSnapshot,
  SubscriptionUpdateArgs,
} from "../core/types.js";
import type { ConnectedBillingModel } from "../core/model.js";

export * from "../core/index.js";
export type { RunSchedulerMutationCtx } from "../component/util.js";
export {
  getEntityId,
  lowerCaseHeaders,
  toHex,
  constantTimeEqual,
  normalizeSignature,
} from "./helpers.js";
export {
  type CreemWebhookEvent,
  getEventType,
  getEventData,
  getCustomerId,
  getConvexEntityId,
  parseSubscription,
  parseCheckout,
  parseProduct,
  parseGeneratedWebhookEvent,
  parseRefund,
} from "./parsers.js";

type GeneratedSubscriptionWebhookEvent = Extract<
  WebhookEventEntity,
  { eventType: `subscription.${string}` }
>;

type AppPlanTransitionRollback = {
  planId: string;
  scheduledUpdateId?: string;
  scheduledUpdateCreatedAt?: string;
  assignmentCreatedAt?: string;
};

type CanceledScheduledUpdateSideEffects = {
  resumeScheduledCancellation: boolean;
  restoreAppPlanTransitions: AppPlanTransitionRollback[];
};

const isGeneratedSubscriptionWebhookEvent = (
  event: WebhookEventEntity | null,
): event is GeneratedSubscriptionWebhookEvent =>
  !!event && subscriptionWebhookEvents.has(event.eventType);

const getCustomerCreditAccounts = (
  response:
    | { result: { data: Array<AccountResponseDto> } }
    | { data?: Array<AccountResponseDto> },
) => ("result" in response ? response.result.data : (response.data ?? []));

const unwrapTransactionSearchPage = (
  page: TransactionListEntity | { result: TransactionListEntity },
): TransactionListEntity => ("result" in page ? page.result : page);

/** Convex validator for the `subscriptions` table. Use with `v.object(subscriptionValidator.fields)` in custom functions. */
export const subscriptionValidator = schema.tables.subscriptions.validator;
/** TypeScript type for a subscription document (inferred from the Convex schema). */
export type Subscription = Infer<typeof subscriptionValidator>;

// ── Shared arg validators for custom actions / mutations ──────────────
// Defined in `core/validators.ts` and re-exported here so custom Convex
// functions and the connected widgets stay on one definition.

import {
  appPlanActivateArgs,
  billingSnapshotValidator,
  checkoutCreateArgs,
  connectedBillingModelValidator,
  connectedTransactionListValidator,
  creditBalanceValidator,
  creditEntryListValidator,
  creditsListEntriesArgs,
  parseSubscriptionUpdateArgs,
  subscriptionCancelArgs,
  subscriptionCancelScheduledUpdateArgs,
  subscriptionPauseArgs,
  subscriptionResumeArgs,
  subscriptionUpdateArgs,
  transactionsSearchArgs,
} from "../core/validators.js";

// The validators themselves are re-exported through `export * from "../core/index.js"`.

const CUSTOMER_CHECKOUT_REQUIRED_ERROR = {
  message: "Customer not found — complete a checkout first",
} as const;

/** Function reference type for internal mutations that receive a subscription document. */
export type SubscriptionHandler = FunctionReference<
  "mutation",
  "internal",
  { subscription: Subscription }
>;

/**
 * Map of webhook event type → handler function.
 * Handlers run **after** the component's built-in processing (customer/subscription/order upserts).
 * The `ctx` is a Convex action context — use `ctx.runQuery`,
 * `ctx.runMutation`, or `ctx.runAction` for app-specific work.
 *
 * @example
 * ```ts
 * creem.registerRoutes(http, {
 *   events: {
 *     "checkout.completed": async (ctx, event) => {
 *       // Grant entitlements, send emails, log analytics
 *     },
 *   },
 * });
 * ```
 */
export type WebhookEventHandlers = Record<
  string,
  (ctx: RunActionCtx, event: CreemWebhookEvent) => Promise<void> | void
>;

const subscriptionWebhookEvents = new Set([
  "subscription.active",
  "subscription.paid",
  "subscription.canceled",
  "subscription.scheduled_cancel",
  "subscription.past_due",
  "subscription.expired",
  "subscription.trialing",
  "subscription.paused",
  "subscription.unpaid",
  "subscription.update",
]);

const supportedWebhookEvents = new Set([
  "checkout.completed",
  ...subscriptionWebhookEvents,
  "refund.created",
  "dispute.created",
]);

/**
 * Billing identity returned by an {@link ApiResolver}.
 */
export type ResolvedBillingIdentity = {
  /** Your app's user ID. Stored in checkout metadata as `convexUserId`. */
  userId: string;
  /** User's email. Passed to Creem when creating the customer. */
  email: string;
  /**
   * Billing entity ID — the owner of every subscription, order, and credit
   * balance. For personal billing this is the user ID; for organization billing
   * return the org ID. Verify membership and any required billing role before
   * returning an org ID.
   */
  entityId: string;
  /**
   * Optional override for the entity's currently active app-owned catalog plan
   * (free, trial, or custom).
   *
   * Only needed when your app — not this component — owns that assignment. When
   * omitted, the active plan is read from the component's own app-plan
   * assignment rows. It feeds `uiModel.activePlanId` and app-plan eligibility
   * checks in `plans.activate`.
   */
  activePlanId?: string | null;
  /**
   * Optional override for the entity's active free plan.
   *
   * Prefer {@link ResolvedBillingIdentity.activePlanId}, which covers free,
   * trial, and custom plans. `undefined` keeps the default widget behavior of
   * treating the first catalog free plan as active for signed-in users without
   * a paid subscription; `null` states explicitly that there is no free plan.
   */
  activeFreePlanId?: string | null;
};

/**
 * Callback that resolves the billing identity for `creem.api({ resolve })`.
 * Called on every generated Convex function.
 *
 * **Return `null` for an unauthenticated caller.** Public pricing pages rely on
 * this: `uiModel` then returns the catalog-only model and `snapshot` returns
 * `null`, while every other generated function rejects the call.
 *
 * Any error thrown from the resolver is treated as a real failure — it is
 * logged and rethrown rather than silently degrading to the logged-out view.
 * A resolver that throws {@link CreemNotAuthenticatedError} is treated the same
 * as returning `null`, so resolvers written against earlier versions keep
 * working.
 *
 * @example
 * ```ts
 * const resolve: ApiResolver = async (ctx) => {
 *   const identity = await ctx.auth.getUserIdentity();
 *   if (!identity) return null;
 *   return {
 *     userId: identity.subject,
 *     email: identity.email!,
 *     entityId: identity.subject,
 *   };
 * };
 * ```
 */
export type ApiResolver = (
  ctx: RunQueryCtx,
) => Promise<ResolvedBillingIdentity | null>;

/**
 * Throw from an {@link ApiResolver} to signal "no authenticated caller".
 *
 * Equivalent to returning `null`. Prefer returning `null`; this exists so
 * resolvers that already signalled anonymity by throwing keep working.
 */
export class CreemNotAuthenticatedError extends Error {
  readonly isCreemNotAuthenticated = true;

  constructor(message = "Not authenticated") {
    super(message);
    this.name = "CreemNotAuthenticatedError";
  }
}

/** Largest quantity Creem accepts for a unit-based subscription. */
const MAX_SUBSCRIPTION_UNITS = 1_000_000;

/**
 * Reject unit counts that a validator cannot express.
 *
 * `units` is client-supplied and is written straight onto the subscription
 * quantity, so a non-integer, negative, or absurdly large value must not reach
 * Creem or the optimistic patch.
 */
const assertValidUnitCount = (units: number): void => {
  if (!Number.isInteger(units) || units < 1 || units > MAX_SUBSCRIPTION_UNITS) {
    throw new ConvexError(
      `units must be an integer between 1 and ${MAX_SUBSCRIPTION_UNITS}`,
    );
  }
};

const isNotAuthenticatedError = (error: unknown): boolean =>
  error instanceof CreemNotAuthenticatedError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { isCreemNotAuthenticated?: boolean }).isCreemNotAuthenticated ===
      true);

/**
 * Run a resolver for a read that is allowed to serve anonymous callers.
 *
 * Returns `null` only for a genuine "no authenticated caller" signal. Every
 * other error is logged with a `[creem]` prefix and rethrown, so a broken
 * resolver surfaces as a failing query instead of a silently logged-out UI.
 */
const resolveOptionalIdentity = async (
  resolve: ApiResolver,
  ctx: RunQueryCtx,
): Promise<ResolvedBillingIdentity | null> => {
  try {
    return await resolve(ctx);
  } catch (error) {
    if (isNotAuthenticatedError(error)) {
      return null;
    }
    console.error(
      "[creem] billing resolver failed. Return `null` for unauthenticated callers; " +
        "any other error is treated as a failure.",
      error,
    );
    throw error;
  }
};

/**
 * Run a resolver for an operation that requires an authenticated caller.
 */
const requireIdentity = async (
  resolve: ApiResolver,
  ctx: RunQueryCtx,
): Promise<ResolvedBillingIdentity> => {
  const resolved = await resolve(ctx);
  if (!resolved) {
    throw new ConvexError("Not authenticated");
  }
  return resolved;
};

/**
 * Configuration for the Creem Convex component.
 * All fields are optional — environment variables are used as fallbacks.
 */
type CreemConfig = {
  /**
   * Default cancel mode for subscriptions.
   * - `"immediate"` — cancel and revoke access now
   * - `"scheduled"` — cancel at end of current billing period
   * - Omit to use Creem's store-level default.
   */
  cancelMode?: "immediate" | "scheduled";
  /** Creem API key. Falls back to `CREEM_API_KEY` env var. */
  apiKey?: string;
  /** Creem webhook signing secret. Falls back to `CREEM_WEBHOOK_SECRET` env var. */
  webhookSecret?: string;
  /** Creem SDK server. Falls back to `CREEM_SERVER` env var and defaults to production. */
  server?: "test" | "prod";
  /** Creem SDK server URL override (for test/staging). Falls back to `CREEM_SERVER_URL` env var. */
  serverURL?: string;
  /** Optional app-owned billing catalog used for server-side fulfillment such as Customer Credits grants. */
  billingCatalog?: PlanCatalog;
};

const resolveCreemServer = (
  server: string | undefined,
): "test" | "prod" | undefined => {
  if (!server) return undefined;
  if (server === "test" || server === "prod") return server;
  throw new Error(`Invalid Creem server ${server}`);
};

/**
 * Main entry point for the Creem–Convex integration.
 *
 * Instantiate once in your `convex/billing.ts` and use its methods
 * to manage subscriptions, checkouts, products, customers, and orders.
 *
 * **Two usage patterns:**
 * 1. **Quick start** — call `creem.api({ resolve })` to generate ready-to-export Convex functions
 * 2. **Full control** — use namespace getters (`creem.subscriptions.*`, `creem.checkouts.*`, etc.)
 *    directly in your own Convex functions for custom auth/RBAC
 *
 * @example
 * ```ts
 * import { Creem } from "@creem_io/convex";
 * import { components } from "./_generated/api";
 *
 * export const creem = new Creem(components.creem);
 * ```
 */
export class Creem {
  /** Direct access to the Creem SDK client, pre-configured with your API key. Use for resources without webhook sync (licenses, discounts, transactions). */
  public sdk: CreemSDK;
  private apiKey: string;
  private webhookSecret: string;
  private server?: "test" | "prod";
  private serverURL?: string;
  private billingCatalog?: PlanCatalog;

  constructor(
    public component: ComponentApi,
    private config: CreemConfig = {},
  ) {
    this.apiKey = config.apiKey ?? process.env["CREEM_API_KEY"] ?? "";
    this.webhookSecret =
      config.webhookSecret ?? process.env["CREEM_WEBHOOK_SECRET"] ?? "";
    this.server =
      config.server ?? resolveCreemServer(process.env["CREEM_SERVER"]);
    this.serverURL = config.serverURL ?? process.env["CREEM_SERVER_URL"];
    this.billingCatalog = normalizePlanCatalog(config.billingCatalog);

    this.sdk = new CreemSDK({
      apiKey: this.apiKey,
      ...(this.server ? { server: this.server } : {}),
      ...(this.serverURL ? { serverURL: this.serverURL } : {}),
    });
  }
  private getCustomerByEntityId(ctx: RunQueryCtx, entityId: string) {
    return ctx.runQuery(this.component.lib.getCustomerByEntityId, { entityId });
  }

  /**
   * Resolve a subscription inside an entity's billing scope.
   *
   * Explicit resource IDs are always checked against the customer mapped to
   * `entityId`. Returning the same error for missing and foreign resources
   * avoids exposing whether another customer's subscription exists.
   */
  private async getOwnedSubscription(
    ctx: RunQueryCtx,
    {
      entityId,
      subscriptionId,
    }: {
      entityId: string;
      subscriptionId?: string;
    },
  ): Promise<Subscription> {
    if (!subscriptionId) {
      const subscription = await ctx.runQuery(
        this.component.lib.getCurrentSubscription,
        { entityId },
      );
      if (!subscription) {
        throw new ConvexError("Subscription not found");
      }
      return subscription;
    }

    const [customer, subscription] = await Promise.all([
      this.getCustomerByEntityId(ctx, entityId),
      ctx.runQuery(this.component.lib.getSubscription, {
        id: subscriptionId,
      }),
    ]);
    if (!customer || !subscription || subscription.customerId !== customer.id) {
      throw new ConvexError("Subscription not found");
    }
    return subscription;
  }

  /** Pull all products from the Creem API into the Convex database. Typically called once via `internalAction` or the CLI. */
  async syncProducts(ctx: RunActionCtx) {
    await ctx.runAction(this.component.lib.syncProducts, {
      apiKey: this.apiKey,
      server: this.server,
      serverURL: this.serverURL,
    });
  }

  private async createCheckoutSession(
    ctx: RunMutationCtx,
    {
      productId,
      entityId,
      userId,
      email,
      successUrl,
      units,
      metadata,
    }: {
      productId: string;
      entityId: string;
      userId: string;
      email: string;
      successUrl?: string;
      units?: number;
      metadata?: Record<string, string>;
    },
  ): Promise<CheckoutEntity> {
    const dbCustomer = await ctx.runQuery(
      this.component.lib.getCustomerByEntityId,
      {
        entityId,
      },
    );

    const checkout = await this.sdk.checkouts.create({
      productId,
      ...(successUrl ? { successUrl } : {}),
      units,
      metadata: {
        ...(metadata ?? {}),
        convexUserId: userId,
        convexBillingEntityId: entityId,
      },
      customer: dbCustomer ? { id: dbCustomer.id } : { email },
    });

    if (!dbCustomer) {
      const customerId = getEntityId(checkout.customer);
      if (customerId) {
        const customerObj =
          typeof checkout.customer === "object" ? checkout.customer : undefined;
        await ctx.runMutation(this.component.lib.insertCustomer, {
          id: customerId,
          entityId,
          email: customerObj?.email,
          name: customerObj?.name ?? undefined,
          country: customerObj?.country ?? undefined,
          mode: customerObj?.mode,
        });
      }
    }

    return checkout;
  }

  private async createCustomerPortalSession(
    ctx: RunActionCtx,
    { entityId }: { entityId: string },
  ) {
    const customer = await ctx.runQuery(
      this.component.lib.getCustomerByEntityId,
      { entityId },
    );

    if (!customer) {
      throw new ConvexError("Customer not found");
    }

    const portal = await this.sdk.customers.generateBillingLinks({
      customerId: customer.id,
    });
    return { url: portal.customerPortalLink };
  }

  private listProducts(
    ctx: RunQueryCtx,
    { includeArchived }: { includeArchived?: boolean } = {},
  ) {
    return ctx.runQuery(this.component.lib.listProducts, {
      includeArchived,
    });
  }
  private async getCurrentSubscription(
    ctx: RunQueryCtx,
    { entityId }: { entityId: string },
  ) {
    // `getCurrentSubscription` already joins the product, so there is no second
    // round-trip here. `product` is null when the subscription references a
    // product this deployment has not synced yet — callers must handle that
    // rather than have the whole query throw.
    return ctx.runQuery(this.component.lib.getCurrentSubscription, {
      entityId,
    });
  }
  /** Return active subscriptions for an entity, excluding ended and expired trials. */
  private listUserSubscriptions(
    ctx: RunQueryCtx,
    { entityId }: { entityId: string },
  ) {
    return ctx.runQuery(this.component.lib.listUserSubscriptions, {
      entityId,
    });
  }
  /** Return one-time orders for an entity. */
  private listUserOrders(ctx: RunQueryCtx, { entityId }: { entityId: string }) {
    return ctx.runQuery(this.component.lib.listUserOrders, {
      entityId,
    });
  }
  /** Return all subscriptions for an entity, including ended and expired trials. */
  private listAllUserSubscriptions(
    ctx: RunQueryCtx,
    { entityId }: { entityId: string },
  ) {
    return ctx.runQuery(this.component.lib.listAllUserSubscriptions, {
      entityId,
    });
  }
  private getProduct(ctx: RunQueryCtx, { productId }: { productId: string }) {
    return ctx.runQuery(this.component.lib.getProduct, { id: productId });
  }
  private listAppPlanActivations(
    ctx: RunQueryCtx,
    { entityId }: { entityId: string },
  ) {
    return ctx.runQuery(this.component.lib.listAppPlanActivations, {
      entityId,
    });
  }
  private listAppPlanAssignments(
    ctx: RunQueryCtx,
    { entityId }: { entityId: string },
  ) {
    return ctx.runQuery(this.component.lib.listAppPlanAssignments, {
      entityId,
    });
  }
  private toSubscriptionSnapshot(
    subscription: Subscription,
  ): SubscriptionSnapshot {
    return {
      id: subscription.id,
      productId: subscription.productId,
      status: subscription.status,
      recurringInterval: subscription.recurringInterval,
      units: subscription.seats,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd ?? null,
    };
  }

  private async assertAppPlanEligible(
    ctx: RunQueryCtx,
    {
      entityId,
      planId,
      activePlanId,
      activeFreePlanId,
    }: {
      entityId: string;
      planId: string;
      activePlanId?: string | null;
      activeFreePlanId?: string | null;
    },
  ) {
    const plan = findPlanById(this.billingCatalog, planId);
    if (!plan || !this.billingCatalog) {
      return;
    }

    const [activations, assignments, subscriptions, scheduledUpdates] =
      await Promise.all([
        this.listAppPlanActivations(ctx, { entityId }),
        this.listAppPlanAssignments(ctx, { entityId }),
        this.listUserSubscriptions(ctx, { entityId }),
        ctx.runQuery(
          this.component.lib.listPendingScheduledSubscriptionUpdates,
          { entityId },
        ),
      ]);

    const activeOrScheduledPlanIds = new Set<string>();
    const addPlanId = (candidate: string | null | undefined) => {
      if (candidate) {
        activeOrScheduledPlanIds.add(candidate);
      }
    };
    const addProductId = (productId: string | null | undefined) => {
      addPlanId(
        findPlanByProductId(this.billingCatalog, productId ?? undefined)
          ?.planId,
      );
    };

    addPlanId(activePlanId);
    addPlanId(activeFreePlanId);
    for (const subscription of subscriptions ?? []) {
      addProductId(subscription.productId);
    }
    for (const assignment of assignments ?? []) {
      if (assignment.status === "active" || assignment.status === "scheduled") {
        addPlanId(assignment.planId);
      }
    }
    for (const update of scheduledUpdates ?? []) {
      addProductId(update.targetProductId);
      addPlanId(update.targetPlanId);
    }

    const resolvedActivePlanId =
      activePlanId ??
      activeFreePlanId ??
      (assignments ?? []).find((assignment) => assignment.status === "active")
        ?.planId ??
      findPlanByProductId(
        this.billingCatalog,
        (subscriptions ?? [])[0]?.productId,
      )?.planId ??
      null;

    if (
      !isAppPlanEligible(plan, activations, {
        activePlanId: resolvedActivePlanId,
        activeOrScheduledPlanIds: Array.from(activeOrScheduledPlanIds),
        catalogPlans: this.billingCatalog.plans,
      })
    ) {
      throw new ConvexError(`Plan "${planId}" is not eligible`);
    }
  }

  /**
   * App-owned plan activation namespace.
   *
   * The component records activation history for eligibility and current
   * app-plan assignments for free, trial, or custom app-owned plans.
   */
  get appPlans() {
    return {
      /** List activation-history rows used for app-owned plan eligibility. */
      listActivations: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listAppPlanActivations(ctx, { entityId }),
      /** List current, scheduled, and ended app-owned plan assignments. */
      listAssignments: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listAppPlanAssignments(ctx, { entityId }),
      /** Return activation history for one app-owned plan. */
      getActivation: (
        ctx: RunQueryCtx,
        { entityId, planId }: { entityId: string; planId: string },
      ) =>
        ctx.runQuery(this.component.lib.getAppPlanActivation, {
          entityId,
          planId,
        }),
      /**
       * Activate an app-owned plan for the entity.
       *
       * This records activation history first, then writes an active
       * assignment. If the plan or explicit option is once-per-entity, repeated
       * activation throws a `ConvexError` before assignment state changes.
       */
      activate: async (
        ctx: RunMutationCtx,
        {
          entityId,
          planId,
          activatedByUserId,
          oncePerEntity,
          activePlanId,
          activeFreePlanId,
        }: {
          entityId: string;
          planId: string;
          activatedByUserId?: string;
          oncePerEntity?: boolean;
          activePlanId?: string | null;
          activeFreePlanId?: string | null;
        },
      ): Promise<AppPlanAssignment> => {
        const plan = findPlanById(this.billingCatalog, planId);
        if (this.billingCatalog && !plan) {
          throw new ConvexError(`Unknown app-owned plan: ${planId}`);
        }
        if (plan && !isAppOwnedPlan(plan)) {
          throw new ConvexError(`Plan "${planId}" is not an app-owned plan`);
        }

        await this.assertAppPlanEligible(ctx, {
          entityId,
          planId,
          activePlanId,
          activeFreePlanId,
        });

        await ctx.runMutation(this.component.lib.recordAppPlanActivation, {
          entityId,
          planId,
          activatedByUserId,
          oncePerEntity: oncePerEntity ?? plan?.eligibility?.oncePerEntity,
        });
        return await ctx.runMutation(this.component.lib.assignAppPlan, {
          entityId,
          planId,
          status: "active",
          source: plan?.category ?? "manual",
          assignedByUserId: activatedByUserId,
        });
      },
    };
  }

  /**
   * Resolve the backend billing snapshot for a billing entity.
   *
   * This is the public app-facing billing state contract. It keeps subscriptions
   * and one-time orders as arrays so apps can derive their own plan state without
   * depending on widget convenience fields.
   */
  async getBillingSnapshot(
    ctx: RunQueryCtx,
    {
      entityId,
    }: {
      entityId: string;
    },
  ): Promise<BillingSnapshot> {
    const [subscriptions, orders, appPlanAssignments] = await Promise.all([
      this.listAllUserSubscriptions(ctx, { entityId }),
      this.listUserOrders(ctx, { entityId }),
      this.listAppPlanAssignments(ctx, { entityId }),
    ]);

    return resolveBillingSnapshot({
      entityId,
      catalog: this.billingCatalog,
      subscriptions: (subscriptions ?? []).map((subscription) =>
        this.toSubscriptionSnapshot(subscription),
      ),
      orders: (orders ?? []).map((order) => ({
        orderId: order.id,
        productId: order.productId,
        status: order.status,
      })),
      appPlanAssignments: appPlanAssignments ?? [],
    });
  }

  private async constructWebhookEvent(
    body: string,
    headers: Record<string, string>,
  ) {
    if (!this.webhookSecret) {
      throw new ConvexError("Missing CREEM_WEBHOOK_SECRET");
    }
    return constructWebhookEventEntity(body, headers, this.webhookSecret);
  }

  /** Upsert a customer record if we have both entityId and customerId. */
  private async upsertCustomerFromWebhook(
    ctx: RunMutationCtx,
    customerId: string | null,
    entityId: string | null,
    customerEntity?: CustomerEntity | null,
  ) {
    if (!customerId || !entityId) return;
    try {
      await ctx.runMutation(this.component.lib.insertCustomer, {
        id: customerId,
        entityId,
        email: customerEntity?.email,
        name: customerEntity?.name ?? undefined,
        country: customerEntity?.country ?? undefined,
        mode: customerEntity?.mode,
        createdAt: customerEntity?.createdAt
          ? customerEntity.createdAt instanceof Date
            ? customerEntity.createdAt.toISOString()
            : String(customerEntity.createdAt)
          : undefined,
        updatedAt: customerEntity?.updatedAt
          ? customerEntity.updatedAt instanceof Date
            ? customerEntity.updatedAt.toISOString()
            : String(customerEntity.updatedAt)
          : undefined,
      });
    } catch {
      // insertCustomer is idempotent; ignore duplicate errors
    }
  }

  /** Resolve the default credits account ID for an entity. Finds or creates it. */
  private async resolveDefaultCreditAccountId(
    ctx: RunActionCtx,
    entityId: string,
  ): Promise<string> {
    const customer = await ctx.runQuery(
      this.component.lib.getCustomerByEntityId,
      { entityId },
    );
    if (!customer) {
      throw new ConvexError(CUSTOMER_CHECKOUT_REQUIRED_ERROR);
    }
    // Try to find existing default account
    const accounts = await this.sdk.customerCredits.listAccounts(
      10,
      customer.id,
    );
    const accountData = getCustomerCreditAccounts(accounts);
    const existing = accountData.find(
      (a) => a.name === "default" || a.name === "credits",
    );
    if (existing) return existing.id;
    // Auto-create a default credits account
    const created = await this.sdk.customerCredits.createAccount({
      customerId: customer.id,
      name: "credits",
      unitLabel: "credits",
    });
    return created.id;
  }

  private async resolveCreditAccountIdForCustomer(
    customerId: string,
    grant?: CreditGrant,
    { createIfMissing = true }: { createIfMissing?: boolean } = {},
  ): Promise<string | null> {
    const accountName = grant?.accountName ?? "credits";
    const accounts = await this.sdk.customerCredits.listAccounts(
      10,
      customerId,
    );
    const accountData = getCustomerCreditAccounts(accounts);
    const existing = accountData.find((a) => a.name === accountName);
    if (existing) return existing.id;

    const fallback =
      accountName === "credits"
        ? accountData.find((a) => a.name === "default")
        : undefined;
    if (fallback) return fallback.id;
    if (!createIfMissing) return null;

    const created = await this.sdk.customerCredits.createAccount({
      customerId,
      name: accountName,
      unitLabel: grant?.unitLabel ?? "credits",
    });
    return created.id;
  }

  private getCreditGrantForProduct(productId: string | undefined) {
    return findCreditGrantByProductId(this.billingCatalog, productId);
  }

  private async tolerateCustomerCreditsResponseValidation<T>(
    operation: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ResponseValidationError"
      ) {
        return null;
      }
      throw error;
    }
  }

  private async creditCheckoutCustomerCredits(checkout: CheckoutEntity) {
    const order =
      checkout.order && typeof checkout.order === "object"
        ? (checkout.order as Record<string, unknown>)
        : undefined;
    const productId =
      typeof order?.product === "string"
        ? order.product
        : (getEntityId(checkout.product) ?? undefined);
    const grant = this.getCreditGrantForProduct(productId);
    const amount = grant?.amount.trim();
    if (!grant) {
      if (this.billingCatalog && productId) {
        console.warn(
          `[creem-webhook] no creditGrant configured for checkout product ${productId}`,
        );
      }
      return;
    }
    if (!amount) return;

    const customerId =
      typeof order?.customer === "string"
        ? order.customer
        : getCustomerId(
            typeof checkout.customer === "object" ? checkout.customer : null,
          );
    if (!customerId) return;

    const accountId = await this.resolveCreditAccountIdForCustomer(
      customerId,
      grant,
    );
    if (!accountId) return;
    await this.credits.credit(accountId, {
      amount,
      reference: `checkout:${checkout.id}`,
      idempotencyKey: `creem:checkout:${checkout.id}:credits:${productId}:${amount}`,
    });
  }

  private getRefundCreditDebitAmount(
    grant: CreditGrant,
    refundAmount: unknown,
    orderAmount: unknown,
  ): string | null {
    const amount = grant.amount.trim();
    const refundBehavior = grant.refundBehavior ?? "revoke_on_full_refund";
    if (!amount || refundBehavior === "none") return null;
    if (refundBehavior === "debit") return amount;

    const hasRefundAmounts =
      typeof refundAmount === "number" && typeof orderAmount === "number";

    if (refundBehavior === "revoke_on_full_refund") {
      if (!hasRefundAmounts || refundAmount <= 0 || orderAmount <= 0) {
        return null;
      }
      return refundAmount >= orderAmount ? amount : null;
    }

    if (!hasRefundAmounts) {
      return amount;
    }
    if (refundAmount <= 0 || orderAmount <= 0) return null;

    const grantAmount = BigInt(amount);
    const debitAmount =
      (grantAmount * BigInt(Math.min(refundAmount, orderAmount))) /
      BigInt(orderAmount);
    return debitAmount > 0n ? debitAmount.toString() : null;
  }

  private async debitRefundedCustomerCredits(refund: RefundEntity) {
    if (refund.status && refund.status !== "succeeded") return;
    const order =
      refund.order && typeof refund.order === "object"
        ? refund.order
        : undefined;
    const productId = order?.product;
    const grant = this.getCreditGrantForProduct(productId);
    if (!grant) return;

    const amount = this.getRefundCreditDebitAmount(
      grant,
      refund.refundAmount,
      order?.amountPaid ?? order?.amount,
    );
    if (!amount) return;

    const customerId = order?.customer ?? "";
    if (!customerId) return;

    const refundId = refund.id;
    const accountId = await this.resolveCreditAccountIdForCustomer(
      customerId,
      grant,
      { createIfMissing: false },
    );
    if (!accountId) return;
    // The key includes the amount so a prorated refund that Creem recalculates
    // debits the corrected figure rather than being swallowed as a duplicate.
    // The trade-off: if Creem ever redelivers the *same* refund ID with a larger
    // `refundAmount`, the key changes and the credits are debited twice,
    // cumulatively. This key is the only protection on this path.
    await this.credits.debit(accountId, {
      amount,
      reference: `refund:${refundId}`,
      idempotencyKey: `creem:refund:${refundId}:credits:${productId}:${amount}`,
    });
  }

  private async cancelPendingScheduledUpdateSideEffects(
    ctx: RunSchedulerMutationCtx,
    args: {
      entityId: string;
      subscription: {
        id: string;
        status?: string;
        cancelAtPeriodEnd?: boolean;
      };
      keepScheduledCancellation: boolean;
    },
  ): Promise<CanceledScheduledUpdateSideEffects> {
    const pendingUpdates = (await ctx.runMutation(
      this.component.lib.cancelPendingScheduledSubscriptionUpdates,
      {
        entityId: args.entityId,
        subscriptionId: args.subscription.id,
      },
    )) as ScheduledSubscriptionUpdate[];
    const restoreAppPlanTransitions: AppPlanTransitionRollback[] = [];
    for (const update of pendingUpdates) {
      if (!update.targetPlanId) continue;
      const canceledAssignment = await ctx.runMutation(
        this.component.lib.cancelScheduledAppPlanAssignment,
        {
          subscriptionId: args.subscription.id,
          planId: update.targetPlanId,
        },
      );
      restoreAppPlanTransitions.push({
        planId: update.targetPlanId,
        scheduledUpdateCreatedAt: update.createdAt,
        ...(canceledAssignment?.createdAt
          ? { assignmentCreatedAt: canceledAssignment.createdAt }
          : {}),
      });
    }

    const shouldClearScheduledCancellation =
      !args.keepScheduledCancellation &&
      (restoreAppPlanTransitions.length > 0 ||
        args.subscription.cancelAtPeriodEnd === true ||
        args.subscription.status === "scheduled_cancel");

    if (!shouldClearScheduledCancellation) {
      return {
        resumeScheduledCancellation: false,
        restoreAppPlanTransitions,
      };
    }

    await ctx.runMutation(this.component.lib.patchSubscription, {
      subscriptionId: args.subscription.id,
      ...(args.subscription.status
        ? {
            status:
              args.subscription.status === "scheduled_cancel"
                ? "active"
                : args.subscription.status,
          }
        : {}),
      cancelAtPeriodEnd: false,
    });
    return {
      resumeScheduledCancellation: true,
      restoreAppPlanTransitions,
    };
  }

  /**
   * Schedule a plan/seat change to take effect at the end of the current period.
   *
   * Note: the job carries the API key it was scheduled with, because a Convex
   * component cannot read the host app's environment variables. If you rotate
   * `CREEM_API_KEY`, already-scheduled period-end updates will fail
   * authentication when they run and land in `status: "failed"` with the error
   * recorded on the row — re-schedule them after a rotation. Runs abandoned
   * mid-flight are reclaimed automatically (see `STALE_APPLYING_MS`).
   */
  private async schedulePeriodEndSubscriptionUpdate(
    ctx: RunSchedulerMutationCtx,
    args: {
      entityId: string;
      subscription: {
        id: string;
        currentPeriodEnd: string | null;
        status?: string;
        cancelAtPeriodEnd?: boolean;
      };
      productId?: string;
      appPlanId?: string;
      units?: number;
      restoreAppPlanTransitions?: AppPlanTransitionRollback[];
    },
  ): Promise<string> {
    if (!args.subscription.currentPeriodEnd) {
      throw new ConvexError(
        "Cannot schedule period-end update without currentPeriodEnd",
      );
    }
    const effectiveAt = new Date(args.subscription.currentPeriodEnd);
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new ConvexError("Subscription currentPeriodEnd is invalid");
    }

    const scheduledUpdateId = await ctx.runMutation(
      this.component.lib.createScheduledSubscriptionUpdate,
      {
        entityId: args.entityId,
        subscriptionId: args.subscription.id,
        ...(args.productId ? { targetProductId: args.productId } : {}),
        ...(args.appPlanId ? { targetPlanId: args.appPlanId } : {}),
        ...(args.units !== undefined ? { targetUnits: args.units } : {}),
        effectiveAt: args.subscription.currentPeriodEnd,
      },
    );

    const appPlanAssignment = args.appPlanId
      ? await ctx.runMutation(this.component.lib.assignAppPlan, {
          entityId: args.entityId,
          planId: args.appPlanId,
          status: "scheduled",
          startsAt: args.subscription.currentPeriodEnd,
          source: "paid_to_app_plan",
          subscriptionId: args.subscription.id,
        })
      : null;

    const scheduledFunctionId = await ctx.scheduler.runAt(
      effectiveAt,
      this.component.lib.applyScheduledSubscriptionUpdate,
      {
        apiKey: this.apiKey,
        server: this.server,
        serverURL: this.serverURL,
        scheduledUpdateId,
      },
    );

    await ctx.runMutation(
      this.component.lib.setScheduledSubscriptionUpdateJob,
      {
        scheduledUpdateId,
        scheduledFunctionId,
      },
    );

    if (args.appPlanId) {
      await ctx.runMutation(this.component.lib.patchSubscription, {
        subscriptionId: args.subscription.id,
        cancelAtPeriodEnd: true,
      });
      await ctx.scheduler.runAfter(
        0,
        this.component.lib.executeSubscriptionLifecycle,
        {
          apiKey: this.apiKey,
          server: this.server,
          serverURL: this.serverURL,
          subscriptionId: args.subscription.id,
          operation: "cancel",
          cancelMode: "scheduled",
          scheduledUpdateId,
          previousStatus: args.subscription.status,
          previousCancelAtPeriodEnd: args.subscription.cancelAtPeriodEnd,
          rollback: {
            abortAppPlanTransitions: [
              {
                planId: args.appPlanId,
                scheduledUpdateId,
                ...(appPlanAssignment?.createdAt
                  ? {
                      assignmentCreatedAt: appPlanAssignment.createdAt,
                    }
                  : {}),
              },
            ],
            ...(args.restoreAppPlanTransitions?.length
              ? {
                  restoreAppPlanTransitions: args.restoreAppPlanTransitions,
                }
              : {}),
          },
        },
      );
    }
    return scheduledUpdateId;
  }

  // ── Namespace getters (public API) ─────────────────────────

  /**
   * Subscription management namespace.
   *
   * All methods take explicit `entityId` — use them directly in your own
   * Convex functions, or let `creem.api({ resolve })` handle auth for you.
   *
   * - `.getCurrent()` — current active subscription with product join (Convex DB)
   * - `.list()` — active subscriptions, excludes ended + expired trials (Convex DB)
   * - `.listAll()` — all subscriptions including ended (Convex DB)
   * - `.update()` — plan switch (`productId`) or unit change (`units`) (Creem API, optimistic)
   * - `.cancel()` — cancel subscription (Creem API, optimistic)
   * - `.pause()` — pause an active subscription (Creem API, optimistic)
   * - `.resume()` — resume a paused or scheduled-cancel subscription (Creem API, optimistic)
   */
  get subscriptions() {
    return {
      getCurrent: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.getCurrentSubscription(ctx, { entityId }),
      list: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listUserSubscriptions(ctx, { entityId }),
      listAll: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listAllUserSubscriptions(ctx, { entityId }),
      update: async (
        ctx: RunSchedulerMutationCtx,
        args: { entityId: string } & SubscriptionUpdateArgs,
      ) => {
        const productId = args.kind === "plan" ? args.productId : undefined;
        const appPlanId = args.kind === "app-plan" ? args.appPlanId : undefined;
        // Only a `"units"` update changes the quantity: the Creem executors
        // branch on `productId` first, so a quantity sent alongside a plan
        // switch would never reach Creem while still being patched locally.
        const units = args.kind === "units" ? args.units : undefined;

        if (units !== undefined) {
          assertValidUnitCount(units);
        }

        const updateBehavior: ResolvedUpdateBehavior | undefined =
          args.updateBehavior ?? (appPlanId ? "period-end" : undefined);

        const subscription = await this.getOwnedSubscription(ctx, args);

        // A period-end switch to an app-owned plan deliberately skips the
        // side-effect cleanup: `createScheduledSubscriptionUpdate` already
        // supersedes every pending row for this subscription, and
        // `assignAppPlan({ status: "scheduled" })` ends other scheduled
        // assignments for it, after which the branch re-asserts
        // `cancelAtPeriodEnd: true`. Running the cleanup here would clear the
        // scheduled cancellation this path depends on.
        const canceledSideEffects =
          updateBehavior !== "period-end" || !appPlanId
            ? await this.cancelPendingScheduledUpdateSideEffects(ctx, {
                entityId: args.entityId,
                subscription,
                keepScheduledCancellation: Boolean(appPlanId),
              })
            : {
                resumeScheduledCancellation: false,
                restoreAppPlanTransitions: [],
              };

        if (updateBehavior === "period-end") {
          const replacementScheduledUpdateId =
            await this.schedulePeriodEndSubscriptionUpdate(ctx, {
              entityId: args.entityId,
              subscription,
              productId,
              appPlanId,
              units,
              restoreAppPlanTransitions:
                canceledSideEffects.restoreAppPlanTransitions,
            });
          if (canceledSideEffects.resumeScheduledCancellation) {
            await ctx.scheduler.runAfter(
              0,
              this.component.lib.executeSubscriptionLifecycle,
              {
                apiKey: this.apiKey,
                server: this.server,
                serverURL: this.serverURL,
                subscriptionId: subscription.id,
                operation: "resume",
                previousStatus: subscription.status,
                previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                rollback: {
                  restoreAppPlanTransitions:
                    canceledSideEffects.restoreAppPlanTransitions,
                  replacementScheduledUpdateIds: [replacementScheduledUpdateId],
                },
              },
            );
          }
          return;
        }

        if (appPlanId && updateBehavior === "immediate") {
          await ctx.runMutation(this.component.lib.patchSubscription, {
            subscriptionId: subscription.id,
            status: "canceled",
            cancelAtPeriodEnd: false,
          });
          const assignment = await ctx.runMutation(
            this.component.lib.assignAppPlan,
            {
              entityId: args.entityId,
              planId: appPlanId,
              status: "active",
              source: "paid_to_app_plan",
              subscriptionId: subscription.id,
            },
          );
          await ctx.scheduler.runAfter(
            0,
            this.component.lib.executeSubscriptionLifecycle,
            {
              apiKey: this.apiKey,
              server: this.server,
              serverURL: this.serverURL,
              subscriptionId: subscription.id,
              operation: "cancel",
              cancelMode: "immediate",
              previousStatus: subscription.status,
              previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              rollback: {
                abortAppPlanTransitions: [
                  {
                    planId: appPlanId,
                    assignmentCreatedAt: assignment.createdAt,
                  },
                ],
                ...(canceledSideEffects.restoreAppPlanTransitions.length
                  ? {
                      restoreAppPlanTransitions:
                        canceledSideEffects.restoreAppPlanTransitions,
                    }
                  : {}),
              },
            },
          );
          return;
        }

        // Write optimistic state
        await ctx.runMutation(this.component.lib.patchSubscription, {
          subscriptionId: subscription.id,
          ...(units != null ? { seats: units } : {}),
          ...(productId ? { productId } : {}),
          ...(productId && units == null
            ? { seats: subscription.seats ?? null }
            : {}),
        });

        // Schedule the Creem API call (runs async, reverts on error)
        await ctx.scheduler.runAfter(
          0,
          this.component.lib.executeSubscriptionUpdate,
          {
            apiKey: this.apiKey,
            server: this.server,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            productId,
            units,
            updateBehavior,
            resumeScheduledCancellation:
              canceledSideEffects.resumeScheduledCancellation,
            previousSeats: subscription.seats ?? null,
            previousProductId: subscription.productId,
            ...(canceledSideEffects.resumeScheduledCancellation
              ? {
                  previousStatus: subscription.status,
                  previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                }
              : {}),
            ...(canceledSideEffects.restoreAppPlanTransitions.length
              ? {
                  rollback: {
                    restoreAppPlanTransitions:
                      canceledSideEffects.restoreAppPlanTransitions,
                  },
                }
              : {}),
          },
        );
      },
      cancel: async (
        ctx: RunSchedulerMutationCtx,
        args: {
          entityId: string;
          subscriptionId?: string;
          revokeImmediately?: boolean;
        },
      ) => {
        const subscription = await this.getOwnedSubscription(ctx, args);
        if (
          subscription.status !== "active" &&
          subscription.status !== "trialing"
        ) {
          throw new ConvexError("Subscription is not active");
        }

        // Resolve cancel mode: explicit arg > config default > omit (Creem decides)
        const immediate =
          args.revokeImmediately ??
          (this.config.cancelMode === "immediate" ? true : undefined);
        const isImmediate = immediate === true;

        // Write optimistic state
        await ctx.runMutation(this.component.lib.patchSubscription, {
          subscriptionId: subscription.id,
          ...(isImmediate
            ? { status: "canceled", cancelAtPeriodEnd: false }
            : { cancelAtPeriodEnd: true }),
        });

        // Resolve cancel mode string for the action
        const cancelMode = isImmediate
          ? "immediate"
          : immediate === false || this.config.cancelMode === "scheduled"
            ? "scheduled"
            : undefined;

        // Schedule the Creem API call
        await ctx.scheduler.runAfter(
          0,
          this.component.lib.executeSubscriptionLifecycle,
          {
            apiKey: this.apiKey,
            server: this.server,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            operation: "cancel",
            cancelMode,
            previousStatus: subscription.status,
            previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          },
        );
      },
      pause: async (
        ctx: RunSchedulerMutationCtx,
        args: { entityId: string; subscriptionId?: string },
      ) => {
        const subscription = await this.getOwnedSubscription(ctx, args);
        if (
          subscription.status !== "active" &&
          subscription.status !== "trialing"
        ) {
          throw new ConvexError("Subscription is not active");
        }

        // Write optimistic state
        await ctx.runMutation(this.component.lib.patchSubscription, {
          subscriptionId: subscription.id,
          status: "paused",
        });

        // Schedule the Creem API call
        await ctx.scheduler.runAfter(
          0,
          this.component.lib.executeSubscriptionLifecycle,
          {
            apiKey: this.apiKey,
            server: this.server,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            operation: "pause",
            previousStatus: subscription.status,
          },
        );
      },
      resume: async (
        ctx: RunSchedulerMutationCtx,
        args: { entityId: string; subscriptionId?: string },
      ) => {
        const subscription = await this.getOwnedSubscription(ctx, args);
        if (
          subscription.status !== "scheduled_cancel" &&
          subscription.status !== "paused"
        ) {
          throw new ConvexError("Subscription is not in a resumable state");
        }

        // Write optimistic state
        await ctx.runMutation(this.component.lib.patchSubscription, {
          subscriptionId: subscription.id,
          status: "active",
          cancelAtPeriodEnd: false,
        });

        // Schedule the Creem API call
        await ctx.scheduler.runAfter(
          0,
          this.component.lib.executeSubscriptionLifecycle,
          {
            apiKey: this.apiKey,
            server: this.server,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            operation: "resume",
            previousStatus: subscription.status,
            previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          },
        );
      },
      cancelScheduledUpdate: async (
        ctx: RunSchedulerMutationCtx,
        args: { entityId: string; subscriptionId?: string },
      ): Promise<{ canceled: boolean }> => {
        const subscription = await this.getOwnedSubscription(ctx, args);

        const canceledUpdate = await ctx.runMutation(
          this.component.lib.cancelScheduledSubscriptionUpdate,
          {
            entityId: args.entityId,
            subscriptionId: subscription.id,
          },
        );
        if (!canceledUpdate) return { canceled: false };

        if (canceledUpdate.targetPlanId) {
          const canceledAssignment = await ctx.runMutation(
            this.component.lib.cancelScheduledAppPlanAssignment,
            {
              subscriptionId: subscription.id,
              planId: canceledUpdate.targetPlanId,
            },
          );
          await ctx.runMutation(this.component.lib.patchSubscription, {
            subscriptionId: subscription.id,
            status:
              subscription.status === "scheduled_cancel"
                ? "active"
                : subscription.status,
            cancelAtPeriodEnd: false,
          });
          await ctx.scheduler.runAfter(
            0,
            this.component.lib.executeSubscriptionLifecycle,
            {
              apiKey: this.apiKey,
              server: this.server,
              serverURL: this.serverURL,
              subscriptionId: subscription.id,
              operation: "resume",
              previousStatus: subscription.status,
              previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              rollback: {
                restoreAppPlanTransitions: [
                  {
                    planId: canceledUpdate.targetPlanId,
                    scheduledUpdateCreatedAt: canceledUpdate.createdAt,
                    ...(canceledAssignment?.createdAt
                      ? {
                          assignmentCreatedAt: canceledAssignment.createdAt,
                        }
                      : {}),
                  },
                ],
              },
            },
          );
        }

        return { canceled: true };
      },
      /**
       * Cancel to free plan — temporary workaround until Creem supports native free plans.
       *
       * Schedules the active subscription for cancellation at period end, then
       * the app should activate its app-owned free plan via the
       * `subscription.canceled` or `subscription.scheduled_cancel` webhook event.
       *
       * This is NOT a general plan-change API. For paid→paid transitions use `.update()`.
       * For normal cancellation use `.cancel()`. This method exists solely as the
       * intermediate bridge for "paid subscription ends → app activates free plan".
       *
       * @param ctx - Convex mutation context with scheduler
       * @param args.entityId - Billing entity ID
       * @param args.subscriptionId - Optional subscription ID (resolves current if omitted)
       * @param args.freePlanId - Stable plan ID for the free plan (e.g. `"free"`)
       * @returns The freePlanId, to be used by the app in webhook handlers
       */
      cancelToFreePlan: async (
        ctx: RunSchedulerMutationCtx,
        args: {
          entityId: string;
          subscriptionId?: string;
          freePlanId: string;
        },
      ): Promise<{ freePlanId: string }> => {
        const subscription = await this.getOwnedSubscription(ctx, args);
        if (
          subscription.status !== "active" &&
          subscription.status !== "trialing"
        ) {
          throw new ConvexError("Subscription is not active");
        }

        await this.schedulePeriodEndSubscriptionUpdate(ctx, {
          entityId: args.entityId,
          subscription,
          appPlanId: args.freePlanId,
        });

        return { freePlanId: args.freePlanId };
      },
    };
  }

  /**
   * Checkout namespace.
   *
   * - `.create()` — create a checkout URL with 3-tier `successUrl` resolution and optional `theme` (Creem API)
   */
  get checkouts() {
    return {
      create: async (
        ctx: RunActionCtx,
        args: {
          entityId: string;
          userId: string;
          email: string;
          productId: string;
          successUrl?: string;
          fallbackSuccessUrl?: string;
          units?: number;
          metadata?: Record<string, string>;
          discountCode?: string;
          theme?: "light" | "dark";
        },
      ): Promise<{ url: string }> => {
        // 3-tier successUrl resolution
        let resolvedSuccessUrl = args.successUrl;
        if (!resolvedSuccessUrl) {
          const product = await ctx.runQuery(this.component.lib.getProduct, {
            id: args.productId,
          });
          resolvedSuccessUrl = product?.defaultSuccessUrl ?? undefined;
        }
        if (!resolvedSuccessUrl) {
          resolvedSuccessUrl = args.fallbackSuccessUrl;
        }

        const checkout = await this.createCheckoutSession(ctx, {
          productId: args.productId,
          entityId: args.entityId,
          userId: args.userId,
          email: args.email,
          ...(resolvedSuccessUrl ? { successUrl: resolvedSuccessUrl } : {}),
          units: args.units,
          metadata: args.metadata,
        });
        let checkoutUrl = checkout.checkoutUrl;
        if (!checkoutUrl)
          throw new ConvexError("Checkout URL missing from Creem response");
        if (args.theme) {
          const separator = checkoutUrl.includes("?") ? "&" : "?";
          checkoutUrl = `${checkoutUrl}${separator}theme=${args.theme}`;
        }
        return { url: checkoutUrl };
      },
    };
  }

  /**
   * Product namespace. All reads come from the local Convex DB (synced via webhooks).
   *
   * - `.list()` — all synced products (public, no `entityId` needed)
   * - `.get()` — single product by Creem product ID
   */
  get products() {
    return {
      list: (ctx: RunQueryCtx, options?: { includeArchived?: boolean }) =>
        this.listProducts(ctx, options),
      get: (ctx: RunQueryCtx, { productId }: { productId: string }) =>
        this.getProduct(ctx, { productId }),
    };
  }

  /**
   * Customer namespace.
   *
   * - `.retrieve()` — customer record by billing entity (Convex DB)
   * - `.portalUrl()` — generate a Creem customer billing portal URL (Creem API)
   */
  get customers() {
    return {
      retrieve: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.getCustomerByEntityId(ctx, entityId),
      portalUrl: (ctx: RunActionCtx, { entityId }: { entityId: string }) =>
        this.createCustomerPortalSession(ctx, { entityId }),
    };
  }

  /**
   * Order namespace.
   *
   * - `.list()` — one-time orders for a billing entity (Convex DB)
   */
  get orders() {
    return {
      list: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listUserOrders(ctx, { entityId }),
    };
  }

  /**
   * Credits namespace. Wraps Creem Customer Credits API.
   *
   * Entity-scoped methods resolve the default account from a trusted
   * `entityId`. Use these in app functions so account IDs never cross the
   * client boundary.
   *
   * Raw account methods are intentionally server-only building blocks. Never
   * export `createAccount`, `credit`, or `debit` directly as public Convex
   * functions with caller-controlled amounts or account IDs.
   *
   * - `.getBalanceForEntity()` — get the entity's default balance
   * - `.listEntriesForEntity()` — list the entity's default account entries
   * - `.creditForEntity()` — trusted backend credit grant
   * - `.debitForEntity()` — trusted backend credit consumption
   * - `.createAccount()` — raw account creation
   * - `.getBalance()` — raw balance lookup
   * - `.credit()` — raw credit operation
   * - `.debit()` — raw debit operation
   * - `.listEntries()` — raw account entry listing
   * - `.listAccounts()` — list all accounts for a customer
   */
  /**
   * Creem transaction reads scoped to a billing entity.
   *
   * Transactions have no webhook, so this reads through to the Creem API and
   * projects the response into the plain, validated shape `<BillingHistory>`
   * renders.
   */
  get transactions() {
    return {
      search: async (
        ctx: RunQueryCtx,
        {
          entityId,
          orderId,
          productId,
          pageNumber,
          pageSize,
        }: {
          entityId: string;
          orderId?: string;
          productId?: string;
          pageNumber?: number;
          pageSize?: number;
        },
      ): Promise<ConnectedTransactionList> => {
        const emptyPage: ConnectedTransactionList = {
          items: [],
          pagination: {
            totalRecords: 0,
            totalPages: 0,
            currentPage: pageNumber ?? 1,
            nextPage: null,
            prevPage: null,
          },
        };

        const customer = await this.getCustomerByEntityId(ctx, entityId);
        if (!customer) {
          return emptyPage;
        }

        const page = await this.sdk.transactions.search(
          customer.id,
          orderId,
          productId,
          pageNumber,
          pageSize,
        );
        const result = unwrapTransactionSearchPage(page);
        return {
          items: (result.items ?? []).map((transaction) => ({
            id: transaction.id,
            amount: transaction.amount,
            amountPaid: transaction.amountPaid,
            discountAmount: transaction.discountAmount,
            currency: transaction.currency,
            type: transaction.type,
            taxCountry: transaction.taxCountry,
            taxAmount: transaction.taxAmount,
            status: transaction.status,
            refundedAmount: transaction.refundedAmount,
            order: transaction.order,
            subscription: transaction.subscription,
            customer: transaction.customer,
            description: transaction.description,
            periodStart: transaction.periodStart,
            periodEnd: transaction.periodEnd,
            createdAt: transaction.createdAt,
          })),
          pagination: result.pagination ?? emptyPage.pagination,
        };
      },
    };
  }

  get credits() {
    return {
      getBalanceForEntity: async (
        ctx: RunActionCtx,
        { entityId }: { entityId: string },
      ): Promise<CreditBalance> => {
        const accountId = await this.resolveDefaultCreditAccountId(
          ctx,
          entityId,
        );
        const balance = await this.credits.getBalance(accountId);
        return {
          balance: balance.balance,
          ...(balance.updatedAt ? { updatedAt: balance.updatedAt } : {}),
          ...(balance.asOf ? { asOf: balance.asOf } : {}),
        };
      },
      listEntriesForEntity: async (
        ctx: RunActionCtx,
        {
          entityId,
          limit,
          startingAfter,
        }: {
          entityId: string;
          limit?: number;
          startingAfter?: string;
        },
      ): Promise<CreditEntryList> => {
        const accountId = await this.resolveDefaultCreditAccountId(
          ctx,
          entityId,
        );
        // The SDK returns a page iterator, which is not serializable across the
        // Convex boundary. Project the first page into a plain object.
        const page = await this.credits.listEntries(
          accountId,
          limit,
          startingAfter,
        );
        const result = page.result;
        return {
          entries: (result?.data ?? []).map((entry) => ({
            id: entry.id,
            transactionId: entry.transactionId,
            accountId: entry.accountId,
            side: entry.side,
            amount: entry.amount,
            createdAt: entry.createdAt,
          })),
          hasMore: result?.hasMore ?? false,
        };
      },
      creditForEntity: async (
        ctx: RunActionCtx,
        {
          entityId,
          amount,
          reference,
          idempotencyKey,
        }: {
          entityId: string;
          amount: string;
          reference: string;
          idempotencyKey: string;
        },
      ) => {
        const accountId = await this.resolveDefaultCreditAccountId(
          ctx,
          entityId,
        );
        return await this.credits.credit(accountId, {
          amount,
          reference,
          idempotencyKey,
        });
      },
      debitForEntity: async (
        ctx: RunActionCtx,
        {
          entityId,
          amount,
          reference,
          idempotencyKey,
        }: {
          entityId: string;
          amount: string;
          reference: string;
          idempotencyKey: string;
        },
      ) => {
        const accountId = await this.resolveDefaultCreditAccountId(
          ctx,
          entityId,
        );
        return await this.credits.debit(accountId, {
          amount,
          reference,
          idempotencyKey,
        });
      },
      createAccount: async (args: {
        customerId: string;
        name?: string;
        unitLabel?: string;
        initialBalance?: string;
      }) => {
        return await this.sdk.customerCredits.createAccount({
          customerId: args.customerId,
          name: args.name,
          unitLabel: args.unitLabel,
          initialBalance: args.initialBalance,
        });
      },
      getBalance: async (accountId: string) => {
        return await this.sdk.customerCredits.getAccountBalance(accountId);
      },
      credit: async (
        accountId: string,
        args: { amount: string; reference: string; idempotencyKey: string },
      ) => {
        return await this.tolerateCustomerCreditsResponseValidation(() =>
          this.sdk.customerCredits.creditAccount(accountId, args),
        );
      },
      debit: async (
        accountId: string,
        args: { amount: string; reference: string; idempotencyKey: string },
      ) => {
        return await this.tolerateCustomerCreditsResponseValidation(() =>
          this.sdk.customerCredits.debitAccount(accountId, args),
        );
      },
      listEntries: async (
        accountId: string,
        limit?: number,
        startingAfter?: string,
      ) => {
        return await this.sdk.customerCredits.listEntries(
          accountId,
          limit,
          startingAfter,
        );
      },
      listAccounts: async (customerId?: string, limit?: number) => {
        return await this.sdk.customerCredits.listAccounts(limit, customerId);
      },
    };
  }

  // ── Component helpers (public, flat) ──────────────────────

  /**
   * Composite billing model for connected widgets.
   *
   * Aggregates the snapshot, products, subscriptions, and orders into a single
   * object that `<Subscription.Root>` and `<Product.Root>` consume.
   *
   * Graceful when `entityId` is `null` — returns public product catalog only
   * (useful for unauthenticated pricing pages).
   *
   * @param ctx - Convex query context
   * @param options.entityId - Billing entity ID, or `null` for public-only data
   * @param options.user - User info for the UI (widgets display email, etc.)
   */
  async getBillingModel(
    ctx: RunQueryCtx,
    {
      entityId,
      user,
      activePlanId,
      activeFreePlanId,
    }: {
      entityId: string | null;
      user?: { id: string; email: string } | null;
      activePlanId?: string | null;
      activeFreePlanId?: string | null;
    },
  ): Promise<ConnectedBillingModel> {
    const products = await this.listProducts(ctx);
    if (!entityId) {
      return {
        user: user ?? null,
        catalog: this.billingCatalog ?? null,
        snapshot: null,
        allProducts: products,
        ownedProductIds: [],
        subscriptionProductId: null,
        activePlanId: activePlanId ?? activeFreePlanId ?? null,
        activeFreePlanId: activeFreePlanId ?? null,
        appPlanActivations: [],
        appPlanAssignments: [],
        activeSubscriptions: [],
        scheduledSubscriptionUpdates: [],
        hasCreemCustomer: false,
      };
    }
    const [
      snapshot,
      subscription,
      activeSubscriptions,
      customer,
      scheduledSubscriptionUpdates,
      appPlanActivations,
      appPlanAssignments,
    ] = await Promise.all([
      this.getBillingSnapshot(ctx, { entityId }),
      this.getCurrentSubscription(ctx, { entityId }),
      this.listUserSubscriptions(ctx, { entityId }),
      this.getCustomerByEntityId(ctx, entityId),
      ctx.runQuery(this.component.lib.listPendingScheduledSubscriptionUpdates, {
        entityId,
      }),
      this.listAppPlanActivations(ctx, { entityId }),
      this.listAppPlanAssignments(ctx, { entityId }),
    ]);
    const ownedProductIds = [
      ...new Set(
        snapshot.orders
          .filter((order) => order.status === "paid")
          .map((order) => order.productId),
      ),
    ];
    const activeAssignedPlanId =
      (appPlanAssignments ?? []).find(
        (assignment) => assignment.status === "active",
      )?.planId ?? null;
    return {
      user: user ?? null,
      catalog: this.billingCatalog ?? null,
      snapshot,
      allProducts: products,
      ownedProductIds,
      subscriptionProductId: subscription?.productId ?? null,
      activePlanId: activePlanId ?? activeFreePlanId ?? activeAssignedPlanId,
      activeFreePlanId: activeFreePlanId ?? null,
      appPlanActivations: appPlanActivations ?? [],
      appPlanAssignments: appPlanAssignments ?? [],
      activeSubscriptions: activeSubscriptions.map((s) => ({
        id: s.id,
        productId: s.productId,
        status: s.status,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd,
        currentPeriodStart: s.currentPeriodStart,
        units: s.seats ?? null,
        recurringInterval: s.recurringInterval,
        trialEnd: s.trialEnd ?? null,
      })),
      scheduledSubscriptionUpdates: scheduledSubscriptionUpdates ?? [],
      hasCreemCustomer: customer != null,
    };
  }

  // ── api({ resolve }) convenience ──────────────────────────

  /**
   * Generate ready-to-export Convex function definitions.
   *
   * Each function calls your `resolve` callback to authenticate the user
   * and determine the billing entity, then delegates to the corresponding
   * namespace method. Destructure and re-export in your `convex/billing.ts`.
   *
   * For full control, use the namespace getters directly instead
   * (e.g. `creem.subscriptions.cancel(ctx, { entityId })`).
   *
   * @param options.resolve - Auth callback that returns `{ userId, email, entityId }`
   * @returns Entity-scoped UI, checkout, subscription, customer, transaction,
   * plan, order, and credit-read function definitions plus public product reads.
   *
   * @example
   * ```ts
   * const { uiModel, checkouts, subscriptions } = creem.api({ resolve });
   * export { uiModel };
   * export const checkoutsCreate = checkouts.create;
   * ```
   */
  api({ resolve }: { resolve: ApiResolver }) {
    return {
      uiModel: queryGeneric({
        args: {},
        returns: connectedBillingModelValidator,
        handler: async (ctx): Promise<ConnectedBillingModel> => {
          const resolved = await resolveOptionalIdentity(resolve, ctx);
          return await this.getBillingModel(ctx, {
            entityId: resolved?.entityId ?? null,
            user: resolved
              ? { id: resolved.userId, email: resolved.email }
              : null,
            activeFreePlanId: resolved?.activeFreePlanId,
            activePlanId: resolved?.activePlanId,
          });
        },
      }),
      snapshot: queryGeneric({
        args: {},
        returns: v.union(billingSnapshotValidator, v.null()),
        handler: async (ctx): Promise<BillingSnapshot | null> => {
          const resolved = await resolveOptionalIdentity(resolve, ctx);
          if (!resolved) return null;
          return await this.getBillingSnapshot(ctx, {
            entityId: resolved.entityId,
          });
        },
      }),
      checkouts: {
        create: actionGeneric({
          args: checkoutCreateArgs,
          returns: v.object({ url: v.string() }),
          handler: async (ctx, args): Promise<{ url: string }> => {
            const { entityId, userId, email } = await requireIdentity(
              resolve,
              ctx,
            );
            return await this.checkouts.create(ctx, {
              entityId,
              userId,
              email,
              ...args,
            });
          },
        }),
      },
      subscriptions: {
        update: mutationGeneric({
          args: subscriptionUpdateArgs,
          returns: v.null(),
          handler: async (ctx, args): Promise<null> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            // Convex args must be a flat object, so narrow the permissive wire
            // shape into the discriminated union the namespace method takes.
            let update: SubscriptionUpdateArgs;
            try {
              update = parseSubscriptionUpdateArgs(args);
            } catch (error) {
              throw new ConvexError(
                error instanceof Error ? error.message : "Invalid update args",
              );
            }
            await this.subscriptions.update(ctx, { entityId, ...update });
            return null;
          },
        }),
        cancel: mutationGeneric({
          args: subscriptionCancelArgs,
          returns: v.null(),
          handler: async (ctx, args): Promise<null> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            await this.subscriptions.cancel(ctx, { entityId, ...args });
            return null;
          },
        }),
        resume: mutationGeneric({
          args: subscriptionResumeArgs,
          returns: v.null(),
          handler: async (ctx, args): Promise<null> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            await this.subscriptions.resume(ctx, { entityId, ...args });
            return null;
          },
        }),
        cancelScheduledUpdate: mutationGeneric({
          args: subscriptionCancelScheduledUpdateArgs,
          returns: v.object({ canceled: v.boolean() }),
          handler: async (ctx, args): Promise<{ canceled: boolean }> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.subscriptions.cancelScheduledUpdate(ctx, {
              entityId,
              ...args,
            });
          },
        }),
        pause: mutationGeneric({
          args: subscriptionPauseArgs,
          returns: v.null(),
          handler: async (ctx, args): Promise<null> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            await this.subscriptions.pause(ctx, { entityId, ...args });
            return null;
          },
        }),
        list: queryGeneric({
          args: {},
          returns: v.array(
            v.object({
              ...schema.tables.subscriptions.validator.fields,
              product: v.union(schema.tables.products.validator, v.null()),
            }),
          ),
          handler: async (ctx) => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.subscriptions.list(ctx, { entityId });
          },
        }),
        listAll: queryGeneric({
          args: {},
          returns: v.array(
            v.object({
              ...schema.tables.subscriptions.validator.fields,
              product: v.union(schema.tables.products.validator, v.null()),
            }),
          ),
          handler: async (ctx) => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.subscriptions.listAll(ctx, { entityId });
          },
        }),
      },
      products: {
        list: queryGeneric({
          args: {},
          returns: v.array(schema.tables.products.validator),
          handler: async (ctx) => {
            return await this.products.list(ctx);
          },
        }),
        get: queryGeneric({
          args: { productId: v.string() },
          returns: v.union(schema.tables.products.validator, v.null()),
          handler: async (ctx, args) => {
            return await this.products.get(ctx, { productId: args.productId });
          },
        }),
      },
      customers: {
        retrieve: queryGeneric({
          args: {},
          returns: v.union(schema.tables.customers.validator, v.null()),
          handler: async (ctx) => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.customers.retrieve(ctx, { entityId });
          },
        }),
        portalUrl: actionGeneric({
          args: {},
          returns: v.object({ url: v.string() }),
          handler: async (ctx): Promise<{ url: string }> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.customers.portalUrl(ctx, { entityId });
          },
        }),
      },
      transactions: {
        search: actionGeneric({
          args: transactionsSearchArgs,
          returns: connectedTransactionListValidator,
          handler: async (ctx, args): Promise<ConnectedTransactionList> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.transactions.search(ctx, { entityId, ...args });
          },
        }),
      },
      plans: {
        activate: mutationGeneric({
          args: appPlanActivateArgs,
          returns: v.object({ success: v.boolean() }),
          handler: async (ctx, args): Promise<{ success: boolean }> => {
            const { entityId, userId, activePlanId, activeFreePlanId } =
              await requireIdentity(resolve, ctx);
            await this.appPlans.activate(ctx, {
              entityId,
              planId: args.planId,
              activatedByUserId: userId,
              activePlanId,
              activeFreePlanId,
            });
            return { success: true };
          },
        }),
      },
      orders: {
        list: queryGeneric({
          args: {},
          returns: v.array(schema.tables.orders.validator),
          handler: async (ctx) => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.orders.list(ctx, { entityId });
          },
        }),
      },
      credits: {
        getBalance: actionGeneric({
          args: {},
          returns: creditBalanceValidator,
          handler: async (ctx): Promise<CreditBalance> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.credits.getBalanceForEntity(ctx, { entityId });
          },
        }),
        listEntries: actionGeneric({
          args: creditsListEntriesArgs,
          returns: creditEntryListValidator,
          handler: async (ctx, args): Promise<CreditEntryList> => {
            const { entityId } = await requireIdentity(resolve, ctx);
            return await this.credits.listEntriesForEntity(ctx, {
              entityId,
              limit: args.limit,
              startingAfter: args.startingAfter,
            });
          },
        }),
      },
    };
  }

  /**
   * Register the Creem webhook HTTP route on your Convex `httpRouter`.
   *
   * Automatically handles supported Creem checkout, subscription, and refund
   * events — upserts customers, subscriptions, and orders in the Convex DB.
   * Dispute events are verified and dispatched to custom handlers.
   *
   * @param http - Your Convex HTTP router (from `httpRouter()`)
   * @param options.path - Webhook endpoint path (default: `"/creem/events"`)
   * @param options.events - Optional custom handlers that run **after** built-in processing
   *
   * @example
   * ```ts
   * const http = httpRouter();
   * creem.registerRoutes(http, {
   *   events: {
   *     "checkout.completed": async (ctx, event) => { ... },
   *   },
   * });
   * ```
   */
  registerRoutes(
    http: HttpRouter,
    {
      path = "/creem/events",
      events,
    }: {
      path?: string;
      events?: WebhookEventHandlers;
    } = {},
  ) {
    const mergedEvents: WebhookEventHandlers = { ...events };

    http.route({
      path,
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        if (!request.body) {
          throw new ConvexError("No body");
        }
        const body = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        let event: WebhookEventEntity;
        try {
          event = await this.constructWebhookEvent(body, headers);
        } catch (error) {
          if (error instanceof ConvexError) {
            throw error;
          }
          if (error instanceof WebhookVerificationError) {
            console.error(error);
            return new Response("Forbidden", { status: 403 });
          }
          console.error(error);
          return new Response("Bad Request", { status: 400 });
        }

        const eventType = getEventType(event);
        const eventData = event.object;

        // Log identifiers only. The full event carries customer PII (email,
        // name, country) and would otherwise land in every deployment's logs
        // with no way to opt out. Set CREEM_WEBHOOK_DEBUG=true to log the raw
        // body while debugging an integration.
        if (process.env.CREEM_WEBHOOK_DEBUG === "true") {
          console.log(
            `[creem-webhook] eventType=${eventType}`,
            `body=${JSON.stringify(event)}`,
          );
        } else {
          console.log(
            `[creem-webhook] eventType=${eventType}`,
            `id=${event.id ?? "unknown"}`,
          );
        }

        if (
          eventData &&
          typeof eventData === "object" &&
          event.eventType === "checkout.completed"
        ) {
          const raw = eventData as Record<string, unknown>;
          const checkout = event.object;
          if (checkout) {
            // Auto-create customer record from checkout metadata
            const customerObj =
              typeof checkout.customer === "object"
                ? checkout.customer
                : undefined;
            // Resolve from the raw field, not `customerObj`: Creem sends
            // `customer` either expanded or as a bare ID string, and only the
            // expanded form carries the profile fields used for enrichment.
            // Reading the narrowed object would drop the ID in the string case.
            const customerId = getCustomerId(checkout.customer);
            const entityId = getConvexEntityId(checkout.metadata);
            await this.upsertCustomerFromWebhook(
              ctx,
              customerId,
              entityId,
              customerObj as CustomerEntity | undefined,
            );

            // Process embedded subscription if present (recurring checkout).
            // checkoutEntityFromJSON already parsed it into a typed SubscriptionEntity,
            // so use it directly — do NOT re-parse through subscriptionEntityFromJSON.
            if (
              checkout.subscription &&
              typeof checkout.subscription === "object"
            ) {
              const embeddedSub = checkout.subscription as SubscriptionEntity;
              // Prefer subscription metadata from the embedded payload, with
              // checkout metadata as a fallback for older checkout webhooks.
              const embeddedRaw = (raw.subscription ?? {}) as Record<
                string,
                unknown
              >;
              const rawMeta = (embeddedRaw.metadata ??
                checkout.metadata ??
                {}) as Record<string, unknown>;
              const subscription = convertToDatabaseSubscription(embeddedSub, {
                rawMetadata: rawMeta,
              });
              await ctx.runMutation(this.component.lib.createSubscription, {
                subscription,
              });
              if (
                entityId &&
                (subscription.status === "active" ||
                  subscription.status === "trialing")
              ) {
                await ctx.runMutation(
                  this.component.lib.endActiveAppPlanAssignments,
                  {
                    entityId,
                    endedAt: subscription.startedAt ?? new Date().toISOString(),
                  },
                );
              }
            }

            // Store the order (present for both one-time and subscription checkouts)
            if (checkout.order && typeof checkout.order === "object") {
              const o = checkout.order as Record<string, unknown>;
              const order = convertToOrder(
                {
                  id: o.id as string,
                  customer: (o.customer as string) ?? null,
                  product: o.product as string,
                  amount: o.amount as number,
                  currency: o.currency as string,
                  status: o.status as string,
                  type: o.type as string,
                  transaction: (o.transaction as string) ?? null,
                  subTotal: o.subTotal as number | undefined,
                  sub_total: o.sub_total as number | undefined,
                  taxAmount: o.taxAmount as number | undefined,
                  tax_amount: o.tax_amount as number | undefined,
                  discountAmount: o.discountAmount as number | undefined,
                  discount_amount: o.discount_amount as number | undefined,
                  amountDue: o.amountDue as number | undefined,
                  amount_due: o.amount_due as number | undefined,
                  amountPaid: o.amountPaid as number | undefined,
                  amount_paid: o.amount_paid as number | undefined,
                  discount: (o.discount as string) ?? null,
                  affiliate: (o.affiliate as string) ?? null,
                  mode: o.mode as string | undefined,
                  createdAt: o.createdAt as Date | string | undefined,
                  created_at: o.created_at as string | undefined,
                  updatedAt: o.updatedAt as Date | string | undefined,
                  updated_at: o.updated_at as string | undefined,
                },
                {
                  checkoutId: checkout.id,
                  customerId,
                  metadata: checkout.metadata as
                    | Record<string, unknown>
                    | undefined,
                },
              );
              await ctx.runMutation(this.component.lib.createOrder, {
                order,
              });
            }

            await this.creditCheckoutCustomerCredits(checkout);
          }
        }

        if (
          eventData &&
          typeof eventData === "object" &&
          event.eventType === "refund.created"
        ) {
          await this.debitRefundedCustomerCredits(event.object);
        }

        if (
          eventData &&
          typeof eventData === "object" &&
          isGeneratedSubscriptionWebhookEvent(event)
        ) {
          const parsed = event.object;
          const subscription = convertToDatabaseSubscription(parsed, {
            rawMetadata: (parsed.metadata ?? {}) as Record<string, unknown>,
          });
          await ctx.runMutation(this.component.lib.updateSubscription, {
            subscription,
          });

          // Auto-create customer record from subscription metadata
          const customerEntity =
            typeof parsed.customer === "object"
              ? (parsed.customer as CustomerEntity)
              : undefined;
          const customerId = getCustomerId(parsed.customer);
          const entityId = getConvexEntityId(parsed.metadata);
          await this.upsertCustomerFromWebhook(
            ctx,
            customerId,
            entityId,
            customerEntity,
          );
          if (
            entityId &&
            (subscription.status === "active" ||
              subscription.status === "trialing")
          ) {
            await ctx.runMutation(
              this.component.lib.endActiveAppPlanAssignments,
              {
                entityId,
                endedAt: subscription.startedAt ?? new Date().toISOString(),
              },
            );
          }
        }

        const handler = supportedWebhookEvents.has(eventType)
          ? mergedEvents[eventType]
          : undefined;
        if (handler) {
          await handler(ctx, event);
        }

        return new Response("Accepted", { status: 202 });
      }),
    });
  }
}
