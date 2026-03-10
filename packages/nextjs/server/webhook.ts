import { type NextRequest, NextResponse } from "next/server";
import type { WebhookOptions } from "../types";
import { generateSignature, parseWebhookEvent } from "./utils";

/**
 * Creates a webhook handler for Creem webhooks
 *
 * @param options - Webhook configuration options
 * @returns An async function that handles incoming webhook requests
 *
 * @example
 * ```typescript
 * import { Webhooks } from "@creem/nextjs/server";
 *
 * export const POST = Webhooks({
 *   webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
 *   onCheckoutCompleted: async ({ product, customer }) => {
 *     console.log(`${customer?.email} purchased ${product.name}`);
 *   },
 *   onGrantAccess: async ({ reason, customer, metadata }) => {
 *     // Grant access to your application
 *   },
 *   onRevokeAccess: async ({ reason, customer, metadata }) => {
 *     // Revoke access from your application
 *   },
 * });
 * ```
 */
export const Webhook = (options: WebhookOptions) => {
  return async (request: NextRequest) => {
    try {
      // Read the raw request body
      const body = await request.text();

      // Get the signature from headers
      const signature = request.headers.get("creem-signature");

      // Verify the webhook signature
      if (
        !signature ||
        generateSignature(body, options.webhookSecret) !== signature
      ) {
        console.error("Creem webhook: Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }

      // Parse the webhook event
      const event = parseWebhookEvent(body);

      // Handle the webhook event based on its type
      switch (event.eventType) {
        case "checkout.completed":
          console.log("Checkout completed", event);
          await options.onCheckoutCompleted?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "refund.created":
          console.log("Refund created");
          await options.onRefundCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "dispute.created":
          console.log("Dispute created");
          await options.onDisputeCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.active":
          console.log("Subscription active");
          await options.onGrantAccess?.({
            reason: "subscription_active",
            ...event.object,
          });
          await options.onSubscriptionActive?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.trialing":
          console.log("Subscription trialing");
          await options.onGrantAccess?.({
            reason: "subscription_trialing",
            ...event.object,
          });
          await options.onSubscriptionTrialing?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.canceled":
          console.log("Subscription canceled");
          await options.onSubscriptionCanceled?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.paid":
          console.log("Subscription paid");
          await options.onGrantAccess?.({
            reason: "subscription_paid",
            ...event.object,
          });
          await options.onSubscriptionPaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.expired":
          console.log("Subscription expired");
          await options.onRevokeAccess?.({
            reason: "subscription_expired",
            ...event.object,
          });
          await options.onSubscriptionExpired?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.unpaid":
          console.log("Subscription unpaid");
          await options.onSubscriptionUnpaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.update":
          console.log("Subscription update");
          await options.onSubscriptionUpdate?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.past_due":
          console.log("Subscription past due");
          await options.onSubscriptionPastDue?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        case "subscription.paused":
          console.log("Subscription paused");
          await options.onRevokeAccess?.({
            reason: "subscription_paused",
            ...event.object,
          });
          await options.onSubscriptionPaused?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...event.object,
          });
          break;

        default:
          console.error("Unknown event type", event);
          return NextResponse.json(
            { error: "Unknown event type" },
            { status: 400 }
          );
      }

      return NextResponse.json({ message: "Webhook received" });
    } catch (error) {
      console.error("Creem webhook error:", error);
      return NextResponse.json(
        { error: "Failed to process webhook" },
        { status: 500 }
      );
    }
  };
};
