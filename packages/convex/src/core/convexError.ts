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
