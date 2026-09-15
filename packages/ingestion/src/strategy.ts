import type { EventProperties, IngestionCustomer } from "./types.js";

/**
 * What a strategy reports after observing one billable unit of work — the
 * raw measurements (token counts, bytes, milliseconds), before the pipeline
 * applies its resolvers and reserved keys.
 */
export interface StrategyEmission {
  properties: EventProperties;
}

export type EmitUsage = (emission: StrategyEmission) => void;

/**
 * Base class for metering strategies (LLM wrappers, stream counters, timed
 * execution, …).
 *
 * Deliberately stateless per customer: `createClient` receives the customer
 * and an `emit` callback and returns a fresh wrapped client. Nothing on the
 * strategy instance is mutated per call, so one strategy can serve many
 * customers concurrently on a long-lived server.
 */
export abstract class IngestionStrategy<TClient> {
  /**
   * Written into every emitted event's `properties.strategy`, so meters can
   * filter by capture mechanism.
   */
  abstract readonly strategyKind: string;

  abstract createClient(customer: IngestionCustomer, emit: EmitUsage): TClient;
}
