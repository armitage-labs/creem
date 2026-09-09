/**
 * Webhook event parsers extracted from the Creem client.
 * Depend only on the Creem SDK types — no Convex runtime needed.
 */
import type {
  CheckoutEntity,
  CustomerEntity,
  ProductEntity,
  RefundEntity,
  SubscriptionEntity,
  WebhookEventEntity,
} from "creem/models/components";
import {
  subscriptionEntityFromJSON,
  checkoutEntityFromJSON,
  productEntityFromJSON,
  refundEntityFromJSON,
  webhookEventEntityFromJSON,
} from "creem/models/components";

export type CreemWebhookEvent = WebhookEventEntity;

type WebhookLikeEvent = {
  eventType?: unknown;
  object?: unknown;
};

export const parseGeneratedWebhookEvent = (
  body: string,
): WebhookEventEntity => {
  const result = webhookEventEntityFromJSON(body);
  if (!result.ok) throw result.error;
  return result.value;
};

const asWebhookLikeEvent = (event: unknown): WebhookLikeEvent =>
  event && typeof event === "object" ? (event as WebhookLikeEvent) : {};

export const getEventType = (event: unknown): string => {
  const eventType = asWebhookLikeEvent(event).eventType;
  return typeof eventType === "string" ? eventType : "";
};

export const getEventData = (event: unknown): unknown =>
  asWebhookLikeEvent(event).object;

/**
 * Extract customer ID from a CustomerEntity | string union.
 */
export const getCustomerId = (
  customer: CustomerEntity | string | undefined | null,
): string | null => {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
};

/**
 * Extract billing entity ID from webhook metadata.
 *
 * Prefers convexBillingEntityId, falls back to convexUserId.
 */
export const getConvexEntityId = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;
  // Prefer billingEntityId (org billing), fall back to userId (personal billing)
  if (typeof meta.convexBillingEntityId === "string")
    return meta.convexBillingEntityId;
  if (typeof meta.convexUserId === "string") return meta.convexUserId;
  return null;
};

/**
 * Parse a raw webhook subscription object into a typed SubscriptionEntity
 * using the SDK's generated parser.
 */
export const parseSubscription = (
  obj: Record<string, unknown>,
): SubscriptionEntity | null => {
  try {
    const result = subscriptionEntityFromJSON(JSON.stringify(obj));
    if (result.ok) {
      return result.value;
    }
    console.warn("SDK subscription parsing failed:", result.error);
  } catch (e) {
    console.warn("SDK subscription parsing threw:", e);
  }
  return null;
};

/**
 * Parse a raw webhook checkout object into a typed CheckoutEntity
 * using the SDK's generated parser.
 */
export const parseCheckout = (
  obj: Record<string, unknown>,
): CheckoutEntity | null => {
  try {
    const result = checkoutEntityFromJSON(JSON.stringify(obj));
    if (result.ok) {
      return result.value;
    }
    console.warn("SDK checkout parsing failed:", result.error);
  } catch (e) {
    console.warn("SDK checkout parsing threw:", e);
  }
  return null;
};

/**
 * Parse a raw webhook product object into a typed ProductEntity
 * using the SDK's generated parser.
 */
export const parseProduct = (
  obj: Record<string, unknown>,
): ProductEntity | null => {
  try {
    const result = productEntityFromJSON(JSON.stringify(obj));
    if (result.ok) {
      return result.value;
    }
    console.warn("SDK product parsing failed:", result.error);
  } catch (e) {
    console.warn("SDK product parsing threw:", e);
  }
  return null;
};

/**
 * Parse a raw webhook refund object into a typed RefundEntity
 * using the SDK's generated parser.
 */
export const parseRefund = (
  obj: Record<string, unknown>,
): RefundEntity | null => {
  try {
    const result = refundEntityFromJSON(JSON.stringify(obj));
    if (result.ok) {
      return result.value;
    }
    console.warn("SDK refund parsing failed:", result.error);
  } catch (e) {
    console.warn("SDK refund parsing threw:", e);
  }
  return null;
};
