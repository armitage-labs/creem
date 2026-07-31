import {
  Creem,
  defineBillingCatalog,
  type ApiResolver,
} from "@creem_io/convex";
import { components, internal } from "./_generated/api";
import { action, internalAction, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";

const demoCreditsProductId =
  process.env.CREEM_ONETIME_CREDITS ?? "prod_73CnZ794MaJ1DUn8MU0O5f";

const creemServer =
  process.env.CREEM_SERVER === "test" ? "test" : ("prod" as const);

const billingCatalog = defineBillingCatalog({
  version: "example-server",
  plans: [
    {
      planId: "trial",
      category: "trial",
      billingType: "custom",
      eligibilityScopeId: "base",
      eligibility: {
        oncePerEntity: true,
        hideWhenIneligible: true,
        expiresWhenScopeHasNonTrialPlan: true,
      },
    },
    {
      planId: "free",
      category: "free",
      billingType: "custom",
      eligibilityScopeId: "base",
    },
    {
      planId: "ai-credits-100",
      category: "paid",
      billingType: "onetime",
      creemProductIds: {
        custom: demoCreditsProductId,
      },
      creditGrant: {
        amount: "100",
        accountName: "credits",
        unitLabel: "credits",
        refundBehavior: "revoke_on_full_refund",
      },
    },
  ],
} as const);

export const creem = new Creem(components.creem, {
  server: creemServer,
  billingCatalog,
  // Demo cancellation should keep access until period end so
  // `subscription.scheduled_cancel` and resume flows are visible in examples.
  cancelMode: "scheduled",
});

// ── Auth resolver ───────────────────────────────────────────────
// ⚠️ DEMO ONLY — DO NOT COPY THIS RESOLVER INTO A REAL APP. ⚠️
// It returns the first row of the "users" table, so every caller is treated as
// that same user. In a real app this would let anyone cancel or change anyone
// else's subscription. Replace the body with your own auth lookup, e.g.:
//
//   const identity = await ctx.auth.getUserIdentity();
//   if (!identity) return null;
//   return { userId: identity.subject, email: identity.email, entityId: identity.subject };
//

// Return `null` for an unauthenticated caller — that is what keeps public
// pricing pages working. Anything thrown here is treated as a real failure and
// propagates instead of silently rendering the logged-out state.
const resolve: ApiResolver = async (ctx) => {
  const user: {
    _id: Id<"users">;
    email: string;
  } | null = await ctx.runQuery(internal.billing.getUserInfo);
  if (!user) return null;
  return {
    userId: user._id as string,
    email: user.email,
    entityId: user._id as string,
    // For org billing, resolve the org ID:
    // entityId: user.activeOrgId ?? user._id,
  };
};
export const getUserInfo = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("users").first();
  },
});

// ── Quick-start: auto-generated Convex exports via api({ resolve }) ──
// Each export calls `resolve` to determine the authenticated user,
// then delegates to the corresponding creem class method.
// For full control, use creem.subscriptions.cancel(ctx, { entityId })
// etc. directly in your own action/query handlers.

const {
  uiModel,
  snapshot,
  checkouts,
  subscriptions,
  products,
  customers,
  transactions,
  plans,
  orders,
  credits,
} = creem.api({ resolve });

// Component-specific
export { uiModel, snapshot };

// SDK-mirrored (flat exports with namespace prefix)
export const checkoutsCreate = checkouts.create;
export const subscriptionsUpdate = subscriptions.update;
export const subscriptionsCancel = subscriptions.cancel;
export const subscriptionsResume = subscriptions.resume;
export const subscriptionsCancelScheduledUpdate =
  subscriptions.cancelScheduledUpdate;
export const subscriptionsPause = subscriptions.pause;
export const subscriptionsList = subscriptions.list;
export const subscriptionsListAll = subscriptions.listAll;
export const productsList = products.list;
export const productsGet = products.get;
export const customersRetrieve = customers.retrieve;
export const customersPortalUrl = customers.portalUrl;
export const transactionsSearch = transactions.search;
export const plansActivate = plans.activate;
export const ordersList = orders.list;
export const creditsGetBalance = credits.getBalance;
export const creditsListEntries = credits.listEntries;

export const generateDemoImage = action({
  args: {
    // The caller generates this once per user action and reuses it on retry.
    // A key derived from `Date.now()` would be unique per attempt and would
    // therefore debit credits again for every retry of the same request.
    requestId: v.string(),
  },
  returns: v.object({
    id: v.string(),
    creditsConsumed: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await resolve(ctx);
    if (!identity) throw new ConvexError("Not authenticated");
    const { entityId } = identity;
    const idempotencyKey = `demo_generate_image_${entityId}_${args.requestId}`;
    await creem.credits.debitForEntity(ctx, {
      entityId,
      amount: "10",
      reference: "demo_generate_image",
      idempotencyKey,
    });
    return {
      id: idempotencyKey,
      creditsConsumed: "10",
    };
  },
});

export const syncBillingProducts = internalAction({
  args: {},
  returns: v.object({ synced: v.boolean() }),
  handler: async (ctx) => {
    await creem.syncProducts(ctx);
    return { synced: true };
  },
});
