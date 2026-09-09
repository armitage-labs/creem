import { findPlanById } from "./catalog.js";
import type {
  PlanCatalog,
  UsageLimitEntry,
  UsageLimitResult,
} from "./types.js";

/**
 * Evaluate app-owned usage counts against the limits defined in a catalog plan.
 *
 * The component does **not** own or mutate usage counters — the app provides
 * current usage via the `usage` parameter. The catalog defines the caps via
 * `limits` on each plan entry.
 *
 * @example
 * ```ts
 * const result = evaluateUsageLimits({
 *   catalog,
 *   planId: "basic",
 *   usage: { aiMessages: 5, projects: 2 },
 * });
 * // result.aiMessages => { used: 5, limit: 10, exceeded: false }
 * ```
 */
export const evaluateUsageLimits = ({
  catalog,
  planId,
  usage,
}: {
  catalog: PlanCatalog;
  planId: string;
  usage: Record<string, number>;
}): UsageLimitResult => {
  const plan = findPlanById(catalog, planId);
  const planLimits = plan?.limits ?? {};

  const result: UsageLimitResult = {};

  for (const [key, used] of Object.entries(usage)) {
    const limit = planLimits[key];
    const entry: UsageLimitEntry =
      limit != null
        ? { used, limit, exceeded: used >= limit }
        : { used, limit: Infinity, exceeded: false };
    result[key] = entry;
  }

  return result;
};
