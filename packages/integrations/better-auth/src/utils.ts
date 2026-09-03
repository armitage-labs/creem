import type { GenericEndpointContext } from "better-auth";
import { generateSignature, parseWebhookEvent } from "@creem_io/webhook-types";

export { generateSignature, parseWebhookEvent };

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
