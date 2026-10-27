import { ConvexError } from "convex/values";

type ConvexErrorData = {
  message?: unknown;
};

/**
 * Extracts the human-readable message from a thrown Convex error, falling back
 * to a generic string for non-Convex errors.
 *
 * Use it when surfacing billing failures in your own UI.
 */
export const getConvexErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (!(error instanceof ConvexError)) return fallback;
  if (typeof error.data === "string") return error.data;
  if (error.data && typeof error.data === "object" && "message" in error.data) {
    const message = (error.data as ConvexErrorData).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

/**
 * `code` of the ConvexError thrown when a customer-wide action, such as the
 * customer portal, is refused because other billing entities share the Creem
 * customer.
 */
export const SHARED_CUSTOMER_ERROR_CODE = "shared-customer";

/** Reads `data.code` from a thrown Convex error, if there is one. */
export const getConvexErrorCode = (error: unknown): string | undefined => {
  if (!(error instanceof ConvexError)) return undefined;
  const data: unknown = error.data;
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
};
