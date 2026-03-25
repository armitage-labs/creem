import type { NormalizedWebhookEvent } from "./normalized.js";
import { isWebhookEventEntity } from "./type-guards.js";

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

  return event as NormalizedWebhookEvent;
}
