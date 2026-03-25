import { type NextRequest } from "next/server";
import { generateSignature, parseWebhookEvent } from "@creem_io/webhook-types";

export { generateSignature, parseWebhookEvent };

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
