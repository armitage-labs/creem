/**
 * Pure utility functions extracted from the Creem client.
 * No external dependencies — fully unit-testable.
 */

/** Extract an entity ID from a string or `{ id: string }` object. Returns `null` if the value is not a valid entity reference. */
export const getEntityId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
};

/** Lowercase all header keys in a record (for case-insensitive header lookup). */
export const lowerCaseHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

/** Convert a `Uint8Array` to a lowercase hex string. */
export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

/** Constant-time string comparison to prevent timing attacks on signature verification. */
export const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

/** Strip the `sha256=` prefix from a webhook signature and lowercase it for comparison. */
export const normalizeSignature = (signature: string) => {
  const trimmed = signature.trim();
  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length).toLowerCase();
  }
  return trimmed.toLowerCase();
};
