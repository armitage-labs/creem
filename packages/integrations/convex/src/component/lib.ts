import { Creem } from "creem";

import { ConvexError, v } from "convex/values";
import {
  action,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import schema from "./schema.js";
import { asyncMap } from "convex-helpers";
import { api } from "./_generated/api.js";
import { convertToDatabaseProduct } from "./util.js";
import {
  byCreationTime,
  LEGACY_SCAN_LIMIT,
  legacyRowsOf,
  establishedOwnerOf,
  ownerClaimOf,
  recordCustomerEntity,
  resolveOwner,
  rowBelongsToEntity,
  touchedByOtherEntity,
} from "./entityScope.js";
import {
  resolveUpdateFailureAfterResume,
  resumeSubscriptionIfNeeded,
} from "./subscriptionLifecycle.js";

export const getCustomerByEntityId = query({
  args: {
    entityId: v.string(),
  },
  returns: v.union(schema.tables.customers.validator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    return omitSystemFields(customer);
  },
});

export const insertCustomer = mutation({
  args: schema.tables.customers.validator,
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (existingCustomer) {
      // Enrich existing customer record with any new fields
      const patch: Record<string, unknown> = {};
      if (args.email && !existingCustomer.email) patch.email = args.email;
      if (args.name && !existingCustomer.name) patch.name = args.name;
      if (args.country && !existingCustomer.country)
        patch.country = args.country;

      // `updatedAt` is the watermark the re-point guard below trusts, so it must
      // only ever move forward. Writing it unconditionally would let a delayed
      // webhook lower the watermark, after which a *second* delayed webhook —
      // still older than the current mapping but newer than the lowered value —
      // would satisfy the guard and flip the mapping back to the replaced
      // customer. Every lookup for the entity would then miss.
      const incomingAt = args.updatedAt ? Date.parse(args.updatedAt) : NaN;
      const existingAt = existingCustomer.updatedAt
        ? Date.parse(existingCustomer.updatedAt)
        : NaN;
      const isNewer =
        !Number.isNaN(incomingAt) &&
        (Number.isNaN(existingAt) || incomingAt >= existingAt);

      if (args.updatedAt && isNewer) patch.updatedAt = args.updatedAt;
      // `mode` follows the same ordering as everything else in this block: a
      // delayed webhook from the other Creem environment must not flip a live
      // customer row to test mode (or back) when the same event is refused for
      // the ID re-point.
      if (args.mode && isNewer) patch.mode = args.mode;

      // The ID swap needs STRICTLY newer evidence. `isNewer` is `>=` so that an
      // idempotent replay of the same event still enriches fields, but an equal
      // timestamp is not evidence that a *different* customer supersedes the
      // current mapping — two events can share an `updatedAt` to the second.
      const isStrictlyNewer =
        !Number.isNaN(incomingAt) &&
        (Number.isNaN(existingAt) || incomingAt > existingAt);

      // Re-point the mapping when Creem issues a new customer for this entity
      // (test/live mode switch, customer re-created in the dashboard).
      // Subscriptions and orders are keyed by the Creem customer ID, so keeping a
      // stale ID here makes every lookup for this entity miss — the user has paid
      // but sees no subscription.
      //
      // Only move forward in time: a delayed webhook for the *previous* customer
      // must not drag the mapping back and hide the new customer's data. When
      // there is no timestamp to order by, the mapping is left alone.
      if (args.id && args.id !== existingCustomer.id && isStrictlyNewer) {
        patch.id = args.id;
      }
      // Both customers have been this entity's; remember it before a
      // re-point replaces the mapping.
      await recordCustomerEntity(ctx, existingCustomer.id, args.entityId);
      if (args.id) await recordCustomerEntity(ctx, args.id, args.entityId);
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingCustomer._id, patch);
      }
      return existingCustomer._id;
    }
    await recordCustomerEntity(ctx, args.id, args.entityId);
    return ctx.db.insert("customers", args);
  },
});

/**
 * Mirror an email the app read back from the Creem API after changing it.
 *
 * `insertCustomer` only fills an empty email, so without this the local record
 * would keep the address from the first checkout. The customer ID guard keeps
 * a change for a replaced customer from landing on the entity's current one.
 *
 * `updatedAt` is Creem's `updated_at` from that readback. Overlapping saves can
 * deliver their readbacks out of order, so a readback that is not strictly
 * newer than the one already stored is ignored.
 */
export const setCustomerEmail = mutation({
  args: {
    entityId: v.string(),
    customerId: v.string(),
    email: v.string(),
    updatedAt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (!customer || customer.id !== args.customerId) return null;

    const incomingAt = Date.parse(args.updatedAt);
    const storedAt = customer.emailUpdatedAt
      ? Date.parse(customer.emailUpdatedAt)
      : NaN;
    if (!Number.isNaN(storedAt) && !(incomingAt > storedAt)) return null;

    await ctx.db.patch(customer._id, {
      email: args.email,
      emailUpdatedAt: args.updatedAt,
    });
    return null;
  },
});

export const getSubscription = query({
  args: {
    id: v.string(),
  },
  returns: v.union(schema.tables.subscriptions.validator, v.null()),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return omitSystemFields(subscription);
  },
});

export const getProduct = query({
  args: {
    id: v.string(),
  },
  returns: v.union(schema.tables.products.validator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return omitSystemFields(product);
  },
});

/** For apps that have 0 or 1 active subscription per user. Excludes expired trials. */
export const getCurrentSubscription = query({
  args: {
    entityId: v.string(),
  },
  returns: v.union(
    v.object({
      ...schema.tables.subscriptions.validator.fields,
      product: v.union(schema.tables.products.validator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (!customer) {
      return null;
    }
    // The customer can be shared with other billing entities; only this
    // entity's open subscriptions qualify.
    const [owned, legacy] = await Promise.all([
      ctx.db
        .query("subscriptions")
        .withIndex("customerId_entityId_endedAt", (q) =>
          q
            .eq("customerId", customer.id)
            .eq("entityId", args.entityId)
            .eq("endedAt", null),
        )
        .first(),
      ctx.db
        .query("subscriptions")
        .withIndex("customerId_entityId_endedAt", (q) =>
          q
            .eq("customerId", customer.id)
            .eq("entityId", undefined)
            .eq("endedAt", null),
        )
        .take(LEGACY_SCAN_LIMIT),
    ]);
    const [subscription] = [
      ...(owned ? [owned] : []),
      ...(await legacyRowsOf(ctx, customer.id, args.entityId, legacy)),
    ].sort(byCreationTime);
    if (!subscription) {
      return null;
    }
    if (
      subscription.status === "trialing" &&
      subscription.trialEnd &&
      subscription.trialEnd <= new Date().toISOString()
    ) {
      return null;
    }
    // Products are only populated by `syncProducts`, so a subscription can
    // legitimately reference a product this deployment has not synced yet.
    // Degrade to `product: null` (as `listUserSubscriptions` does) rather than
    // throwing, which would break every query composed on top of this one.
    const product = await ctx.db
      .query("products")
      .withIndex("id", (q) => q.eq("id", subscription.productId))
      .unique();
    return {
      ...omitSystemFields(subscription),
      product: omitSystemFields(product),
    };
  },
});

/** Every subscription of the entity on its current Creem customer. */
const entitySubscriptions = async (
  ctx: QueryCtx,
  customerId: string,
  entityId: string,
) => {
  const [owned, legacy] = await Promise.all([
    ctx.db
      .query("subscriptions")
      .withIndex("customerId_entityId_endedAt", (q) =>
        q.eq("customerId", customerId).eq("entityId", entityId),
      )
      .collect(),
    ctx.db
      .query("subscriptions")
      .withIndex("customerId_entityId_endedAt", (q) =>
        q.eq("customerId", customerId).eq("entityId", undefined),
      )
      .take(LEGACY_SCAN_LIMIT),
  ]);
  return [
    ...owned,
    ...(await legacyRowsOf(ctx, customerId, entityId, legacy)),
  ].sort(byCreationTime);
};

/** List active subscriptions for a user, excluding ended and expired trials. */
export const listUserSubscriptions = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      ...schema.tables.subscriptions.validator.fields,
      product: v.union(schema.tables.products.validator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (!customer) {
      return [];
    }
    const now = new Date().toISOString();
    const subscriptions = await asyncMap(
      await entitySubscriptions(ctx, customer.id, args.entityId),
      async (subscription) => {
        if (
          (subscription.endedAt && subscription.endedAt <= now) ||
          (subscription.status === "trialing" &&
            subscription.trialEnd &&
            subscription.trialEnd <= now)
        ) {
          return;
        }
        const product = subscription.productId
          ? (await ctx.db
              .query("products")
              .withIndex("id", (q) => q.eq("id", subscription.productId))
              .unique()) || null
          : null;
        return {
          ...omitSystemFields(subscription),
          product: omitSystemFields(product),
        };
      },
    );
    return subscriptions.flatMap((subscription) =>
      subscription ? [subscription] : [],
    );
  },
});

/** Returns all subscriptions for a user, including ended and expired trials. */
export const listAllUserSubscriptions = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(
    v.object({
      ...schema.tables.subscriptions.validator.fields,
      product: v.union(schema.tables.products.validator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (!customer) {
      return [];
    }
    const subscriptions = await asyncMap(
      await entitySubscriptions(ctx, customer.id, args.entityId),
      async (subscription) => {
        const product = subscription.productId
          ? (await ctx.db
              .query("products")
              .withIndex("id", (q) => q.eq("id", subscription.productId))
              .unique()) || null
          : null;
        return {
          ...omitSystemFields(subscription),
          product: omitSystemFields(product),
        };
      },
    );
    return subscriptions;
  },
});

export const listProducts = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(schema.tables.products.validator),
  handler: async (ctx, args) => {
    const q = ctx.db.query("products");
    const products = args.includeArchived
      ? await q.collect()
      : await q.withIndex("status", (q) => q.eq("status", "active")).collect();
    return products.map((product) => omitSystemFields(product));
  },
});

/**
 * Schedule the trial-expiry sweep for a trialing subscription.
 *
 * Queries are cached and only re-run when data changes, so a query that compares
 * `trialEnd` against the wall clock never re-fires on its own — a subscribed
 * client would keep seeing an active trial after it lapsed. Writing a row at
 * `trialEnd` is what makes trial expiry reactive.
 *
 * Deduplicated on `trialExpiryScheduledFor`, the trial end a job was actually
 * scheduled for. Comparing against the *previous* `trialEnd` instead would skip
 * rows that were already trialing before this feature shipped: their `trialEnd`
 * never changes, so they would never get a job. Duplicates would be harmless
 * anyway — `expireTrialIfElapsed` is idempotent — but they cost scheduler rows.
 */
const scheduleTrialExpiry = async (
  ctx: MutationCtx,
  documentId: Id<"subscriptions">,
  subscription: { id: string; status: string; trialEnd?: string | null },
  scheduledFor?: string | null,
) => {
  if (subscription.status !== "trialing" || !subscription.trialEnd) {
    return;
  }
  if (scheduledFor === subscription.trialEnd) {
    return;
  }
  const expiresAt = Date.parse(subscription.trialEnd);
  if (Number.isNaN(expiresAt)) {
    return;
  }
  await ctx.scheduler.runAt(expiresAt, api.lib.expireTrialIfElapsed, {
    subscriptionId: subscription.id,
  });
  await ctx.db.patch(documentId, {
    trialExpiryScheduledFor: subscription.trialEnd,
  });
};

/**
 * Close out a subscription whose trial has lapsed without converting.
 *
 * Idempotent: does nothing unless the subscription is still `trialing` with a
 * `trialEnd` in the past. If Creem converts the trial to a paid subscription,
 * the incoming webhook clears `endedAt` again.
 */
export const expireTrialIfElapsed = mutation({
  args: {
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscriptionId))
      .unique();
    if (
      !subscription ||
      subscription.status !== "trialing" ||
      !subscription.trialEnd ||
      subscription.endedAt
    ) {
      return null;
    }
    if (subscription.trialEnd > new Date().toISOString()) {
      return null;
    }
    await ctx.db.patch(subscription._id, { endedAt: subscription.trialEnd });
    return null;
  },
});

/**
 * Give a stored subscription without an owner the owner a trusted event
 * claims. An established owner is kept. Returns the owner the row now has.
 */
export const claimSubscriptionOwner = mutation({
  args: { id: v.string(), entityId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    if (!subscription) return null;
    const owner = resolveOwner(
      subscription,
      { entityId: args.entityId },
      `subscription ${args.id}`,
    );
    if (owner && subscription.entityId === undefined) {
      await ctx.db.patch(subscription._id, { entityId: owner });
    }
    return owner ?? null;
  },
});

export const createSubscription = mutation({
  args: {
    subscription: schema.tables.subscriptions.validator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscription.id))
      .unique();
    const entityId = resolveOwner(
      existingSubscription,
      args.subscription,
      `subscription ${args.subscription.id}`,
    );
    if (!existingSubscription) {
      const insertedId = await ctx.db.insert("subscriptions", {
        ...args.subscription,
        entityId,
      });
      await scheduleTrialExpiry(ctx, insertedId, args.subscription);
      return null;
    }
    // Timestamp guard: skip if existing record is newer — but a stale event
    // may still supply an owner the row does not have yet.
    const incomingModifiedAt = args.subscription.modifiedAt ?? "";
    const existingModifiedAt = existingSubscription.modifiedAt ?? "";
    if (existingModifiedAt > incomingModifiedAt) {
      if (existingSubscription.entityId === undefined && entityId) {
        await ctx.db.patch(existingSubscription._id, { entityId });
      }
      return null; // stale webhook, skip
    }
    await ctx.db.patch(existingSubscription._id, {
      ...args.subscription,
      entityId,
    });
    await scheduleTrialExpiry(
      ctx,
      existingSubscription._id,
      args.subscription,
      existingSubscription.trialExpiryScheduledFor,
    );
    return null;
  },
});

export const updateSubscription = mutation({
  args: {
    subscription: schema.tables.subscriptions.validator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscription.id))
      .unique();
    const entityId = resolveOwner(
      existingSubscription,
      args.subscription,
      `subscription ${args.subscription.id}`,
    );
    if (!existingSubscription) {
      // Subscription doesn't exist yet — insert instead of throwing
      const insertedId = await ctx.db.insert("subscriptions", {
        ...args.subscription,
        entityId,
      });
      await scheduleTrialExpiry(ctx, insertedId, args.subscription);
      return null;
    }
    // Timestamp guard: skip if existing record is newer — but a stale event
    // may still supply an owner the row does not have yet.
    const incomingModifiedAt = args.subscription.modifiedAt ?? "";
    const existingModifiedAt = existingSubscription.modifiedAt ?? "";
    if (existingModifiedAt > incomingModifiedAt) {
      if (existingSubscription.entityId === undefined && entityId) {
        await ctx.db.patch(existingSubscription._id, { entityId });
      }
      return null; // stale webhook, skip
    }

    // Optimistic-update guard: if a recent patchSubscription set optimistic
    // fields, don't let intermediate webhook events revert those values.
    const existingMeta = (existingSubscription.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const pendingAt = existingMeta._optimisticPendingAt as number | undefined;
    const optimisticFields = existingMeta._optimisticFields as
      | string[]
      | undefined;
    const isOptimisticPending =
      pendingAt != null && Date.now() - pendingAt < 30_000;

    const subscriptionToWrite = { ...args.subscription };

    if (isOptimisticPending && optimisticFields?.length) {
      console.debug(
        `[creem] optimistic guard active for sub=${args.subscription.id}`,
        {
          guardFields: optimisticFields,
          guardAge: `${Math.round((Date.now() - (pendingAt ?? 0)) / 1000)}s`,
          incoming: {
            productId: args.subscription.productId,
            seats: args.subscription.seats,
          },
          db: {
            productId: existingSubscription.productId,
            seats: existingSubscription.seats,
          },
        },
      );
      let allConfirmed = true;

      if (optimisticFields.includes("seats")) {
        if (args.subscription.seats !== existingSubscription.seats) {
          subscriptionToWrite.seats = existingSubscription.seats;
          allConfirmed = false;
          console.log(
            `[creem] guard: preserving optimistic seats=${existingSubscription.seats} (webhook sent ${args.subscription.seats})`,
          );
        }
      }
      if (optimisticFields.includes("productId")) {
        if (args.subscription.productId !== existingSubscription.productId) {
          subscriptionToWrite.productId = existingSubscription.productId;
          allConfirmed = false;
          console.log(
            `[creem] guard: preserving optimistic productId=${existingSubscription.productId} (webhook sent ${args.subscription.productId})`,
          );
        }
      }

      // Only clear the guard when ALL tracked fields match in a single webhook.
      // Partial matches are not trusted — Creem sends intermediate states where
      // some fields update temporarily before reverting (e.g. subscription.product
      // changes on upgrade but items[0].product_id stays stale).
      const incomingMeta = (args.subscription.metadata ?? {}) as Record<
        string,
        unknown
      >;
      if (allConfirmed) {
        console.log(
          `[creem] guard: all optimistic fields confirmed for sub=${args.subscription.id} — clearing`,
        );
        const {
          _optimisticPendingAt: _,
          _optimisticFields: __,
          ...cleanMeta
        } = { ...existingMeta, ...incomingMeta };
        subscriptionToWrite.metadata = cleanMeta;
      } else {
        subscriptionToWrite.metadata = {
          ...existingMeta,
          ...incomingMeta,
          _optimisticPendingAt: pendingAt,
          _optimisticFields: optimisticFields,
        };
      }
    }

    // The owner is write-once: webhooks without one, or naming another
    // entity, keep the established owner.
    subscriptionToWrite.entityId = entityId;
    await ctx.db.patch(existingSubscription._id, subscriptionToWrite);
    await scheduleTrialExpiry(
      ctx,
      existingSubscription._id,
      subscriptionToWrite,
      existingSubscription.trialExpiryScheduledFor,
    );
    return null;
  },
});

export const createProduct = mutation({
  args: {
    product: schema.tables.products.validator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingProduct = await ctx.db
      .query("products")
      .withIndex("id", (q) => q.eq("id", args.product.id))
      .unique();
    if (!existingProduct) {
      await ctx.db.insert("products", args.product);
      return;
    }
    // Timestamp guard: skip if existing record is newer
    const incomingModifiedAt = args.product.modifiedAt ?? "";
    const existingModifiedAt = existingProduct.modifiedAt ?? "";
    if (existingModifiedAt > incomingModifiedAt) {
      return; // stale webhook, skip
    }
    await ctx.db.patch(existingProduct._id, args.product);
  },
});

export const updateProduct = mutation({
  args: {
    product: schema.tables.products.validator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingProduct = await ctx.db
      .query("products")
      .withIndex("id", (q) => q.eq("id", args.product.id))
      .unique();
    if (!existingProduct) {
      // Product doesn't exist yet — insert instead of throwing
      await ctx.db.insert("products", args.product);
      return;
    }
    // Timestamp guard: skip if existing record is newer
    const incomingModifiedAt = args.product.modifiedAt ?? "";
    const existingModifiedAt = existingProduct.modifiedAt ?? "";
    if (existingModifiedAt > incomingModifiedAt) {
      return; // stale webhook, skip
    }
    await ctx.db.patch(existingProduct._id, args.product);
  },
});

export const createOrder = mutation({
  args: {
    order: schema.tables.orders.validator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("id", (q) => q.eq("id", args.order.id))
      .unique();
    const entityId = resolveOwner(
      existing,
      args.order,
      `order ${args.order.id}`,
    );
    if (!existing) {
      await ctx.db.insert("orders", { ...args.order, entityId });
      return;
    }
    // Update if incoming is newer, keeping the write-once owner. An older
    // event may still supply an owner the row does not have yet.
    if ((args.order.updatedAt ?? "") >= (existing.updatedAt ?? "")) {
      await ctx.db.patch(existing._id, { ...args.order, entityId });
    } else if (existing.entityId === undefined && entityId) {
      await ctx.db.patch(existing._id, { entityId });
    }
  },
});

/** List one-time orders for a user. */
export const listUserOrders = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(schema.tables.orders.validator),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    if (!customer) {
      return [];
    }
    const [owned, legacy] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("customerId_entityId_type", (q) =>
          q
            .eq("customerId", customer.id)
            .eq("entityId", args.entityId)
            .eq("type", "onetime"),
        )
        .collect(),
      ctx.db
        .query("orders")
        .withIndex("customerId_entityId_type", (q) =>
          q
            .eq("customerId", customer.id)
            .eq("entityId", undefined)
            .eq("type", "onetime"),
        )
        .take(LEGACY_SCAN_LIMIT),
    ]);
    return [
      ...owned,
      ...(await legacyRowsOf(ctx, customer.id, args.entityId, legacy)),
    ]
      .sort(byCreationTime)
      .map(omitSystemFields);
  },
});

export const getOrder = query({
  args: {
    id: v.string(),
  },
  returns: v.union(schema.tables.orders.validator, v.null()),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return omitSystemFields(order);
  },
});

export const listCustomerSubscriptions = query({
  args: {
    customerId: v.string(),
  },
  returns: v.array(schema.tables.subscriptions.validator),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("customerId", (q) => q.eq("customerId", args.customerId))
      .collect();
    return subscriptions.map(omitSystemFields);
  },
});

/**
 * A subscription of `entityId`, or `null` when it does not exist, belongs to
 * another customer, or belongs to another entity sharing this customer.
 */
export const getEntitySubscription = query({
  args: {
    entityId: v.string(),
    id: v.string(),
  },
  returns: v.union(schema.tables.subscriptions.validator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    if (!customer || !subscription || subscription.customerId !== customer.id) {
      return null;
    }
    return (await rowBelongsToEntity(ctx, subscription, args.entityId))
      ? omitSystemFields(subscription)
      : null;
  },
});

/** Most entities `listCustomerEntities` returns. */
const CUSTOMER_ENTITIES_LIMIT = 100;

/**
 * Billing entities mapped to a Creem customer, now or before (re-pointing an
 * entity to a new customer keeps it here). Returns at most 100;
 * `truncated` says whether there are more. Use `isCustomerShared` for a
 * sharing decision.
 */
export const listCustomerEntities = query({
  args: {
    customerId: v.string(),
  },
  returns: v.object({
    entities: v.array(v.string()),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const [history, mappings] = await Promise.all([
      ctx.db
        .query("customerEntityHistory")
        .withIndex("customerId_entityId", (q) =>
          q.eq("customerId", args.customerId),
        )
        .take(CUSTOMER_ENTITIES_LIMIT + 1),
      ctx.db
        .query("customers")
        .withIndex("id", (q) => q.eq("id", args.customerId))
        .take(CUSTOMER_ENTITIES_LIMIT + 1),
    ]);
    const entities = [
      ...new Set([...history, ...mappings].map((row) => row.entityId)),
    ].sort();
    const truncated =
      history.length > CUSTOMER_ENTITIES_LIMIT ||
      mappings.length > CUSTOMER_ENTITIES_LIMIT ||
      entities.length > CUSTOMER_ENTITIES_LIMIT;
    return {
      entities: entities.slice(0, CUSTOMER_ENTITIES_LIMIT),
      truncated,
    };
  },
});

/**
 * Whether a billing entity other than `entityId` has touched a Creem
 * customer: mapped to it now or before, or owning one of its subscriptions or
 * orders. Creem keeps one customer per store and email address, so the same
 * person checking out for two entities shares one.
 */
export const isCustomerShared = query({
  args: {
    customerId: v.string(),
    entityId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    touchedByOtherEntity(ctx, args.customerId, args.entityId),
});

/** Most rows a backfill call examines; also the default. */
const BACKFILL_BATCH = 25;

/**
 * Where the backfill stands. Each customer mapping is walked in four steps:
 * first every row's recorded `convexBillingEntityId` is established (claims),
 * then owners are inferred for the rows still without one, each for
 * subscriptions and then orders. `after` is the `_creationTime` of the last
 * row examined in the current step. `customerId` pins the Creem customer the
 * steps ran for: a mapping re-pointed meanwhile starts over, because its new
 * customer's claims have not been established yet.
 */
type BackfillCursor = {
  /** `_creationTime` of the last customer mapping finished. */
  done: number | null;
  current: {
    customer: number;
    customerId: string;
    step: number;
    after: number | null;
  } | null;
};

const BACKFILL_STEPS = [
  { table: "subscriptions", infer: false },
  { table: "orders", infer: false },
  { table: "subscriptions", infer: true },
  { table: "orders", infer: true },
] as const;

const parseBackfillCursor = (cursor: string | null): BackfillCursor => {
  if (cursor === null) return { done: null, current: null };
  const parsed = JSON.parse(cursor) as BackfillCursor;
  return { done: parsed.done ?? null, current: parsed.current ?? null };
};

/**
 * Give subscriptions and orders written before the `entityId` field existed
 * their owner.
 *
 * For each customer mapping it first copies every row's recorded
 * `convexBillingEntityId` into `entityId`. Only then does it infer the owner
 * of rows that record none: the mapping's entity, when no other entity has
 * ever been mapped to the customer or owns one of its rows. Ambiguous rows
 * keep no owner and belong to no entity. Mappings are also recorded in
 * `customerEntityHistory`.
 *
 * Paging contract: start without a cursor and pass back the returned
 * `cursor` until `isDone`. Each call examines at most `batchSize` rows
 * (default and maximum 25), so every transaction stays small, and it moves
 * past a customer only after examining all of its rows. Components cannot
 * use `paginate()`, so the cursor is the component's own. Running the whole
 * backfill again is safe.
 */
export const backfillBillingEntityTags = mutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(
      BACKFILL_BATCH,
      Math.max(1, Math.floor(args.batchSize ?? BACKFILL_BATCH)),
    );
    const state = parseBackfillCursor(args.cursor ?? null);

    let current = state.current;
    if (current === null) {
      const done = state.done;
      const [next] = await ctx.db
        .query("customers")
        .withIndex("by_creation_time", (q) =>
          done === null ? q : q.gt("_creationTime", done),
        )
        .take(1);
      if (!next) {
        return { cursor: args.cursor ?? null, isDone: true, processed: 0 };
      }
      await recordCustomerEntity(ctx, next.id, next.entityId);
      current = {
        customer: next._creationTime,
        customerId: next.id,
        step: 0,
        after: null,
      };
    }
    const customerCreation = current.customer;
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_creation_time", (q) =>
        q.eq("_creationTime", customerCreation),
      )
      .first();
    if (!customer) {
      // The mapping was deleted meanwhile; move on.
      const cursor: BackfillCursor = { done: customerCreation, current: null };
      return { cursor: JSON.stringify(cursor), isDone: false, processed: 0 };
    }
    if (customer.id !== current.customerId) {
      await recordCustomerEntity(ctx, customer.id, customer.entityId);
      current = {
        customer: customerCreation,
        customerId: customer.id,
        step: 0,
        after: null,
      };
    }

    const step = BACKFILL_STEPS[current.step];
    const after = current.after;
    const query =
      step.table === "subscriptions"
        ? ctx.db
            .query("subscriptions")
            .withIndex("customerId_entityId", (q) => {
              const base = q
                .eq("customerId", customer.id)
                .eq("entityId", undefined);
              return after === null ? base : base.gt("_creationTime", after);
            })
        : ctx.db.query("orders").withIndex("customerId_entityId", (q) => {
            const base = q
              .eq("customerId", customer.id)
              .eq("entityId", undefined);
            return after === null ? base : base.gt("_creationTime", after);
          });
    const rows = await query.take(batchSize);

    // Inference runs after every claim on this customer is established, so
    // the remaining rows without an owner carry no claim to scan for.
    const inferredOwner =
      step.infer &&
      !(await touchedByOtherEntity(ctx, customer.id, customer.entityId, {
        includeLegacyClaims: false,
      }))
        ? customer.entityId
        : null;

    let processed = 0;
    for (const row of rows) {
      const claim = ownerClaimOf(row.metadata);
      const owner = step.infer ? (claim ?? inferredOwner) : claim;
      if (owner === null) continue;
      await ctx.db.patch(row._id, { entityId: owner });
      processed += 1;
    }

    const lastRow = rows.at(-1);
    let next: BackfillCursor;
    if (rows.length === batchSize && lastRow) {
      next = {
        done: state.done,
        current: { ...current, after: lastRow._creationTime },
      };
    } else if (current.step + 1 < BACKFILL_STEPS.length) {
      next = {
        done: state.done,
        current: {
          customer: customerCreation,
          customerId: customer.id,
          step: current.step + 1,
          after: null,
        },
      };
    } else {
      next = { done: customerCreation, current: null };
    }
    return { cursor: JSON.stringify(next), isDone: false, processed };
  },
});

export const syncProducts = action({
  args: {
    apiKey: v.string(),
    server: v.optional(v.union(v.literal("test"), v.literal("prod"))),
    serverURL: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const creem = new Creem({
      apiKey: args.apiKey,
      ...(args.server ? { server: args.server } : {}),
      ...(args.serverURL ? { serverURL: args.serverURL } : {}),
    });
    const productPages = await creem.products.search(1, 100);
    for await (const page of productPages) {
      const products = "result" in page ? page.result : page;
      await ctx.runMutation(api.lib.updateProducts, {
        products: products.items.map(convertToDatabaseProduct),
      });
    }
  },
});

export const updateProducts = mutation({
  args: {
    products: v.array(schema.tables.products.validator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await asyncMap(args.products, async (product) => {
      const existingProduct = await ctx.db
        .query("products")
        .withIndex("id", (q) => q.eq("id", product.id))
        .unique();
      if (existingProduct) {
        await ctx.db.patch(existingProduct._id, product);
        return;
      }
      await ctx.db.insert("products", product);
    });
  },
});

/** Lightweight patch for optimistic UI updates (seats, productId, status).
 *  Tracks which fields were optimistically changed via `_optimisticPendingAt`
 *  and `_optimisticFields` in the subscription's metadata so that incoming
 *  webhooks with stale intermediate values don't overwrite the optimistic state. */
export const patchSubscription = mutation({
  args: {
    subscriptionId: v.string(),
    seats: v.optional(v.union(v.number(), v.null())),
    productId: v.optional(v.string()),
    status: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    clearOptimistic: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscriptionId))
      .unique();
    if (!sub)
      throw new ConvexError(`Subscription not found: ${args.subscriptionId}`);
    const patch: Record<string, unknown> = {};
    const optimisticFields: string[] = [];
    if (args.seats !== undefined) {
      patch.seats = args.seats;
      optimisticFields.push("seats");
    }
    if (args.productId !== undefined) {
      patch.productId = args.productId;
      optimisticFields.push("productId");
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.cancelAtPeriodEnd !== undefined)
      patch.cancelAtPeriodEnd = args.cancelAtPeriodEnd;

    // Track optimistic fields so updateSubscription can guard against stale webhooks.
    // Merge with any existing optimistic fields (cumulative across consecutive patches).
    const existingMeta = (sub.metadata ?? {}) as Record<string, unknown>;
    if (args.clearOptimistic) {
      const {
        _optimisticPendingAt: _,
        _optimisticFields: __,
        ...cleanMeta
      } = existingMeta;
      patch.metadata = cleanMeta;
    } else if (optimisticFields.length > 0) {
      const existingOptimistic =
        (existingMeta._optimisticFields as string[] | undefined) ?? [];
      const mergedOptimistic = [
        ...new Set([...existingOptimistic, ...optimisticFields]),
      ];
      patch.metadata = {
        ...existingMeta,
        _optimisticPendingAt: Date.now(),
        _optimisticFields: mergedOptimistic,
      };
    }

    if (Object.keys(patch).length > 0) {
      if (optimisticFields.length > 0 || args.clearOptimistic) {
        console.log(`[creem] optimistic patch sub=${args.subscriptionId}`, {
          fields: optimisticFields,
          ...(args.seats !== undefined ? { seats: args.seats } : {}),
          ...(args.productId !== undefined
            ? { productId: args.productId }
            : {}),
          ...(args.clearOptimistic ? { clear: true } : {}),
        });
      }
      await ctx.db.patch(sub._id, patch);
    }
  },
});

export const listPendingScheduledSubscriptionUpdates = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(schema.tables.scheduledSubscriptionUpdates.validator),
  handler: async (ctx, args) => {
    const updates = await ctx.db
      .query("scheduledSubscriptionUpdates")
      .withIndex("entityId_status", (q) =>
        q.eq("entityId", args.entityId).eq("status", "pending"),
      )
      .collect();
    return updates.map(omitSystemFields);
  },
});

/**
 * Return the activation-history row for one app-owned plan.
 *
 * Activation history is an eligibility ledger, not current access state. For
 * example, a no-card trial can use this row to enforce "once per entity" even
 * after the trial assignment has ended.
 */
export const getAppPlanActivation = query({
  args: {
    entityId: v.string(),
    planId: v.string(),
  },
  returns: v.union(schema.tables.appPlanActivations.validator, v.null()),
  handler: async (ctx, args) => {
    const activation = await ctx.db
      .query("appPlanActivations")
      .withIndex("entityId_planId", (q) =>
        q.eq("entityId", args.entityId).eq("planId", args.planId),
      )
      .unique();
    return omitSystemFields(activation);
  },
});

/**
 * List all app-owned plan activation-history rows for an entity.
 *
 * Widgets use this to hide or disable catalog entries that are no longer
 * eligible, such as once-per-entity trials.
 */
export const listAppPlanActivations = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(schema.tables.appPlanActivations.validator),
  handler: async (ctx, args) => {
    const activations = await ctx.db
      .query("appPlanActivations")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .collect();
    return activations.map(omitSystemFields);
  },
});

/**
 * List current, scheduled, and ended app-owned plan assignments for an entity.
 *
 * Assignments are the component-owned current-state projection for plans that
 * are not native Creem subscriptions, such as free plans, no-card trials, and
 * custom internal plans.
 */
export const listAppPlanAssignments = query({
  args: {
    entityId: v.string(),
  },
  returns: v.array(schema.tables.appPlanAssignments.validator),
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("appPlanAssignments")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .collect();
    return assignments.map(omitSystemFields);
  },
});

/**
 * Create an app-owned plan assignment.
 *
 * Active assignments replace any existing active or scheduled app-plan
 * assignment for the entity. Scheduled assignments are used by paid-to-free
 * period-end changes and replace older scheduled assignments for the same
 * subscription.
 */
export const assignAppPlan = mutation({
  args: {
    entityId: v.string(),
    planId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("scheduled"))),
    startsAt: v.optional(v.string()),
    endsAt: v.optional(v.union(v.string(), v.null())),
    source: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    assignedByUserId: v.optional(v.string()),
  },
  returns: schema.tables.appPlanAssignments.validator,
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const status = args.status ?? "active";
    const startsAt = args.startsAt ?? now;

    if (status === "active") {
      const existing = await ctx.db
        .query("appPlanAssignments")
        .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
        .collect();
      await asyncMap(
        existing.filter(
          (assignment) =>
            assignment.status === "active" || assignment.status === "scheduled",
        ),
        async (assignment) => {
          await ctx.db.patch(assignment._id, {
            status: "ended",
            endsAt: startsAt,
            updatedAt: now,
          });
        },
      );
    } else {
      const scheduled = await ctx.db
        .query("appPlanAssignments")
        .withIndex("entityId_status", (q) =>
          q.eq("entityId", args.entityId).eq("status", "scheduled"),
        )
        .collect();
      await asyncMap(
        scheduled.filter(
          (assignment) =>
            !args.subscriptionId ||
            assignment.subscriptionId === args.subscriptionId,
        ),
        async (assignment) => {
          await ctx.db.patch(assignment._id, {
            status: "ended",
            endsAt: now,
            updatedAt: now,
          });
        },
      );
    }

    const assignment = {
      entityId: args.entityId,
      planId: args.planId,
      status,
      startsAt,
      ...(args.endsAt !== undefined ? { endsAt: args.endsAt } : {}),
      ...(args.source ? { source: args.source } : {}),
      ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
      ...(args.assignedByUserId
        ? { assignedByUserId: args.assignedByUserId }
        : {}),
      createdAt: now,
      updatedAt: now,
    };
    await ctx.db.insert("appPlanAssignments", assignment);
    return assignment;
  },
});

/**
 * Promote a scheduled app-plan assignment to active.
 *
 * This is called when a paid subscription reaches the period boundary for a
 * paid-to-free change. Any existing active app-plan assignment for the entity
 * is ended before the scheduled target becomes active.
 */
export const activateScheduledAppPlanAssignment = mutation({
  args: {
    entityId: v.string(),
    subscriptionId: v.string(),
    planId: v.optional(v.string()),
  },
  returns: v.union(schema.tables.appPlanAssignments.validator, v.null()),
  handler: async (ctx, args) => {
    const scheduled = await ctx.db
      .query("appPlanAssignments")
      .withIndex("subscriptionId_status", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("status", "scheduled"),
      )
      .collect();
    // Only the entity's own assignment: another entity sharing the Creem
    // customer may have one that names the same subscription.
    const assignment = scheduled.find(
      (item) =>
        item.entityId === args.entityId &&
        (!args.planId || item.planId === args.planId),
    );
    if (!assignment) return null;

    const now = new Date().toISOString();
    const active = await ctx.db
      .query("appPlanAssignments")
      .withIndex("entityId_status", (q) =>
        q.eq("entityId", assignment.entityId).eq("status", "active"),
      )
      .collect();
    await asyncMap(active, async (item) => {
      await ctx.db.patch(item._id, {
        status: "ended",
        endsAt: now,
        updatedAt: now,
      });
    });
    const patch = {
      status: "active" as const,
      startsAt: now,
      updatedAt: now,
    };
    await ctx.db.patch(assignment._id, patch);
    return omitSystemFields({ ...assignment, ...patch });
  },
});

/**
 * End a scheduled app-plan assignment without activating it.
 *
 * This is used when the user undoes a pending paid-to-free period-end change;
 * the Creem scheduled cancellation is resumed separately by the caller.
 */
export const cancelScheduledAppPlanAssignment = mutation({
  args: {
    entityId: v.string(),
    subscriptionId: v.string(),
    planId: v.optional(v.string()),
  },
  returns: v.union(schema.tables.appPlanAssignments.validator, v.null()),
  handler: async (ctx, args) => {
    const scheduled = await ctx.db
      .query("appPlanAssignments")
      .withIndex("subscriptionId_status", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("status", "scheduled"),
      )
      .collect();
    // Only the entity's own assignment: another entity sharing the Creem
    // customer may have one that names the same subscription.
    const assignment = scheduled.find(
      (item) =>
        item.entityId === args.entityId &&
        (!args.planId || item.planId === args.planId),
    );
    if (!assignment) return null;

    const now = new Date().toISOString();
    const patch = {
      status: "ended" as const,
      endsAt: now,
      updatedAt: now,
    };
    await ctx.db.patch(assignment._id, patch);
    return omitSystemFields({ ...assignment, ...patch });
  },
});

/**
 * End all active app-owned plan assignments for an entity.
 *
 * Webhook handling calls this when a native Creem subscription becomes active,
 * so app-owned free/trial access does not overlap with paid subscription
 * access in the component snapshot.
 */
export const endActiveAppPlanAssignments = mutation({
  args: {
    entityId: v.string(),
    endedAt: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const endedAt = args.endedAt ?? new Date().toISOString();
    const active = await ctx.db
      .query("appPlanAssignments")
      .withIndex("entityId_status", (q) =>
        q.eq("entityId", args.entityId).eq("status", "active"),
      )
      .collect();
    await asyncMap(active, async (assignment) => {
      await ctx.db.patch(assignment._id, {
        status: "ended",
        endsAt: endedAt,
        updatedAt: endedAt,
      });
    });
    return active.length;
  },
});

/**
 * Record activation history for an app-owned catalog plan.
 *
 * When `oncePerEntity` is true, a repeated activation throws a `ConvexError`.
 * This function intentionally does not grant current access; use
 * `assignAppPlan` for the current/scheduled assignment state.
 */
export const recordAppPlanActivation = mutation({
  args: {
    entityId: v.string(),
    planId: v.string(),
    activatedByUserId: v.optional(v.string()),
    oncePerEntity: v.optional(v.boolean()),
  },
  returns: schema.tables.appPlanActivations.validator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("appPlanActivations")
      .withIndex("entityId_planId", (q) =>
        q.eq("entityId", args.entityId).eq("planId", args.planId),
      )
      .unique();

    if (existing) {
      if (args.oncePerEntity) {
        throw new ConvexError(`Plan "${args.planId}" was already activated`);
      }
      const patch = {
        lastActivatedAt: now,
        activationCount: existing.activationCount + 1,
        ...(args.activatedByUserId
          ? { activatedByUserId: args.activatedByUserId }
          : {}),
      };
      await ctx.db.patch(existing._id, patch);
      return {
        ...omitSystemFields(existing),
        ...patch,
      };
    }

    const activation = {
      entityId: args.entityId,
      planId: args.planId,
      firstActivatedAt: now,
      lastActivatedAt: now,
      activationCount: 1,
      ...(args.activatedByUserId
        ? { activatedByUserId: args.activatedByUserId }
        : {}),
    };
    await ctx.db.insert("appPlanActivations", activation);
    return activation;
  },
});

export const getScheduledSubscriptionUpdate = query({
  args: {
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
  },
  returns: v.union(
    schema.tables.scheduledSubscriptionUpdates.validator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    const update = await ctx.db.get(args.scheduledUpdateId);
    return omitSystemFields(update);
  },
});

export const createScheduledSubscriptionUpdate = mutation({
  args: {
    entityId: v.string(),
    subscriptionId: v.string(),
    targetProductId: v.optional(v.string()),
    targetPlanId: v.optional(v.string()),
    targetUnits: v.optional(v.number()),
    effectiveAt: v.string(),
  },
  returns: v.id("scheduledSubscriptionUpdates"),
  handler: async (ctx, args) => {
    const targetCount =
      (args.targetProductId ? 1 : 0) +
      (args.targetPlanId ? 1 : 0) +
      (args.targetUnits !== undefined ? 1 : 0);
    if (targetCount !== 1) {
      throw new ConvexError(
        "Provide exactly one scheduled target: targetProductId, targetPlanId, or targetUnits",
      );
    }

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("scheduledSubscriptionUpdates")
      .withIndex("subscriptionId_status", (q) =>
        q.eq("subscriptionId", args.subscriptionId).eq("status", "pending"),
      )
      .collect();
    await asyncMap(existing, async (update) => {
      await ctx.db.patch(update._id, {
        status: "superseded",
        updatedAt: now,
      });
    });

    return await ctx.db.insert("scheduledSubscriptionUpdates", {
      entityId: args.entityId,
      subscriptionId: args.subscriptionId,
      targetProductId: args.targetProductId,
      targetPlanId: args.targetPlanId,
      targetUnits: args.targetUnits,
      effectiveAt: args.effectiveAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const cancelScheduledSubscriptionUpdate = mutation({
  args: {
    entityId: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.union(
    schema.tables.scheduledSubscriptionUpdates.validator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    // The index narrows to the pending updates of a single subscription (a
    // handful of rows at most). The entityId comparison is an ownership check on
    // that already-bounded set, so it runs in JS rather than as a table filter.
    const existing = (
      await ctx.db
        .query("scheduledSubscriptionUpdates")
        .withIndex("subscriptionId_status", (q) =>
          q.eq("subscriptionId", args.subscriptionId).eq("status", "pending"),
        )
        .collect()
    ).find((update) => update.entityId === args.entityId);
    if (!existing) return null;

    const now = new Date().toISOString();
    await ctx.db.patch(existing._id, {
      status: "superseded",
      updatedAt: now,
    });
    return omitSystemFields({
      ...existing,
      status: "superseded" as const,
      updatedAt: now,
    });
  },
});

export const cancelPendingScheduledSubscriptionUpdates = mutation({
  args: {
    entityId: v.string(),
    subscriptionId: v.string(),
  },
  returns: v.array(schema.tables.scheduledSubscriptionUpdates.validator),
  handler: async (ctx, args) => {
    // Same bounded-set ownership check as `cancelScheduledSubscriptionUpdate`.
    const existing = (
      await ctx.db
        .query("scheduledSubscriptionUpdates")
        .withIndex("subscriptionId_status", (q) =>
          q.eq("subscriptionId", args.subscriptionId).eq("status", "pending"),
        )
        .collect()
    ).filter((update) => update.entityId === args.entityId);
    if (existing.length === 0) return [];

    const now = new Date().toISOString();
    await asyncMap(existing, async (update) => {
      await ctx.db.patch(update._id, {
        status: "superseded",
        updatedAt: now,
      });
    });
    return existing.map((update) =>
      omitSystemFields({
        ...update,
        status: "superseded" as const,
        updatedAt: now,
      }),
    );
  },
});

export const setScheduledSubscriptionUpdateJob = mutation({
  args: {
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
    scheduledFunctionId: v.id("_scheduled_functions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update = await ctx.db.get(args.scheduledUpdateId);
    if (!update) {
      throw new ConvexError("Scheduled subscription update not found");
    }
    await ctx.db.patch(args.scheduledUpdateId, {
      scheduledFunctionId: args.scheduledFunctionId,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * How long a scheduled update may sit in `applying` before another run may
 * reclaim it. An action that dies mid-flight (deploy, timeout, OOM) leaves the
 * row marked `applying` with no retry path, so the downgrade would silently
 * never happen and the customer keeps being charged the old price.
 *
 * Deliberately longer than Convex's 10-minute action ceiling: a still-running
 * claim can never go stale, so a reclaim only ever happens after the previous
 * run is definitively dead. Otherwise two runs could both call Creem and apply
 * the same upgrade twice.
 */
export const STALE_APPLYING_MS = 15 * 60 * 1000;

export const markScheduledSubscriptionUpdateApplying = mutation({
  args: {
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const update = await ctx.db.get(args.scheduledUpdateId);
    if (!update) return false;
    // Claim pending rows, and reclaim rows abandoned by a previous run.
    const isStaleApplying =
      update.status === "applying" &&
      Date.now() - Date.parse(update.updatedAt) > STALE_APPLYING_MS;
    if (update.status !== "pending" && !isStaleApplying) return false;
    await ctx.db.patch(args.scheduledUpdateId, {
      status: "applying",
      updatedAt: new Date().toISOString(),
    });
    return true;
  },
});

export const markScheduledSubscriptionUpdateApplied = mutation({
  args: {
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update = await ctx.db.get(args.scheduledUpdateId);
    if (!update) return;
    await ctx.db.patch(args.scheduledUpdateId, {
      status: "applied",
      updatedAt: new Date().toISOString(),
    });
  },
});

export const markScheduledSubscriptionUpdateFailed = mutation({
  args: {
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update = await ctx.db.get(args.scheduledUpdateId);
    if (!update) return;
    await ctx.db.patch(args.scheduledUpdateId, {
      status: "failed",
      error: args.error,
      updatedAt: new Date().toISOString(),
    });
  },
});

const appPlanTransitionRollbackValidator = v.object({
  planId: v.string(),
  scheduledUpdateId: v.optional(v.id("scheduledSubscriptionUpdates")),
  scheduledUpdateCreatedAt: v.optional(v.string()),
  assignmentCreatedAt: v.optional(v.string()),
});

const lifecycleRollbackValidator = v.object({
  abortAppPlanTransitions: v.optional(
    v.array(appPlanTransitionRollbackValidator),
  ),
  restoreAppPlanTransitions: v.optional(
    v.array(appPlanTransitionRollbackValidator),
  ),
  replacementScheduledUpdateIds: v.optional(
    v.array(v.id("scheduledSubscriptionUpdates")),
  ),
});

/**
 * Reconcile all optimistic local state after a Creem lifecycle/update failure.
 *
 * Subscription fields, scheduled updates, and app-plan assignments are changed
 * in one mutation so a failed external call cannot leave mixed entitlements.
 */
export const compensateSubscriptionLifecycle = mutation({
  args: {
    subscriptionId: v.string(),
    previousStatus: v.optional(v.string()),
    previousCancelAtPeriodEnd: v.optional(v.boolean()),
    previousSeats: v.optional(v.union(v.number(), v.null())),
    previousProductId: v.optional(v.string()),
    clearOptimistic: v.optional(v.boolean()),
    rollback: v.optional(lifecycleRollbackValidator),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("id", (q) => q.eq("id", args.subscriptionId))
      .unique();
    if (!subscription) {
      throw new ConvexError(`Subscription not found: ${args.subscriptionId}`);
    }

    const subscriptionPatch: Record<string, unknown> = {};
    if (args.previousStatus !== undefined) {
      subscriptionPatch.status = args.previousStatus;
    }
    if (args.previousCancelAtPeriodEnd !== undefined) {
      subscriptionPatch.cancelAtPeriodEnd = args.previousCancelAtPeriodEnd;
    }
    if (args.previousSeats !== undefined) {
      subscriptionPatch.seats = args.previousSeats;
    }
    if (args.previousProductId !== undefined) {
      subscriptionPatch.productId = args.previousProductId;
    }
    if (args.clearOptimistic) {
      const {
        _optimisticPendingAt: _,
        _optimisticFields: __,
        ...cleanMetadata
      } = (subscription.metadata ?? {}) as Record<string, unknown>;
      subscriptionPatch.metadata = cleanMetadata;
    }
    if (Object.keys(subscriptionPatch).length > 0) {
      await ctx.db.patch(subscription._id, subscriptionPatch);
    }

    if (!args.rollback) return null;
    const owner = establishedOwnerOf(subscription);
    const ownedByOwner = (row: { entityId: string }) =>
      owner === null || row.entityId === owner;

    for (const replacementId of args.rollback.replacementScheduledUpdateIds ??
      []) {
      const replacement = await ctx.db.get(replacementId);
      if (
        replacement &&
        (replacement.status === "pending" || replacement.status === "applying")
      ) {
        await ctx.db.patch(replacementId, {
          status: "failed",
          error: args.error ?? "Subscription lifecycle operation failed",
          updatedAt: now,
        });
      }
    }

    const reconcileAppPlanTransition = async (
      transition: {
        planId: string;
        scheduledUpdateId?: Doc<"scheduledSubscriptionUpdates">["_id"];
        scheduledUpdateCreatedAt?: string;
        assignmentCreatedAt?: string;
      },
      mode: "abort" | "restore",
    ) => {
      let scheduledUpdate = transition.scheduledUpdateId
        ? await ctx.db.get(transition.scheduledUpdateId)
        : null;
      if (!scheduledUpdate && transition.scheduledUpdateCreatedAt) {
        const status = mode === "restore" ? "superseded" : "pending";
        const candidates = await ctx.db
          .query("scheduledSubscriptionUpdates")
          .withIndex("subscriptionId_status", (q) =>
            q.eq("subscriptionId", args.subscriptionId).eq("status", status),
          )
          .order("desc")
          .take(20);
        scheduledUpdate =
          candidates.find(
            (candidate) =>
              ownedByOwner(candidate) &&
              candidate.createdAt === transition.scheduledUpdateCreatedAt &&
              candidate.targetPlanId === transition.planId,
          ) ?? null;
      }

      if (scheduledUpdate) {
        await ctx.db.patch(scheduledUpdate._id, {
          status:
            mode === "restore" ? ("pending" as const) : ("failed" as const),
          error:
            mode === "restore"
              ? undefined
              : (args.error ?? "Subscription lifecycle operation failed"),
          updatedAt: now,
        });
      }

      const assignmentStatuses =
        mode === "restore"
          ? (["ended"] as const)
          : (["active", "scheduled"] as const);
      let assignment: Doc<"appPlanAssignments"> | null = null;
      for (const status of assignmentStatuses) {
        const candidates = await ctx.db
          .query("appPlanAssignments")
          .withIndex("subscriptionId_status", (q) =>
            q.eq("subscriptionId", args.subscriptionId).eq("status", status),
          )
          .order("desc")
          .take(20);
        assignment =
          candidates.find(
            (candidate) =>
              ownedByOwner(candidate) &&
              candidate.planId === transition.planId &&
              (!transition.assignmentCreatedAt ||
                candidate.createdAt === transition.assignmentCreatedAt),
          ) ?? null;
        if (assignment) break;
      }

      if (assignment) {
        await ctx.db.patch(
          assignment._id,
          mode === "restore"
            ? {
                status: "scheduled",
                startsAt: scheduledUpdate?.effectiveAt ?? assignment.startsAt,
                endsAt: null,
                updatedAt: now,
              }
            : {
                status: "ended",
                endsAt: now,
                updatedAt: now,
              },
        );
      }
    };

    for (const transition of args.rollback.abortAppPlanTransitions ?? []) {
      await reconcileAppPlanTransition(transition, "abort");
    }
    for (const transition of args.rollback.restoreAppPlanTransitions ?? []) {
      await reconcileAppPlanTransition(transition, "restore");
    }
    return null;
  },
});

/** Action that calls Creem API and reverts on error. Scheduled by mutations.
 *  Public (not internal) so it's accessible via ComponentApi for scheduling from app-level mutations.
 *  Secured by requiring apiKey argument (same pattern as syncProducts). */
export const executeSubscriptionUpdate = action({
  args: {
    apiKey: v.string(),
    server: v.optional(v.union(v.literal("test"), v.literal("prod"))),
    serverURL: v.optional(v.string()),
    subscriptionId: v.string(),
    productId: v.optional(v.string()),
    units: v.optional(v.number()),
    updateBehavior: v.optional(v.string()),
    resumeScheduledCancellation: v.optional(v.boolean()),
    previousSeats: v.optional(v.union(v.number(), v.null())),
    previousProductId: v.optional(v.string()),
    previousStatus: v.optional(v.string()),
    previousCancelAtPeriodEnd: v.optional(v.boolean()),
    rollback: v.optional(lifecycleRollbackValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sdk = new Creem({
      apiKey: args.apiKey,
      ...(args.server ? { server: args.server } : {}),
      ...(args.serverURL ? { serverURL: args.serverURL } : {}),
    });
    let cancellationWasCleared = false;
    try {
      if (args.updateBehavior === "period-end") {
        throw new ConvexError(
          "period-end updates must be scheduled before calling Creem",
        );
      }
      if (args.resumeScheduledCancellation) {
        cancellationWasCleared = await resumeSubscriptionIfNeeded(
          sdk,
          args.subscriptionId,
        );
      }
      if (args.productId) {
        // Plan/interval switch
        await sdk.subscriptions.upgrade(args.subscriptionId, {
          productId: args.productId,
          ...(args.updateBehavior
            ? {
                updateBehavior: args.updateBehavior as
                  | "proration-charge-immediately"
                  | "proration-charge"
                  | "proration-none",
              }
            : {}),
        });
      } else if (args.units !== undefined) {
        // Seat update — need live item IDs from Creem
        const live = await sdk.subscriptions.get(args.subscriptionId);
        const item = live.items?.[0];
        if (!item) throw new ConvexError("Subscription has no items");
        await sdk.subscriptions.update(args.subscriptionId, {
          items: [
            {
              id: item.id,
              productId: item.productId,
              priceId: item.priceId,
              units: args.units,
            },
          ],
          ...(args.updateBehavior
            ? {
                updateBehavior: args.updateBehavior as
                  | "proration-charge-immediately"
                  | "proration-charge"
                  | "proration-none",
              }
            : {}),
        });
      }
    } catch (error) {
      console.error(`[creem] subscription update failed:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const failureState = resolveUpdateFailureAfterResume({
        cancellationWasCleared,
        previousStatus: args.previousStatus,
        previousCancelAtPeriodEnd: args.previousCancelAtPeriodEnd,
      });
      const remainingRollback =
        !failureState.restoreAppPlanTransitions && args.rollback
          ? {
              ...(args.rollback.abortAppPlanTransitions?.length
                ? {
                    abortAppPlanTransitions:
                      args.rollback.abortAppPlanTransitions,
                  }
                : {}),
              ...(args.rollback.replacementScheduledUpdateIds?.length
                ? {
                    replacementScheduledUpdateIds:
                      args.rollback.replacementScheduledUpdateIds,
                  }
                : {}),
            }
          : args.rollback;
      const hasRemainingRollback =
        remainingRollback &&
        (remainingRollback.abortAppPlanTransitions?.length ||
          remainingRollback.restoreAppPlanTransitions?.length ||
          remainingRollback.replacementScheduledUpdateIds?.length);
      await ctx.runMutation(api.lib.compensateSubscriptionLifecycle, {
        subscriptionId: args.subscriptionId,
        ...(args.previousSeats !== undefined
          ? { previousSeats: args.previousSeats }
          : {}),
        ...(args.previousProductId !== undefined
          ? { previousProductId: args.previousProductId }
          : {}),
        ...(failureState.previousStatus !== undefined
          ? { previousStatus: failureState.previousStatus }
          : {}),
        ...(failureState.previousCancelAtPeriodEnd !== undefined
          ? {
              previousCancelAtPeriodEnd: failureState.previousCancelAtPeriodEnd,
            }
          : {}),
        clearOptimistic: true,
        ...(hasRemainingRollback ? { rollback: remainingRollback } : {}),
        error: message,
      });
    }
  },
});

/** Applies a previously scheduled period-end subscription update. */
export const applyScheduledSubscriptionUpdate = action({
  args: {
    apiKey: v.string(),
    server: v.optional(v.union(v.literal("test"), v.literal("prod"))),
    serverURL: v.optional(v.string()),
    scheduledUpdateId: v.id("scheduledSubscriptionUpdates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scheduledUpdate = await ctx.runQuery(
      api.lib.getScheduledSubscriptionUpdate,
      {
        scheduledUpdateId: args.scheduledUpdateId,
      },
    );
    if (!scheduledUpdate) return null;
    // `applying` rows are normally owned by a live run, but one abandoned by a
    // crashed run must be recoverable — `markScheduledSubscriptionUpdateApplying`
    // decides, so it stays a single atomic claim.
    if (
      scheduledUpdate.status !== "pending" &&
      scheduledUpdate.status !== "applying"
    ) {
      return null;
    }

    // Updates scheduled before subscriptions were scoped to their entity may
    // name a subscription of another entity sharing the Creem customer.
    const owned = await ctx.runQuery(api.lib.getEntitySubscription, {
      entityId: scheduledUpdate.entityId,
      id: scheduledUpdate.subscriptionId,
    });
    if (!owned) {
      console.warn(
        `[creem] dropping scheduled update ${args.scheduledUpdateId}: subscription ${scheduledUpdate.subscriptionId} does not belong to entity ${scheduledUpdate.entityId}`,
      );
      await ctx.runMutation(api.lib.markScheduledSubscriptionUpdateFailed, {
        scheduledUpdateId: args.scheduledUpdateId,
        error: "Subscription does not belong to the scheduled entity",
      });
      return null;
    }

    const marked = await ctx.runMutation(
      api.lib.markScheduledSubscriptionUpdateApplying,
      {
        scheduledUpdateId: args.scheduledUpdateId,
      },
    );
    if (!marked) return null;

    const sdk = new Creem({
      apiKey: args.apiKey,
      ...(args.server ? { server: args.server } : {}),
      ...(args.serverURL ? { serverURL: args.serverURL } : {}),
    });

    try {
      if (scheduledUpdate.targetProductId) {
        await sdk.subscriptions.upgrade(scheduledUpdate.subscriptionId, {
          productId: scheduledUpdate.targetProductId,
          updateBehavior: "proration-none",
        });
        await ctx.runMutation(api.lib.patchSubscription, {
          subscriptionId: scheduledUpdate.subscriptionId,
          productId: scheduledUpdate.targetProductId,
        });
      } else if (scheduledUpdate.targetUnits !== undefined) {
        const live = await sdk.subscriptions.get(
          scheduledUpdate.subscriptionId,
        );
        const item = live.items?.[0];
        if (!item) throw new ConvexError("Subscription has no items");
        await sdk.subscriptions.update(scheduledUpdate.subscriptionId, {
          items: [
            {
              id: item.id,
              productId: item.productId,
              priceId: item.priceId,
              units: scheduledUpdate.targetUnits,
            },
          ],
          updateBehavior: "proration-none",
        });
        await ctx.runMutation(api.lib.patchSubscription, {
          subscriptionId: scheduledUpdate.subscriptionId,
          seats: scheduledUpdate.targetUnits,
        });
      } else if (scheduledUpdate.targetPlanId) {
        await ctx.runMutation(api.lib.activateScheduledAppPlanAssignment, {
          entityId: scheduledUpdate.entityId,
          subscriptionId: scheduledUpdate.subscriptionId,
          planId: scheduledUpdate.targetPlanId,
        });
      }

      await ctx.runMutation(api.lib.markScheduledSubscriptionUpdateApplied, {
        scheduledUpdateId: args.scheduledUpdateId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[creem] scheduled subscription update failed:`, error);
      await ctx.runMutation(api.lib.markScheduledSubscriptionUpdateFailed, {
        scheduledUpdateId: args.scheduledUpdateId,
        error: message,
      });
    }
  },
});

/** Action that calls Creem API for cancel/resume/pause and reverts on error.
 *  Scheduled by the corresponding mutations in api(). */
export const executeSubscriptionLifecycle = action({
  args: {
    apiKey: v.string(),
    server: v.optional(v.union(v.literal("test"), v.literal("prod"))),
    serverURL: v.optional(v.string()),
    subscriptionId: v.string(),
    operation: v.union(
      v.literal("cancel"),
      v.literal("resume"),
      v.literal("pause"),
    ),
    cancelMode: v.optional(v.string()),
    scheduledUpdateId: v.optional(v.id("scheduledSubscriptionUpdates")),
    // For reverting on error:
    previousStatus: v.optional(v.string()),
    previousCancelAtPeriodEnd: v.optional(v.boolean()),
    rollback: v.optional(lifecycleRollbackValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sdk = new Creem({
      apiKey: args.apiKey,
      ...(args.server ? { server: args.server } : {}),
      ...(args.serverURL ? { serverURL: args.serverURL } : {}),
    });
    try {
      if (args.operation === "cancel") {
        if (args.scheduledUpdateId) {
          const scheduledUpdate = await ctx.runQuery(
            api.lib.getScheduledSubscriptionUpdate,
            {
              scheduledUpdateId: args.scheduledUpdateId,
            },
          );
          if (!scheduledUpdate || scheduledUpdate.status !== "pending") {
            return;
          }
          // As in `applyScheduledSubscriptionUpdate`: a change queued before
          // subscriptions were scoped may name another entity's subscription.
          const owned = await ctx.runQuery(api.lib.getEntitySubscription, {
            entityId: scheduledUpdate.entityId,
            id: args.subscriptionId,
          });
          if (!owned) {
            console.warn(
              `[creem] dropping queued cancellation for ${args.subscriptionId}: it does not belong to entity ${scheduledUpdate.entityId}`,
            );
            await ctx.runMutation(
              api.lib.markScheduledSubscriptionUpdateFailed,
              {
                scheduledUpdateId: args.scheduledUpdateId,
                error: "Subscription does not belong to the scheduled entity",
              },
            );
            return;
          }
        }
        const cancelParams =
          args.cancelMode === "immediate"
            ? { mode: "immediate" as const }
            : args.cancelMode === "scheduled"
              ? { mode: "scheduled" as const, onExecute: "cancel" as const }
              : {};
        await sdk.subscriptions.cancel(args.subscriptionId, cancelParams);
      } else if (args.operation === "resume") {
        // A `false` return means Creem reports a status this helper cannot
        // resume (canceled/expired), so it made no API call and threw nothing.
        // Swallowing that would leave the optimistic local patch claiming
        // `status: "active"` for a subscription that no longer exists, until
        // some later webhook happened to heal it. Fail into the compensation
        // path below instead.
        const resumed = await resumeSubscriptionIfNeeded(
          sdk,
          args.subscriptionId,
        );
        if (!resumed) {
          throw new ConvexError(
            `Subscription ${args.subscriptionId} cannot be resumed in its current state`,
          );
        }
      } else if (args.operation === "pause") {
        await sdk.subscriptions.pause(args.subscriptionId);
      }
    } catch (error) {
      console.error(`[creem] subscription ${args.operation} failed:`, error);
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(api.lib.compensateSubscriptionLifecycle, {
        subscriptionId: args.subscriptionId,
        ...(args.previousStatus !== undefined
          ? { previousStatus: args.previousStatus }
          : {}),
        ...(args.previousCancelAtPeriodEnd !== undefined
          ? {
              previousCancelAtPeriodEnd: args.previousCancelAtPeriodEnd,
            }
          : {}),
        ...(args.rollback ? { rollback: args.rollback } : {}),
        error: message,
      });
    }
  },
});

export const omitSystemFields = <
  T extends { _id: string; _creationTime: number } | null | undefined,
>(
  doc: T,
) => {
  if (!doc) {
    return doc;
  }
  const { _id, _creationTime, ...rest } = doc;
  return rest;
};
