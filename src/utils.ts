import type { GenericEndpointContext } from "better-auth";
import { isWebhookEventEntity, NormalizedWebhookEvent } from "./webhook-types.js";

/**
 * Generates an HMAC-SHA256 signature for webhook verification.
 * Uses the Web Crypto API for cross-platform compatibility (Node.js, browsers, V8 isolates).
 */
export async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);

  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  url: string | undefined,
  ctx: GenericEndpointContext,
): string | undefined {
  if (!url) return undefined;

  // Check if URL is already absolute (contains protocol)
  try {
    new URL(url);
    return url; // Already absolute URL
  } catch {
    // URL is relative, convert to absolute
    const headers = ctx.request?.headers;
    const host = headers?.get("host") || headers?.get("x-forwarded-host");
    const protocol = headers?.get("x-forwarded-proto") || headers?.get("x-forwarded-protocol");

    if (!host) {
      return url; // Return as-is if we can't resolve
    }

    const baseUrl = `${protocol || "https"}://${host}`;
    return new URL(url, baseUrl).toString();
  }
}
