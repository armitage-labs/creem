import { createAuthEndpoint } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
import type { CreemOptions } from "./types.js";
import { generateSignature, parseWebhookEvent } from "./utils.js";
import {
  onCheckoutCompleted,
  onSubscriptionActive,
  onSubscriptionTrialing,
  onSubscriptionCanceled,
  onSubscriptionPaid,
  onSubscriptionExpired,
  onSubscriptionUnpaid,
  onSubscriptionUpdate,
  onSubscriptionPastDue,
  onSubscriptionPaused,
} from "./hooks.js";

const createWebhookHandler = (options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    try {
      if (!ctx.request) {
        return ctx.json({ error: "Request is required" }, { status: 400 });
      }

      const buf = await ctx.request.text();

      const signature = ctx.request.headers.get("creem-signature");

      if (!options.webhookSecret) {
        return ctx.json({ error: "Invalid signature" }, { status: 400 });
      }

      const computedSignature = await generateSignature(buf, options.webhookSecret);
      if (computedSignature !== signature) {
        return ctx.json({ error: "Invalid signature" }, { status: 400 });
      }

      const event = parseWebhookEvent(buf);

      // TypeScript now knows the exact event type in each case
      // The parsed event from Creem webhooks always has expanded objects
      // We flatten the structure for easier destructuring in callbacks
      switch (event.eventType) {
        case "checkout.completed":
          await onCheckoutCompleted(ctx, event, options);
          options.onCheckoutCompleted?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "refund.created":
          options.onRefundCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "dispute.created":
          options.onDisputeCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.active":
          await onSubscriptionActive(ctx, event, options);
          options.onGrantAccess?.({
            reason: "subscription_active",
            ...event.object,
          });
          options.onSubscriptionActive?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.trialing":
          await onSubscriptionTrialing(ctx, event, options);
          options.onGrantAccess?.({
            reason: "subscription_trialing",
            ...event.object,
          });
          options.onSubscriptionTrialing?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });

          break;
        case "subscription.canceled":
          await onSubscriptionCanceled(ctx, event, options);
          options.onSubscriptionCanceled?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.paid":
          await onSubscriptionPaid(ctx, event, options);
          options.onGrantAccess?.({
            reason: "subscription_paid",
            ...event.object,
          });
          options.onSubscriptionPaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.expired":
          await onSubscriptionExpired(ctx, event, options);
          options.onRevokeAccess?.({
            reason: "subscription_expired",
            ...event.object,
          });
          options.onSubscriptionExpired?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.unpaid":
          await onSubscriptionUnpaid(ctx, event, options);
          options.onSubscriptionUnpaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.update":
          await onSubscriptionUpdate(ctx, event, options);
          options.onSubscriptionUpdate?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.past_due":
          await onSubscriptionPastDue(ctx, event, options);
          options.onSubscriptionPastDue?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.paused":
          await onSubscriptionPaused(ctx, event, options);
          options.onRevokeAccess?.({
            reason: "subscription_paused",
            ...event.object,
          });
          options.onSubscriptionPaused?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        default:
          ctx.json({ error: "Unknown event type" }, { status: 400 });
          break;
      }

      return ctx.json({ message: "Webhook received" });
    } catch (error) {
      return ctx.json({ error: "Failed to process webhook" }, { status: 500 });
    }
  };
};

export const createWebhookEndpoint = (options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/webhook",
    {
      method: "POST",
      requireRequest: true,
      requireHeaders: true,
      disableBody: true,
    },
    createWebhookHandler(options),
  );
};
