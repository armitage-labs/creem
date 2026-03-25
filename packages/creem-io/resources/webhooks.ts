import crypto from "crypto";
import {
  WebhookOptions,
  WebhookEvent,
  CheckoutCompletedEvent,
  RefundCreatedEvent,
  DisputeCreatedEvent,
  SubscriptionEvent,
  GrantAccessContext,
  RevokeAccessContext,
  NormalizedCheckout,
  NormalizedRefund,
  NormalizedDispute,
  NormalizedSubscription,
} from "../types/webhooks";
import { toCamelCase } from "../utils";

/**
 * Type guard to check if an object is a webhook entity
 */
function isWebhookEntity(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const entity = obj as Record<string, unknown>;
  return (
    typeof entity.object === "string" &&
    [
      "checkout",
      "customer",
      "order",
      "product",
      "subscription",
      "refund",
      "dispute",
      "transaction",
    ].includes(entity.object)
  );
}

/**
 * Type guard to check if an object is a webhook event
 */
function isWebhookEvent(obj: unknown): obj is WebhookEvent {
  if (!obj || typeof obj !== "object") return false;
  const event = obj as Record<string, unknown>;
  return (
    typeof event.eventType === "string" &&
    typeof event.id === "string" &&
    typeof event.created_at === "number" &&
    "object" in event &&
    isWebhookEntity(event.object)
  );
}

/**
 * Parse and validate a webhook event from raw payload
 */
function parseWebhookEvent(payload: string): WebhookEvent {
  const event = JSON.parse(payload);
  if (!isWebhookEvent(event)) {
    throw new Error("Invalid webhook event structure");
  }
  return event;
}

/**
 * Generate HMAC SHA256 signature for webhook verification
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature using constant-time comparison
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  // Prevent timing attacks
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Convert snake_case webhook payload to camelCase for better DX
 */
function normalizeWebhookData<T>(data: unknown): T {
  return toCamelCase(data) as T;
}

/**
 * Creates a webhook resource for handling Creem webhooks
 */
export const webhooksResource = (secret?: string) => {
  return {
    /**
     * Handle incoming webhook events with signature verification.
     * Framework-agnostic - works with Express, Next.js, Fastify, etc.
     *
     * @param payload - The raw request body (string or Buffer). Do not pass parsed JSON.
     * @param signature - The signature from the request headers (typically "creem-signature").
     * @param handlers - An object mapping event handlers.
     * @throws {Error} If webhook secret is not configured or signature is invalid.
     *
     * @example
     * // Next.js App Router
     * export async function POST(req: Request) {
     *   const payload = await req.text();
     *   const signature = req.headers.get("creem-signature")!;
     *
     *   try {
     *     await creem.webhooks.handleEvents(payload, signature, {
     *       onCheckoutCompleted: async (data) => {
     *         console.log("Checkout:", data.customer?.email);
     *       },
     *       onGrantAccess: async (context) => {
     *         // Grant access logic
     *       },
     *     });
     *     return new Response("OK", { status: 200 });
     *   } catch (err) {
     *     return new Response("Invalid signature", { status: 400 });
     *   }
     * }
     *
     * @example
     * // Express
     * app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
     *   const payload = req.body.toString();
     *   const signature = req.headers['creem-signature'];
     *
     *   try {
     *     await creem.webhooks.handleEvents(payload, signature, {
     *       onCheckoutCompleted: async (data) => {
     *         console.log("Checkout:", data.customer?.email);
     *       },
     *     });
     *     res.status(200).send("OK");
     *   } catch (err) {
     *     res.status(400).send("Invalid signature");
     *   }
     * });
     */
    handleEvents: async (
      payload: string | Buffer,
      signature: string,
      handlers: Omit<WebhookOptions, "webhookSecret">,
    ): Promise<void> => {
      // 1. Validate webhook secret
      if (!secret) {
        throw new Error("Webhook secret not configured. Pass `webhookSecret` to `createCreem`.");
      }

      // 2. Convert payload to string
      const payloadString = typeof payload === "string" ? payload : payload.toString("utf8");

      // 3. Verify signature
      if (!verifySignature(payloadString, signature, secret)) {
        throw new Error("Invalid webhook signature");
      }

      // 4. Parse and validate event
      const event = parseWebhookEvent(payloadString);

      // 5. Normalize data (convert snake_case to camelCase)
      const normalizedObject = normalizeWebhookData(event.object);

      // 6. Route to appropriate handler
      switch (event.eventType) {
        case "checkout.completed": {
          const checkoutData = normalizedObject as NormalizedCheckout;
          await handlers.onCheckoutCompleted?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...checkoutData,
          } as CheckoutCompletedEvent);
          break;
        }

        case "refund.created": {
          const refundData = normalizedObject as NormalizedRefund;
          await handlers.onRefundCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...refundData,
          } as RefundCreatedEvent);
          break;
        }

        case "dispute.created": {
          const disputeData = normalizedObject as NormalizedDispute;
          await handlers.onDisputeCreated?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...disputeData,
          } as DisputeCreatedEvent);
          break;
        }

        case "subscription.active": {
          const subscriptionData = normalizedObject as NormalizedSubscription;

          // Call onGrantAccess first
          await handlers.onGrantAccess?.({
            reason: "subscription_active",
            ...subscriptionData,
          } as GrantAccessContext);

          // Then call the specific event handler
          await handlers.onSubscriptionActive?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.active">);
          break;
        }

        case "subscription.trialing": {
          const subscriptionData = normalizedObject as NormalizedSubscription;

          // Call onGrantAccess first
          await handlers.onGrantAccess?.({
            reason: "subscription_trialing",
            ...subscriptionData,
          } as GrantAccessContext);

          // Then call the specific event handler
          await handlers.onSubscriptionTrialing?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.trialing">);
          break;
        }

        case "subscription.paid": {
          const subscriptionData = normalizedObject as NormalizedSubscription;

          // Call onGrantAccess first
          await handlers.onGrantAccess?.({
            reason: "subscription_paid",
            ...subscriptionData,
          } as GrantAccessContext);

          // Then call the specific event handler
          await handlers.onSubscriptionPaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.paid">);
          break;
        }

        case "subscription.paused": {
          const subscriptionData = normalizedObject as NormalizedSubscription;

          // Call onRevokeAccess first
          await handlers.onRevokeAccess?.({
            reason: "subscription_paused",
            ...subscriptionData,
          } as RevokeAccessContext);

          // Then call the specific event handler
          await handlers.onSubscriptionPaused?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.paused">);
          break;
        }

        case "subscription.expired": {
          const subscriptionData = normalizedObject as NormalizedSubscription;

          // Call onRevokeAccess first
          await handlers.onRevokeAccess?.({
            reason: "subscription_expired",
            ...subscriptionData,
          } as RevokeAccessContext);

          // Then call the specific event handler
          await handlers.onSubscriptionExpired?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.expired">);
          break;
        }

        case "subscription.canceled": {
          const subscriptionData = normalizedObject as NormalizedSubscription;
          await handlers.onSubscriptionCanceled?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.canceled">);
          break;
        }

        case "subscription.unpaid": {
          const subscriptionData = normalizedObject as NormalizedSubscription;
          await handlers.onSubscriptionUnpaid?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.unpaid">);
          break;
        }

        case "subscription.update": {
          const subscriptionData = normalizedObject as NormalizedSubscription;
          await handlers.onSubscriptionUpdate?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.update">);
          break;
        }

        case "subscription.past_due": {
          const subscriptionData = normalizedObject as NormalizedSubscription;
          await handlers.onSubscriptionPastDue?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.past_due">);
          break;
        }

        case "subscription.scheduled_cancel": {
          const subscriptionData = normalizedObject as NormalizedSubscription;
          await handlers.onSubscriptionScheduledCancel?.({
            webhookEventType: event.eventType,
            webhookId: event.id,
            webhookCreatedAt: event.created_at,
            ...subscriptionData,
          } as SubscriptionEvent<"subscription.scheduled_cancel">);
          break;
        }

        default:
          // Unknown event type - silently ignore
          break;
      }
    },
  };
};
