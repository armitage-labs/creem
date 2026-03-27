import { Creem, type ApiResolver } from "@mmailaender/convex-creem";
import { api, components } from "./_generated/api";
import { internalAction, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const creem = new Creem(components.creem);

// ── Auth resolver ───────────────────────────────────────────────
// Replace with your own auth logic (e.g. ctx.auth.getUserIdentity()).
// This example uses a demo user from the "users" table.
const resolve: ApiResolver = async (ctx) => {
  const user: { _id: Id<"users">; email: string } = await ctx.runQuery(
    api.billing.getUserInfo,
  );
  return {
    userId: user._id as string,
    email: user.email,
    entityId: user._id as string,
    // For org billing, resolve the org ID:
    // entityId: user.activeOrgId ?? user._id,
  };
};
export const getUserInfo = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("User not found");
    return user;
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
  orders,
} = creem.api({ resolve });

// Component-specific
export { uiModel, snapshot };

// SDK-mirrored (flat exports with namespace prefix)
export const checkoutsCreate = checkouts.create;
export const subscriptionsUpdate = subscriptions.update;
export const subscriptionsCancel = subscriptions.cancel;
export const subscriptionsResume = subscriptions.resume;
export const subscriptionsPause = subscriptions.pause;
export const subscriptionsList = subscriptions.list;
export const subscriptionsListAll = subscriptions.listAll;
export const productsList = products.list;
export const productsGet = products.get;
export const customersRetrieve = customers.retrieve;
export const customersPortalUrl = customers.portalUrl;
export const ordersList = orders.list;

export const syncBillingProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    await creem.syncProducts(ctx);
    return { synced: true };
  },
});
