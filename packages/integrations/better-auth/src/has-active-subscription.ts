import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { z } from "zod";
import type { CreemOptions, SubscriptionRecord } from "./types.js";
import type { HasAccessGrantedResponse } from "./has-active-subscription-types.js";

// No input needed - uses session to get user ID
export const HasAccessGrantedParams = z.object({}).optional();

export type HasAccessGrantedParams = z.infer<typeof HasAccessGrantedParams>;

const createHasAccessGrantedHandler = (options: CreemOptions) => {
  return async (ctx: GenericEndpointContext): Promise<HasAccessGrantedResponse> => {
    try {
      const session = await getSessionFromCtx(ctx);

      if (!session?.user?.id) {
        throw new APIError("UNAUTHORIZED", {
          message: "User must be logged in to check subscription status",
        });
      }

      // Check if persistSubscriptions is disabled
      const shouldPersist = options.persistSubscriptions !== false;

      if (!shouldPersist) {
        throw new APIError("BAD_REQUEST", {
          message:
            "Database persistence is disabled. Enable 'persistSubscriptions' option or implement custom subscription checking.",
        });
      }

      const userId = session.user.id;

      // Find all subscriptions for this user
      const subscriptions = await ctx.context.adapter.findMany<SubscriptionRecord>({
        model: "creem_subscription",
        where: [{ field: "referenceId", value: userId }],
      });

      logger.debug(
        `[creem] Access check: user=${userId}, found ${subscriptions?.length || 0} subscriptions`,
      );

      if (!subscriptions || subscriptions.length === 0) {
        return ctx.json({
          hasAccessGranted: false,
          message: "No subscriptions found for this user",
        });
      }

      // Get current UTC time
      const now = new Date();

      // Check each subscription
      for (const subscription of subscriptions) {
        const status = subscription.status.toLowerCase();

        // Active, trialing, or paid = always has access
        // Note: "paid" comes from the subscription.paid webhook event type, not the SDK status field
        if (status === "active" || status === "trialing" || status === "paid") {
          logger.debug(`[creem] Access granted: subscription ${subscription.id} status=${status}`);
          return ctx.json({
            hasAccessGranted: true,
            subscription: {
              id: subscription.id,
              status: subscription.status,
              productId: subscription.productId,
              periodEnd: subscription.periodEnd,
            },
          });
        }

        // Scheduled cancellation and existing payment grace periods retain access until periodEnd.
        if (status === "scheduled_cancel" || status === "past_due" || status === "unpaid") {
          if (subscription.periodEnd) {
            const periodEnd = new Date(subscription.periodEnd);

            // If period hasn't ended yet, user still has access
            if (periodEnd > now) {
              logger.debug(
                `[creem] Access granted: subscription ${subscription.id} ${status} until ${periodEnd.toISOString()}`,
              );
              return ctx.json({
                hasAccessGranted: true,
                subscription: {
                  id: subscription.id,
                  status: subscription.status,
                  productId: subscription.productId,
                  periodEnd: subscription.periodEnd,
                },
                message: `Subscription is ${status} but access granted until ${periodEnd.toISOString()}`,
              });
            }
          }
        }
      }

      logger.debug("[creem] Access denied: no active subscriptions");
      // No active subscriptions found
      return ctx.json({
        hasAccessGranted: false,
        message: "No active subscriptions found",
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          status: s.status,
          productId: s.productId,
          periodEnd: s.periodEnd,
        })),
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to check subscription status: ${errorMessage}`);
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to check subscription status",
      });
    }
  };
};

/**
 * Creates the access check endpoint for the Creem plugin.
 *
 * This endpoint checks whether the authenticated user has an active subscription
 * by querying the local database for subscription records.
 *
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint GET /creem/has-access-granted
 */
export const createHasAccessGrantedEndpoint = (options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/has-access-granted",
    {
      method: "GET",
    },
    createHasAccessGrantedHandler(options),
  );
};
