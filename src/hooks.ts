import { type GenericEndpointContext, logger } from "better-auth";
import type {
  NormalizedCheckoutCompletedEvent,
  NormalizedSubscriptionActiveEvent,
  NormalizedSubscriptionTrialingEvent,
  NormalizedSubscriptionCanceledEvent,
  NormalizedSubscriptionPaidEvent,
  NormalizedSubscriptionExpiredEvent,
  NormalizedSubscriptionUnpaidEvent,
  NormalizedSubscriptionUpdateEvent,
  NormalizedSubscriptionPastDueEvent,
  NormalizedSubscriptionPausedEvent,
  NormalizedSubscriptionEntity,
  SubscriptionStatus,
} from "./webhook-types.js";
import type { CreemOptions } from "./types.js";

interface Subscription {
  id: string;
  productId: string;
  referenceId: string;
  creemCustomerId?: string;
  creemSubscriptionId?: string;
  creemOrderId?: string;
  status: string;
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Handle checkout.completed event
 * - Updates user with creemCustomerId (for first-time checkout)
 * - Creates or updates subscription record
 */
export async function onCheckoutCompleted(
  ctx: GenericEndpointContext,
  event: NormalizedCheckoutCompletedEvent,
  options: CreemOptions,
) {
  // Skip database operations if persistSubscriptions is disabled
  const shouldPersist = options.persistSubscriptions !== false;

  if (!shouldPersist) {
    logger.info("Database persistence disabled, skipping checkout.completed database operations");
    return;
  }

  try {
    const checkout = event.object;

    // Customer is always expanded in webhook events
    const customerId = checkout.customer?.id;

    if (!customerId) {
      logger.warn("Creem webhook: No customer ID found in checkout.completed event");
      return;
    }

    // Extract referenceId from metadata
    const referenceId = checkout.metadata?.referenceId as string;

    if (!referenceId) {
      logger.warn("Creem webhook: No referenceId found in checkout.completed event");
      return;
    }

    // Update user with creemCustomerId (if user exists)
    try {
      const user = await ctx.context.adapter.findOne<{
        id: string;
        creemCustomerId?: string;
      }>({
        model: "user",
        where: [{ field: "id", value: referenceId }],
      });

      if (user && !user.creemCustomerId) {
        await ctx.context.adapter.update({
          model: "user",
          where: [{ field: "id", value: referenceId }],
          update: {
            creemCustomerId: customerId,
          },
        });
        logger.info(`Updated user ${referenceId} with creemCustomerId: ${customerId}`);
      }
    } catch (error) {
      logger.error(`Failed to update user with creemCustomerId: ${error}`);
    }

    // Handle subscription if this is a recurring product
    if (checkout.subscription && checkout.order) {
      const subscriptionData = checkout.subscription;
      const orderId = typeof checkout.order === "object" ? checkout.order.id : checkout.order;
      const productId = checkout.product.id;

      if (subscriptionData.id) {
        const subscriptionUpdate = {
          productId: productId || "",
          referenceId,
          creemCustomerId: customerId,
          creemSubscriptionId: subscriptionData.id,
          creemOrderId: orderId,
          status: subscriptionData.status,
          periodStart: subscriptionData.current_period_start_date
            ? new Date(subscriptionData.current_period_start_date)
            : undefined,
          periodEnd: subscriptionData.current_period_end_date
            ? new Date(subscriptionData.current_period_end_date)
            : undefined,
        };

        // Try to find existing subscription by creemSubscriptionId or referenceId + productId
        const existingSubscription = await ctx.context.adapter.findOne<Subscription>({
          model: "creem_subscription",
          where: [{ field: "creemSubscriptionId", value: subscriptionData.id }],
        });

        if (existingSubscription) {
          // Update existing subscription
          await ctx.context.adapter.update({
            model: "creem_subscription",
            where: [{ field: "id", value: existingSubscription.id }],
            update: subscriptionUpdate,
          });
          logger.info(`Updated subscription ${existingSubscription.id} with Creem data`);
        } else {
          // Create new subscription
          const newSubscription = await ctx.context.adapter.create<Subscription>({
            model: "creem_subscription",
            data: subscriptionUpdate,
          });
          logger.info(`Created new subscription ${newSubscription.id} from checkout`);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Creem webhook failed (checkout.completed): ${message}`);
  }
}

/**
 * Handle subscription.active event
 * Updates subscription status to active
 */
export async function onSubscriptionActive(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionActiveEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "active", options);
}

/**
 * Handle subscription.trialing event
 * Updates subscription status to trialing and marks user as having used a trial
 * for trial abuse prevention.
 */
export async function onSubscriptionTrialing(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionTrialingEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "trialing", options);

  // Mark user as having used a trial (for trial abuse prevention)
  await markUserAsHadTrial(ctx, event.object, options);
}

/**
 * Mark a user as having used a trial period.
 * This is used for automatic trial abuse prevention - once a user has had
 * a trial, they cannot receive another trial on any subscription plan.
 *
 * This function is idempotent - calling it multiple times for the same user
 * will not cause issues.
 */
async function markUserAsHadTrial(
  ctx: GenericEndpointContext,
  subscriptionData: NormalizedSubscriptionEntity,
  options: CreemOptions,
) {
  // Skip if persistence is disabled
  const shouldPersist = options.persistSubscriptions !== false;
  if (!shouldPersist) {
    return;
  }

  const referenceId = subscriptionData.metadata?.referenceId as string;
  if (!referenceId) {
    logger.warn(
      "Creem webhook: Cannot mark user as hadTrial - no referenceId in subscription metadata",
    );
    return;
  }

  try {
    // Find the user
    const user = await ctx.context.adapter.findOne<{
      id: string;
      hadTrial?: boolean;
    }>({
      model: "user",
      where: [{ field: "id", value: referenceId }],
    });

    if (!user) {
      logger.warn(
        `Creem webhook: User not found for referenceId: ${referenceId}, cannot mark as hadTrial`,
      );
      return;
    }

    // Only update if not already marked (idempotent)
    if (!user.hadTrial) {
      await ctx.context.adapter.update({
        model: "user",
        where: [{ field: "id", value: referenceId }],
        update: {
          hadTrial: true,
        },
      });
      logger.info(`Marked user ${referenceId} as hadTrial=true (trial abuse prevention)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to mark user as hadTrial: ${message}`);
  }
}

/**
 * Handle subscription.canceled event
 * Updates subscription status to canceled
 */
export async function onSubscriptionCanceled(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionCanceledEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "canceled", options);
}

/**
 * Handle subscription.paid event
 * Updates subscription with latest payment information
 */
export async function onSubscriptionPaid(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionPaidEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, event.object.status, options);
}

/**
 * Handle subscription.expired event
 * Updates subscription status to expired
 */
export async function onSubscriptionExpired(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionExpiredEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "unpaid", options); // TODO: Check expired status
}

/**
 * Handle subscription.unpaid event
 * Updates subscription status to unpaid
 */
export async function onSubscriptionUnpaid(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionUnpaidEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "unpaid", options);
}

/**
 * Handle subscription.update event
 * Updates subscription with latest information
 */
export async function onSubscriptionUpdate(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionUpdateEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, event.object.status, options);
}

/**
 * Handle subscription.past_due event
 * Updates subscription status to past_due
 */
export async function onSubscriptionPastDue(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionPastDueEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "unpaid", options); // TODO: Check past_due status
}

/**
 * Handle subscription.paused event
 * Updates subscription status to paused
 */
export async function onSubscriptionPaused(
  ctx: GenericEndpointContext,
  event: NormalizedSubscriptionPausedEvent,
  options: CreemOptions,
) {
  await updateSubscriptionFromEvent(ctx, event.object, "paused", options);
}

/**
 * Helper function to update subscription from Creem webhook event
 */
async function updateSubscriptionFromEvent(
  ctx: GenericEndpointContext,
  subscriptionData: NormalizedSubscriptionEntity,
  status: SubscriptionStatus,
  options: CreemOptions,
) {
  // Skip database operations if persistSubscriptions is disabled
  const shouldPersist = options.persistSubscriptions !== false;

  if (!shouldPersist) {
    logger.info("Database persistence disabled, skipping subscription database operations");
    return;
  }

  const referenceId = subscriptionData.metadata?.referenceId;

  if (!referenceId) {
    logger.warn(
      "Creem webhook: No referenceId found in subscription event. The user is likely not logged in.",
    );
    return;
  }

  try {
    // Customer and product are always expanded in webhook events
    const customerId = subscriptionData.customer.id;
    const productId = subscriptionData.product.id;

    // Find subscription by creemSubscriptionId
    let subscription = await ctx.context.adapter.findOne<Subscription>({
      model: "creem_subscription",
      where: [{ field: "creemSubscriptionId", value: subscriptionData.id }],
    });

    // If not found by creemSubscriptionId, try to find by creemCustomerId and productId
    if (!subscription && customerId) {
      const subscriptions = await ctx.context.adapter.findMany<Subscription>({
        model: "creem_subscription",
        where: [{ field: "creemCustomerId", value: customerId }],
      });

      // Find the subscription for this specific product
      subscription =
        subscriptions.find((sub: Subscription) => sub.productId === productId) || subscriptions[0];
    }

    if (!subscription) {
      logger.warn(
        `Creem webhook: Subscription not found for creemSubscriptionId: ${subscriptionData.id}`,
      );
      return;
    }

    // Prepare update data
    const updateData: Partial<Subscription> = {
      status,
      creemSubscriptionId: subscriptionData.id,
      creemCustomerId: customerId,
      periodStart: subscriptionData.current_period_start_date
        ? new Date(subscriptionData.current_period_start_date)
        : subscription.periodStart,
      periodEnd: subscriptionData.current_period_end_date
        ? new Date(subscriptionData.current_period_end_date)
        : subscription.periodEnd,
    };

    // Update subscription
    await ctx.context.adapter.update({
      model: "creem_subscription",
      where: [{ field: "id", value: subscription.id }],
      update: updateData,
    });

    logger.info(`Updated subscription ${subscription.id} to status: ${status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Creem webhook failed (subscription update): ${message}`);
  }
}
