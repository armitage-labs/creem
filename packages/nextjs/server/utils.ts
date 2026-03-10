import crypto from "crypto";
import { type NextRequest } from "next/server";
import { isWebhookEventEntity, NormalizedWebhookEvent } from "./webhook-types";

/**
 * Generates an HMAC SHA256 signature for webhook verification
 */
export function generateSignature(payload: string, secret: string): string {
  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return computedSignature;
}

/**
 * Parses and validates a webhook event payload from Creem.
 * Returns a normalized event where nested objects (customer, product, etc.) are guaranteed to be expanded.
 */
export function parseWebhookEvent(payload: string): NormalizedWebhookEvent {
  const event = JSON.parse(payload);

  const isValid = isWebhookEventEntity(event);

  if (!isValid) {
    throw new Error("Invalid webhook event");
  }

  // Creem webhooks always return expanded objects, so we can safely cast to NormalizedWebhookEvent
  return event as NormalizedWebhookEvent;
}

/**
 * Converts a relative URL to an absolute URL using the request context
 * If the URL is already absolute, returns it as-is
 */
export function resolveSuccessUrl(
  url: string | undefined | null,
  req: NextRequest
): string | undefined {
  if (!url) return undefined;

  // Check if URL is already absolute (contains protocol)
  try {
    new URL(url);
    return url; // Already absolute URL
  } catch {
    // URL is relative, convert to absolute
    const host = req.headers.get("host") || req.headers.get("x-forwarded-host");
    const protocol =
      req.headers.get("x-forwarded-proto") || req.headers.get("x-forwarded-protocol") || "https";

    if (!host) {
      console.warn("Could not resolve host for relative URL:", url);
      return url; // Return as-is if we can't resolve
    }

    const baseUrl = `${protocol}://${host}`;
    return new URL(url, baseUrl).toString();
  }
}
