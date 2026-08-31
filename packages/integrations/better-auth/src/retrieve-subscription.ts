import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions, SubscriptionRecord } from "./types.js";
import type { RetrieveSubscriptionInput, SubscriptionData } from "./retrieve-subscription-types.js";

export const RetrieveSubscriptionParams = z.object({
  id: z.string().optional(),
});

export type RetrieveSubscriptionParams = z.infer<typeof RetrieveSubscriptionParams>;

// Re-export types for convenience
export type { RetrieveSubscriptionInput, SubscriptionData };

const createRetrieveSubscriptionHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = ctx.body as RetrieveSubscriptionParams;

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

        logger.debug(`[creem] Retrieve: looking up subscriptions for user ${userId}`);

        // Find all subscriptions for this user
        const subscriptions = await ctx.context.adapter.findMany<SubscriptionRecord>({
          model: "creem_subscription",
          where: [{ field: "referenceId", value: userId }],
        });

        if (subscriptions && subscriptions.length > 0) {
          // Get the first subscription for this user
          const userSubscription = subscriptions[0];

          if (userSubscription && userSubscription.creemSubscriptionId) {
            // Use the subscription ID from the database
            subscriptionId = userSubscription.creemSubscriptionId;
          } else if (!subscriptionId) {
            // If subscription doesn't have a Creem ID and no ID provided, return error
            return ctx.json({ error: "No subscription found for this user" }, { status: 404 });
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

      logger.debug(`[creem] Retrieving subscription: ${subscriptionId}`);

      const subscription = await creem.subscriptions.get(subscriptionId);

      return ctx.json(subscription);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to retrieve subscription: ${message}`);
      return ctx.json({ error: "Failed to retrieve subscription" }, { status: 500 });
    }
  };
};

/**
 * Creates the retrieve subscription endpoint for the Creem plugin.
 *
 * This endpoint retrieves detailed information about a subscription,
 * including its status, product details, customer information, and billing dates.
 *
 * **Behavior:**
 * - If database persistence is enabled (persistSubscriptions: true), the endpoint
 *   will automatically find the authenticated user's subscription and retrieve it.
 *   The `id` parameter is optional in this case.
 * - If database persistence is disabled, the `id` parameter is required.
 *
 * @param creem - The Creem client instance
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint POST /creem/retrieve-subscription
 *
 * @example
 * Client-side usage with database persistence enabled (id is optional):
 * ```typescript
 * // Retrieves the authenticated user's subscription
 * const { data, error } = await authClient.creem.retrieveSubscription({});
 *
 * if (data) {
 *   console.log(`Status: ${data.status}`);
 *   console.log(`Product: ${data.product.name}`);
 *   console.log(`Period ends: ${data.currentPeriodEndDate}`);
 * }
 * ```
 *
 * @example
 * Client-side usage with explicit subscription ID:
 * ```typescript
 * const { data, error } = await authClient.creem.retrieveSubscription({
 *   id: "sub_abc123"
 * });
 *
 * if (data) {
 *   console.log(`Status: ${data.status}`);
 *   console.log(`Product: ${data.product.name}`);
 *   console.log(`Period ends: ${data.currentPeriodEndDate}`);
 * }
 * ```
 */
export const createRetrieveSubscriptionEndpoint = (creem: Creem, options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/retrieve-subscription",
    {
      method: "POST",
      body: RetrieveSubscriptionParams,
    },
    createRetrieveSubscriptionHandler(creem, options),
  );
};
