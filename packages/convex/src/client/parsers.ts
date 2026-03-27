/**
 * Webhook event parsers extracted from the Creem client.
 * Depend only on the Creem SDK types — no Convex runtime needed.
 */
import type {
  CheckoutEntity,
  CustomerEntity,
  ProductEntity,
  SubscriptionEntity,
} from "creem/models/components";
import {
  subscriptionEntityFromJSON,
  checkoutEntityFromJSON,
  productEntityFromJSON,
} from "creem/models/components";

export type CreemWebhookEvent = {
  type?: string;
  eventType?: string;
  data?: unknown;
  object?: unknown;
};

export const getEventType = (event: CreemWebhookEvent): string =>
  event.type ?? event.eventType ?? "";

export const getEventData = (event: CreemWebhookEvent): unknown =>
  event.data ?? event.object;

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
 * Manual fallback parser for when the SDK rejects a subscription
 * (e.g. unknown status like `incomplete`). Converts snake_case keys
 * to the camelCase SubscriptionEntity shape that convertToDatabaseSubscription expects.
 */
export const manualParseSubscription = (
  raw: Record<string, unknown>,
): SubscriptionEntity | null => {
  try {
    const parseDate = (v: unknown): Date | undefined =>
      typeof v === "string" ? new Date(v) : undefined;

    // Parse embedded product (can be string ID or object)
    let product: SubscriptionEntity["product"] = raw.product as string;
    if (typeof raw.product === "object" && raw.product !== null) {
      const p = raw.product as Record<string, unknown>;
      const prodResult = productEntityFromJSON(JSON.stringify(p));
      product = prodResult.ok ? prodResult.value : (p.id as string);
    }

    // Parse embedded customer (can be string ID or object)
    let customer: SubscriptionEntity["customer"] = raw.customer as string;
    if (typeof raw.customer === "object" && raw.customer !== null) {
      const c = raw.customer as Record<string, unknown>;
      customer = (c.id as string) ?? (raw.customer as unknown as string);
    }

    return {
      id: raw.id as string,
      mode: (raw.mode as SubscriptionEntity["mode"]) ?? "test",
      object: (raw.object as string) ?? "subscription",
      product,
      customer,
      items: Array.isArray(raw.items)
        ? raw.items.map((item: Record<string, unknown>) => ({
            object: (item.object as string) ?? "subscription_item",
            id: item.id as string,
            productId: (item.product_id as string) ?? "",
            priceId: (item.price_id as string) ?? "",
            units: (item.units as number) ?? 1,
            createdAt: parseDate(item.created_at) ?? new Date(),
            updatedAt: parseDate(item.updated_at) ?? new Date(),
            mode: (item.mode as "test" | "live") ?? "test",
          }))
        : undefined,
      collectionMethod:
        (raw.collection_method as SubscriptionEntity["collectionMethod"]) ??
        "charge_automatically",
      // Pass through the raw status even if the SDK doesn't know it
      status: raw.status as SubscriptionEntity["status"],
      currentPeriodStartDate: parseDate(raw.current_period_start_date),
      currentPeriodEndDate: parseDate(raw.current_period_end_date),
      canceledAt:
        raw.canceled_at != null
          ? (parseDate(raw.canceled_at as string) ?? null)
          : null,
      createdAt: parseDate(raw.created_at) ?? new Date(),
      updatedAt: parseDate(raw.updated_at) ?? new Date(),
    } as SubscriptionEntity;
  } catch (e) {
    console.error("Manual subscription fallback parsing failed:", e);
    return null;
  }
};

/**
 * Parse raw snake_case webhook object into a typed SubscriptionEntity
 * using the SDK's built-in parser (handles snake_case → camelCase + date parsing).
 * Falls back to manual conversion if SDK parsing fails (e.g. unknown status like `incomplete`).
 */
export const parseSubscription = (
  obj: Record<string, unknown>,
): SubscriptionEntity | null => {
  try {
    const result = subscriptionEntityFromJSON(JSON.stringify(obj));
    if (result.ok) {
      return result.value;
    }
    console.warn(
      "SDK subscription parsing failed, attempting manual fallback:",
      result.error,
    );
  } catch (e) {
    console.warn(
      "SDK subscription parsing threw, attempting manual fallback:",
      e,
    );
  }
  return manualParseSubscription(obj);
};

/**
 * Parse raw snake_case webhook object into a typed CheckoutEntity
 * using the SDK's built-in parser.
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
 * Parse raw snake_case webhook object into a typed ProductEntity
 * using the SDK's built-in parser.
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
