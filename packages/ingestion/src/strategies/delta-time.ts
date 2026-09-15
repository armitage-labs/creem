import { IngestionStrategy, type EmitUsage } from "../strategy.js";
import type { IngestionCustomer } from "../types.js";

/**
 * Executes a unit of work and reports how long it took.
 * Returns whatever the wrapped execution returns.
 */
export type DeltaTimeClient = <TResult>(
  execution: () => TResult | Promise<TResult>,
) => Promise<TResult>;

/**
 * The cheapest metering strategy: time an execution, bill the duration.
 * Covers "per API call", "per job", "per render" — anything where the
 * billable unit is elapsed time.
 *
 * ```ts
 * import { DeltaTimeStrategy } from "@creem_io/ingestion";
 *
 * const metered = ingestion
 *   .strategy(new DeltaTimeStrategy())
 *   .ingest("compute-time");
 *
 * const timed = metered.client({ customerId });
 * const output = await timed(() => renderVideo(input));
 * // → event with properties.delta_time_ms
 * ```
 *
 * Only SUCCESSFUL executions emit an event — a throwing execution
 * propagates its error to the caller and bills nothing, so a customer is
 * never charged for work that failed.
 *
 * The clock is injectable (`new DeltaTimeStrategy(() => performance.now())`)
 * for testability and higher-resolution timing; it defaults to `Date.now`.
 */
export class DeltaTimeStrategy extends IngestionStrategy<DeltaTimeClient> {
  readonly strategyKind = "delta-time";

  constructor(private readonly now: () => number = () => Date.now()) {
    super();
  }

  createClient(_customer: IngestionCustomer, emit: EmitUsage): DeltaTimeClient {
    const { now } = this;
    return async <TResult>(execution: () => TResult | Promise<TResult>): Promise<TResult> => {
      const startedAt = now();
      const result = await execution();
      emit({ properties: { delta_time_ms: now() - startedAt } });
      return result;
    };
  }
}
