import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions, SubscriptionRecord } from "./types.js";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResponse,
} from "./cancel-subscription-types.js";

export const CancelSubscriptionParams = z.object({
  id: z.string().optional(),
});

export type CancelSubscriptionParams = z.infer<typeof CancelSubscriptionParams>;

// Re-export types for convenience
export type { CancelSubscriptionInput, CancelSubscriptionResponse };

const createCancelSubscriptionHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = ctx.body as CancelSubscriptionParams;

    if (!options.apiKey) {
      return ctx.json(
        {
          error:
            "Creem API key is not configured. Please set the apiKey option when initializing the Creem plugin.",
        },
        { status: 500 },
      );
    }

    try {
      const session = await getSessionFromCtx(ctx);

      if (!session?.user?.id) {
        return ctx.json({ error: "User must be logged in" }, { status: 400 });
      }

      let subscriptionId = body.id;

      // Check if database persistence is enabled
      const shouldPersist = options.persistSubscriptions !== false;

      if (shouldPersist) {
        // If database persistence is enabled, fetch the user's subscription from the database
        const userId = session.user.id;

        logger.debug(`[creem] Cancel: looking up subscriptions for user ${userId}`);

        // Find all subscriptions for this user
        const subscriptions = await ctx.context.adapter.findMany<SubscriptionRecord>({
          model: "creem_subscription",
          where: [{ field: "referenceId", value: userId }],
        });

        if (subscriptions && subscriptions.length > 0) {
          // Find an active subscription (active, trialing, or any non-expired subscription)
          const activeSubscription = subscriptions.find(
            (sub) =>
              sub.status === "active" ||
              sub.status === "trialing" ||
              sub.status === "unpaid" ||
              sub.status === "past_due",
          );

          if (activeSubscription && activeSubscription.creemSubscriptionId) {
            // Use the subscription ID from the database
            subscriptionId = activeSubscription.creemSubscriptionId;
          } else if (!subscriptionId) {
            // If no active subscription and no ID provided, return error
            return ctx.json(
              { error: "No active subscription found for this user" },
              { status: 404 },
            );
          }
        } else if (!subscriptionId) {
          // No subscriptions in database and no ID provided
          return ctx.json({ error: "No subscription found for this user" }, { status: 404 });
        }
      } else if (!subscriptionId) {
        // If persistence is disabled and no ID provided, return error
        return ctx.json(
          {
            error: "Subscription ID is required when database persistence is disabled",
          },
          { status: 400 },
        );
      }

      logger.debug(`[creem] Cancelling subscription: ${subscriptionId}`);

      await creem.subscriptions.cancel(subscriptionId, {});

      return ctx.json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to cancel subscription: ${message}`);
      return ctx.json({ error: "Failed to cancel subscription" }, { status: 500 });
    }
  };
};

/**
 * Creates the cancel subscription endpoint for the Creem plugin.
 *
 * This endpoint cancels an active subscription. The subscription will be
 * canceled immediately or at the end of the current billing period,
 * depending on your Creem settings.
 *
 * **Behavior:**
 * - If database persistence is enabled (persistSubscriptions: true), the endpoint
 *   will automatically find the authenticated user's active subscription and cancel it.
 *   The `id` parameter is optional in this case.
 * - If database persistence is disabled, the `id` parameter is required.
 *
 * @param creem - The Creem client instance
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint POST /creem/cancel-subscription
 *
 * @example
 * Client-side usage with database persistence enabled (id is optional):
 * ```typescript
 * // Cancels the authenticated user's active subscription
 * const { data, error } = await authClient.creem.cancelSubscription({});
 *
 * if (data?.success) {
 *   console.log(data.message); // "Subscription cancelled successfully"
 * }
 * ```
 *
 * @example
 * Client-side usage with explicit subscription ID:
 * ```typescript
 * const { data, error } = await authClient.creem.cancelSubscription({
 *   id: "sub_abc123"
 * });
 *
 * if (data?.success) {
 *   console.log(data.message); // "Subscription cancelled successfully"
 * }
 * ```
 */
export const createCancelSubscriptionEndpoint = (creem: Creem, options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/cancel-subscription",
    {
      method: "POST",
      body: CancelSubscriptionParams,
    },
    createCancelSubscriptionHandler(creem, options),
  );
};
