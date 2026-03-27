import "./polyfill.js";
import { Creem as CreemSDK } from "creem";
import type {
  CheckoutEntity,
  CustomerEntity,
  SubscriptionEntity,
} from "creem/models/components";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import {
  getEntityId,
  lowerCaseHeaders,
  toHex,
  constantTimeEqual,
  normalizeSignature,
} from "./helpers.js";
import {
  type CreemWebhookEvent,
  getEventType,
  getEventData,
  getCustomerId,
  getConvexEntityId,
  parseSubscription,
  parseCheckout,
  parseProduct,
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
  convertToDatabaseProduct,
  convertToDatabaseSubscription,
  convertToOrder,
  type RunActionCtx,
} from "../component/util.js";
import type { ComponentApi } from "../component/_generated/component.js";
import { resolveBillingSnapshot as defaultResolveBillingSnapshot } from "../core/resolver.js";
import type {
  BillingSnapshot,
  PaymentSnapshot,
  SubscriptionSnapshot,
} from "../core/types.js";

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
  manualParseSubscription,
} from "./parsers.js";

/** Convex validator for the `subscriptions` table. Use with `v.object(subscriptionValidator.fields)` in custom functions. */
export const subscriptionValidator = schema.tables.subscriptions.validator;
/** TypeScript type for a subscription document (inferred from the Convex schema). */
export type Subscription = Infer<typeof subscriptionValidator>;

// ── Shared arg validators for custom actions / mutations ──────────────
// Use these when writing your own Convex functions that wrap creem methods
// (e.g. for RBAC). They match exactly what the connected widgets send.

/**
 * Convex arg validator for checkout creation.
 * Matches the args sent by `<Subscription.Root>` and `<Product.Root>` widgets.
 * Use in your own `action()` definitions for custom RBAC wrappers.
 */
export const checkoutCreateArgs = {
  productId: v.string(),
  successUrl: v.optional(v.string()),
  fallbackSuccessUrl: v.optional(v.string()),
  units: v.optional(v.number()),
  metadata: v.optional(v.record(v.string(), v.string())),
  discountCode: v.optional(v.string()),
  theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
};

/**
 * Convex arg validator for subscription updates (plan switch or seat change).
 * Matches the args sent by `<Subscription.Root>` widgets.
 */
export const subscriptionUpdateArgs = {
  subscriptionId: v.optional(v.string()),
  productId: v.optional(v.string()),
  units: v.optional(v.number()),
  updateBehavior: v.optional(
    v.union(
      v.literal("proration-charge-immediately"),
      v.literal("proration-charge"),
      v.literal("proration-none"),
    ),
  ),
};

/**
 * Convex arg validator for subscription cancellation.
 * Matches the args sent by `<Subscription.Root>` cancel button.
 */
export const subscriptionCancelArgs = {
  subscriptionId: v.optional(v.string()),
  revokeImmediately: v.optional(v.boolean()),
};

/**
 * Convex arg validator for subscription resume.
 * Matches the args sent by `<Subscription.Root>` resume button.
 */
export const subscriptionResumeArgs = {
  subscriptionId: v.optional(v.string()),
};

/**
 * Convex arg validator for subscription pause.
 * Matches the args sent by `<Subscription.Root>` pause button.
 */
export const subscriptionPauseArgs = {
  subscriptionId: v.optional(v.string()),
};

/** Function reference type for internal mutations that receive a subscription document. */
export type SubscriptionHandler = FunctionReference<
  "mutation",
  "internal",
  { subscription: Subscription }
>;

/**
 * Map of webhook event type → handler function.
 * Handlers run **after** the component's built-in processing (customer/subscription/order upserts).
 * The `ctx` is a Convex mutation context — you can read/write to your own tables.
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
  (ctx: RunMutationCtx, event: CreemWebhookEvent) => Promise<void> | void
>;

/**
 * Callback that resolves the authenticated user for `creem.api({ resolve })`.
 * Called on every generated Convex function to determine the billing entity.
 *
 * - `userId` — your app's user ID (stored in checkout metadata as `convexUserId`)
 * - `email` — user's email (passed to Creem for customer creation)
 * - `entityId` — billing entity ID. For personal billing, same as `userId`.
 *   For org billing, return the org ID so all billing scopes to the organization.
 *
 * @example
 * ```ts
 * const resolve: ApiResolver = async (ctx) => {
 *   const user = await ctx.runQuery(api.users.currentUser);
 *   return { userId: user._id, email: user.email, entityId: user._id };
 * };
 * ```
 */
export type ApiResolver = (ctx: RunQueryCtx) => Promise<{
  userId: string;
  email: string;
  entityId: string;
}>;

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
  /** Creem SDK server index (for non-default endpoints). Falls back to `CREEM_SERVER_IDX` env var. */
  serverIdx?: number;
  /** Creem SDK server URL override (for test/staging). Falls back to `CREEM_SERVER_URL` env var. */
  serverURL?: string;
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
 * import { Creem } from "@mmailaender/convex-creem";
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
  private serverIdx?: number;
  private serverURL?: string;

  constructor(
    public component: ComponentApi,
    private config: CreemConfig = {},
  ) {
    this.apiKey = config.apiKey ?? process.env["CREEM_API_KEY"] ?? "";
    this.webhookSecret =
      config.webhookSecret ?? process.env["CREEM_WEBHOOK_SECRET"] ?? "";
    this.serverIdx =
      config.serverIdx ??
      (process.env["CREEM_SERVER_IDX"]
        ? Number(process.env["CREEM_SERVER_IDX"])
        : undefined);
    this.serverURL = config.serverURL ?? process.env["CREEM_SERVER_URL"];

    this.sdk = new CreemSDK({
      apiKey: this.apiKey,
      ...(this.serverIdx !== undefined ? { serverIdx: this.serverIdx } : {}),
      ...(this.serverURL ? { serverURL: this.serverURL } : {}),
    });
  }
  private getCustomerByEntityId(ctx: RunQueryCtx, entityId: string) {
    return ctx.runQuery(this.component.lib.getCustomerByEntityId, { entityId });
  }

  /** Pull all products from the Creem API into the Convex database. Typically called once via `internalAction` or the CLI. */
  async syncProducts(ctx: RunActionCtx) {
    await ctx.runAction(this.component.lib.syncProducts, {
      apiKey: this.apiKey,
      serverIdx: this.serverIdx,
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
          country: customerObj?.country,
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
    const subscription = await ctx.runQuery(
      this.component.lib.getCurrentSubscription,
      {
        entityId,
      },
    );
    if (!subscription) {
      return null;
    }
    const product = await ctx.runQuery(this.component.lib.getProduct, {
      id: subscription.productId,
    });
    if (!product) {
      throw new ConvexError("Product not found");
    }
    return {
      ...subscription,
      product,
    };
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
  /** Return paid one-time orders for an entity. */
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
  private toSubscriptionSnapshot(
    subscription: Subscription,
  ): SubscriptionSnapshot {
    return {
      id: subscription.id,
      productId: subscription.productId,
      status: subscription.status,
      recurringInterval: subscription.recurringInterval,
      seats: subscription.seats,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd ?? null,
    };
  }

  /**
   * Resolve the current billing state for a billing entity.
   * Returns plan, status, available actions, subscription metadata, etc.
   * Used internally by `getBillingModel` and exposed for custom billing UIs.
   */
  async getBillingSnapshot(
    ctx: RunQueryCtx,
    {
      entityId,
      payment,
    }: {
      entityId: string;
      payment?: PaymentSnapshot | null;
    },
  ): Promise<BillingSnapshot> {
    const [currentSubscription, allSubscriptions] = await Promise.all([
      this.getCurrentSubscription(ctx, { entityId }),
      this.listAllUserSubscriptions(ctx, { entityId }),
    ]);

    return defaultResolveBillingSnapshot({
      currentSubscription: currentSubscription
        ? this.toSubscriptionSnapshot(currentSubscription)
        : null,
      allSubscriptions: allSubscriptions.map((subscription) =>
        this.toSubscriptionSnapshot(subscription),
      ),
      payment: payment ?? null,
      userContext: undefined,
    });
  }

  private async verifyWebhook(body: string, headers: Record<string, string>) {
    if (!this.webhookSecret) {
      throw new ConvexError("Missing CREEM_WEBHOOK_SECRET");
    }

    const normalized = lowerCaseHeaders(headers);
    const webhookId = normalized["webhook-id"];
    const webhookTimestamp = normalized["webhook-timestamp"];
    const webhookSignature = normalized["webhook-signature"];

    if (webhookId && webhookTimestamp && webhookSignature) {
      new Webhook(this.webhookSecret).verify(body, {
        "webhook-id": webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": webhookSignature,
      });
      return;
    }

    const creemSignature =
      normalized["creem-signature"] ?? normalized["x-creem-signature"];
    if (!creemSignature) {
      throw new WebhookVerificationError("Missing webhook signature");
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body),
    );
    const expected = toHex(new Uint8Array(digest));
    if (!constantTimeEqual(normalizeSignature(creemSignature), expected)) {
      throw new WebhookVerificationError("Invalid webhook signature");
    }
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
        country: customerEntity?.country,
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
   * - `.update()` — plan switch (`productId`) or seat change (`units`) (Creem API, optimistic)
   * - `.cancel()` — cancel subscription (Creem API, optimistic)
   * - `.pause()` — pause an active subscription (Creem API, optimistic)
   * - `.resume()` — resume a paused or scheduled-cancel subscription (Creem API, optimistic)
   */
  get subscriptions() {
    type UpdateBehavior =
      | "proration-charge-immediately"
      | "proration-charge"
      | "proration-none";
    return {
      getCurrent: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.getCurrentSubscription(ctx, { entityId }),
      list: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listUserSubscriptions(ctx, { entityId }),
      listAll: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listAllUserSubscriptions(ctx, { entityId }),
      update: async (
        ctx: RunSchedulerMutationCtx,
        args: {
          entityId: string;
          subscriptionId?: string;
          productId?: string;
          units?: number;
          updateBehavior?: UpdateBehavior;
        },
      ) => {
        if (args.productId && args.units)
          throw new ConvexError("Provide productId OR units, not both");
        if (!args.productId && !args.units)
          throw new ConvexError("Provide productId or units");

        // Resolve current subscription
        const subscription = args.subscriptionId
          ? await ctx.runQuery(this.component.lib.getSubscription, {
              id: args.subscriptionId,
            })
          : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
              entityId: args.entityId,
            });
        if (!subscription) throw new ConvexError("Subscription not found");

        // Write optimistic state
        await ctx.runMutation(this.component.lib.patchSubscription, {
          subscriptionId: subscription.id,
          ...(args.units != null ? { seats: args.units } : {}),
          ...(args.productId ? { productId: args.productId } : {}),
          ...(args.productId && args.units == null
            ? { seats: subscription.seats ?? null }
            : {}),
        });

        // Schedule the Creem API call (runs async, reverts on error)
        await ctx.scheduler.runAfter(
          0,
          this.component.lib.executeSubscriptionUpdate,
          {
            apiKey: this.apiKey,
            serverIdx: this.serverIdx,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            productId: args.productId,
            units: args.units,
            updateBehavior: args.updateBehavior,
            previousSeats: subscription.seats ?? undefined,
            previousProductId: subscription.productId,
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
        const subscription = args.subscriptionId
          ? await ctx.runQuery(this.component.lib.getSubscription, {
              id: args.subscriptionId,
            })
          : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
              entityId: args.entityId,
            });
        if (!subscription) throw new ConvexError("Subscription not found");
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
            serverIdx: this.serverIdx,
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
        const subscription = args.subscriptionId
          ? await ctx.runQuery(this.component.lib.getSubscription, {
              id: args.subscriptionId,
            })
          : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
              entityId: args.entityId,
            });
        if (!subscription) throw new ConvexError("Subscription not found");
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
            serverIdx: this.serverIdx,
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
        const subscription = args.subscriptionId
          ? await ctx.runQuery(this.component.lib.getSubscription, {
              id: args.subscriptionId,
            })
          : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
              entityId: args.entityId,
            });
        if (!subscription) throw new ConvexError("Subscription not found");
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
            serverIdx: this.serverIdx,
            serverURL: this.serverURL,
            subscriptionId: subscription.id,
            operation: "resume",
            previousStatus: subscription.status,
            previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          },
        );
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
   * - `.list()` — paid one-time orders for a billing entity (Convex DB)
   */
  get orders() {
    return {
      list: (ctx: RunQueryCtx, { entityId }: { entityId: string }) =>
        this.listUserOrders(ctx, { entityId }),
    };
  }

  // ── Component helpers (public, flat) ──────────────────────

  /**
   * Composite billing model for connected widgets.
   *
   * Aggregates snapshot + products + subscriptions + orders into a single
   * object that `<Subscription.Root>` and `<Product.Root>` widgets consume.
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
    }: {
      entityId: string | null;
      user?: { _id: string; email: string } | null;
    },
  ) {
    const products = await this.listProducts(ctx);
    if (!entityId) {
      return {
        user: user ?? null,
        billingSnapshot: null as BillingSnapshot | null,
        allProducts: products,
        ownedProductIds: [] as string[],
        subscriptionProductId: null as string | null,
        activeSubscriptions: [] as Array<{
          id: string;
          productId: string;
          status: string;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: string | null;
          currentPeriodStart: string;
          seats: number | null;
          recurringInterval: string | null;
          trialEnd: string | null;
        }>,
        hasCreemCustomer: false,
      };
    }
    const [
      billingSnapshot,
      subscription,
      activeSubscriptions,
      customer,
      orders,
    ] = await Promise.all([
      this.getBillingSnapshot(ctx, { entityId }),
      this.getCurrentSubscription(ctx, { entityId }),
      this.listUserSubscriptions(ctx, { entityId }),
      this.getCustomerByEntityId(ctx, entityId),
      this.listUserOrders(ctx, { entityId }),
    ]);
    const ownedProductIds = [...new Set(orders.map((o) => o.productId))];
    return {
      user: user ?? null,
      billingSnapshot,
      allProducts: products,
      ownedProductIds,
      subscriptionProductId: subscription?.productId ?? null,
      activeSubscriptions: activeSubscriptions.map((s) => ({
        id: s.id,
        productId: s.productId,
        status: s.status,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd,
        currentPeriodStart: s.currentPeriodStart,
        seats: s.seats,
        recurringInterval: s.recurringInterval,
        trialEnd: s.trialEnd ?? null,
      })),
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
   * @returns Object with `uiModel`, `snapshot`, `checkouts`, `subscriptions`, `products`, `customers`, `orders`
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
        returns: v.any(),
        handler: async (ctx) => {
          let resolved: {
            userId: string;
            email: string;
            entityId: string;
          } | null = null;
          try {
            resolved = await resolve(ctx);
          } catch {
            // No authenticated user — return unauthenticated model
          }
          return await this.getBillingModel(ctx, {
            entityId: resolved?.entityId ?? null,
            user: resolved
              ? { _id: resolved.userId, email: resolved.email }
              : null,
          });
        },
      }),
      snapshot: queryGeneric({
        args: {},
        returns: v.any(),
        handler: async (ctx) => {
          let resolved: { entityId: string } | null = null;
          try {
            resolved = await resolve(ctx);
          } catch {
            return null;
          }
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
          handler: async (ctx, args) => {
            const { entityId, userId, email } = await resolve(ctx);
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
          handler: async (ctx, args) => {
            const { entityId } = await resolve(ctx);
            if (args.productId && args.units)
              throw new ConvexError("Provide productId OR units, not both");
            if (!args.productId && !args.units)
              throw new ConvexError("Provide productId or units");

            // Resolve current subscription
            const subscription = args.subscriptionId
              ? await ctx.runQuery(this.component.lib.getSubscription, {
                  id: args.subscriptionId,
                })
              : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
                  entityId,
                });
            if (!subscription) throw new ConvexError("Subscription not found");

            // Write optimistic state
            // For plan switches, also protect current seats from stale webhook data
            await ctx.runMutation(this.component.lib.patchSubscription, {
              subscriptionId: subscription.id,
              ...(args.units != null ? { seats: args.units } : {}),
              ...(args.productId ? { productId: args.productId } : {}),
              ...(args.productId && args.units == null
                ? { seats: subscription.seats ?? null }
                : {}),
            });

            // Schedule the Creem API call (runs async, reverts on error)
            await ctx.scheduler.runAfter(
              0,
              this.component.lib.executeSubscriptionUpdate,
              {
                apiKey: this.apiKey,
                serverIdx: this.serverIdx,
                serverURL: this.serverURL,
                subscriptionId: subscription.id,
                productId: args.productId,
                units: args.units,
                updateBehavior: args.updateBehavior,
                previousSeats: subscription.seats ?? undefined,
                previousProductId: subscription.productId,
              },
            );
          },
        }),
        cancel: mutationGeneric({
          args: subscriptionCancelArgs,
          handler: async (ctx, args) => {
            const { entityId } = await resolve(ctx);
            const subscription = args.subscriptionId
              ? await ctx.runQuery(this.component.lib.getSubscription, {
                  id: args.subscriptionId,
                })
              : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
                  entityId,
                });
            if (!subscription) throw new ConvexError("Subscription not found");
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
                serverIdx: this.serverIdx,
                serverURL: this.serverURL,
                subscriptionId: subscription.id,
                operation: "cancel",
                cancelMode,
                previousStatus: subscription.status,
                previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              },
            );
          },
        }),
        resume: mutationGeneric({
          args: subscriptionResumeArgs,
          handler: async (ctx, args) => {
            const { entityId } = await resolve(ctx);
            const subscription = args.subscriptionId
              ? await ctx.runQuery(this.component.lib.getSubscription, {
                  id: args.subscriptionId,
                })
              : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
                  entityId,
                });
            if (!subscription) throw new ConvexError("Subscription not found");
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
                serverIdx: this.serverIdx,
                serverURL: this.serverURL,
                subscriptionId: subscription.id,
                operation: "resume",
                previousStatus: subscription.status,
                previousCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              },
            );
          },
        }),
        pause: mutationGeneric({
          args: subscriptionPauseArgs,
          handler: async (ctx, args) => {
            const { entityId } = await resolve(ctx);
            const subscription = args.subscriptionId
              ? await ctx.runQuery(this.component.lib.getSubscription, {
                  id: args.subscriptionId,
                })
              : await ctx.runQuery(this.component.lib.getCurrentSubscription, {
                  entityId,
                });
            if (!subscription) throw new ConvexError("Subscription not found");
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
                serverIdx: this.serverIdx,
                serverURL: this.serverURL,
                subscriptionId: subscription.id,
                operation: "pause",
                previousStatus: subscription.status,
              },
            );
          },
        }),
        list: queryGeneric({
          args: {},
          returns: v.any(),
          handler: async (ctx) => {
            const { entityId } = await resolve(ctx);
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
            const { entityId } = await resolve(ctx);
            return await this.subscriptions.listAll(ctx, { entityId });
          },
        }),
      },
      products: {
        list: queryGeneric({
          args: {},
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
            const { entityId } = await resolve(ctx);
            return await this.customers.retrieve(ctx, { entityId });
          },
        }),
        portalUrl: actionGeneric({
          args: {},
          returns: v.object({ url: v.string() }),
          handler: async (ctx) => {
            const { entityId } = await resolve(ctx);
            return await this.customers.portalUrl(ctx, { entityId });
          },
        }),
      },
      orders: {
        list: queryGeneric({
          args: {},
          returns: v.array(schema.tables.orders.validator),
          handler: async (ctx) => {
            const { entityId } = await resolve(ctx);
            return await this.orders.list(ctx, { entityId });
          },
        }),
      },
    };
  }

  /**
   * Register the Creem webhook HTTP route on your Convex `httpRouter`.
   *
   * Automatically handles `checkout.completed`, `subscription.*`, and `product.*`
   * events — upserts customers, subscriptions, orders, and products in the Convex DB.
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
        try {
          await this.verifyWebhook(body, headers);
          const event = JSON.parse(body) as CreemWebhookEvent;
          const eventType = getEventType(event);
          const eventData = getEventData(event);

          console.log(
            `[creem-webhook] eventType=${eventType}`,
            `body=${JSON.stringify(event)}`,
          );

          if (
            eventData &&
            typeof eventData === "object" &&
            eventType.startsWith("checkout.")
          ) {
            const raw = eventData as Record<string, unknown>;
            const checkout = parseCheckout(raw);
            if (checkout && eventType === "checkout.completed") {
              // Auto-create customer record from checkout metadata
              const customerObj =
                typeof checkout.customer === "object"
                  ? checkout.customer
                  : undefined;
              const customerId = getCustomerId(customerObj);
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
                // Recover metadata: SDK strips it from SubscriptionEntity.
                // Use checkout-level metadata as fallback (same convexUserId).
                const embeddedRaw = (raw.subscription ?? {}) as Record<
                  string,
                  unknown
                >;
                const rawMeta = (embeddedRaw.metadata ??
                  checkout.metadata ??
                  {}) as Record<string, unknown>;
                const subscription = convertToDatabaseSubscription(
                  embeddedSub,
                  { rawMetadata: rawMeta },
                );
                await ctx.runMutation(this.component.lib.createSubscription, {
                  subscription,
                });
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
                    metadata: checkout.metadata as
                      | Record<string, unknown>
                      | undefined,
                  },
                );
                await ctx.runMutation(this.component.lib.createOrder, {
                  order,
                });
              }
            }
          }

          if (
            eventData &&
            typeof eventData === "object" &&
            eventType.startsWith("subscription.")
          ) {
            const raw = eventData as Record<string, unknown>;
            const parsed = parseSubscription(raw);
            if (parsed) {
              // Pass raw metadata since SDK's SubscriptionEntity type strips it
              const rawMeta = (raw.metadata ?? {}) as Record<string, unknown>;
              const subscription = convertToDatabaseSubscription(parsed, {
                rawMetadata: rawMeta,
              });
              if (eventType === "subscription.created") {
                await ctx.runMutation(this.component.lib.createSubscription, {
                  subscription,
                });
              } else {
                await ctx.runMutation(this.component.lib.updateSubscription, {
                  subscription,
                });
              }

              // Auto-create customer record from subscription metadata
              const customerEntity =
                typeof parsed.customer === "object"
                  ? (parsed.customer as CustomerEntity)
                  : undefined;
              const customerId = getCustomerId(parsed.customer);
              const entityId = getConvexEntityId(
                raw.metadata ??
                  (parsed as unknown as Record<string, unknown>).metadata,
              );
              await this.upsertCustomerFromWebhook(
                ctx,
                customerId,
                entityId,
                customerEntity,
              );
            } else {
              // Fallback: SDK parsing failed (e.g., unknown status)
              // Still try to extract subscription ID for update events
              const subId = typeof raw.id === "string" ? raw.id : null;
              if (subId) {
                console.warn(
                  `Could not parse subscription for ${eventType}, id: ${subId}`,
                );
              }
            }
          }

          if (
            eventData &&
            typeof eventData === "object" &&
            eventType.startsWith("product.")
          ) {
            const raw = eventData as Record<string, unknown>;
            const parsed = parseProduct(raw);
            if (parsed) {
              const product = convertToDatabaseProduct(parsed);
              if (eventType === "product.created") {
                await ctx.runMutation(this.component.lib.createProduct, {
                  product,
                });
              } else {
                await ctx.runMutation(this.component.lib.updateProduct, {
                  product,
                });
              }
            } else {
              console.warn(`Could not parse product for ${eventType}`);
            }
          }

          const handler = mergedEvents[eventType];
          if (handler) {
            await handler(ctx, event);
          }

          return new Response("Accepted", { status: 202 });
        } catch (error) {
          if (error instanceof WebhookVerificationError) {
            console.error(error);
            return new Response("Forbidden", { status: 403 });
          }
          throw error;
        }
      }),
    });
  }
}
