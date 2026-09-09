import type { Creem } from "creem";
import type { RequestOptions } from "creem/lib/sdks";

export type OperationHandler = (
  client: Creem,
  parameters: Record<string, unknown>,
  body: Record<string, unknown>,
  options: RequestOptions,
) => Promise<unknown>;

// Validate camelCase input with the SDK's outbound schema, then recover its
// typed request using the inverse schema. No unchecked request/response casts.
export function decode<T>(
  outbound: { parse(value: unknown): unknown },
  inbound: { parse(value: unknown): T },
  value: unknown,
): T {
  return inbound.parse(outbound.parse(value));
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
