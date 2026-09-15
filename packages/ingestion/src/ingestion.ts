import { Creem } from "creem";
import { BufferedDelivery, toWireEvent } from "./delivery.js";
import type { IngestionStrategy, StrategyEmission } from "./strategy.js";
import type {
  EventProperties,
  IngestResult,
  IngestionConfig,
  IngestionCustomer,
  IngestionEvent,
} from "./types.js";

const DEFAULT_MAX_BATCH_SIZE = 100; // the server's per-request cap
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_QUEUE_SIZE = 10_000;
const DEFAULT_MAX_RETRIES = 5;

/** Resolves a cost figure from a strategy emission; written to `_cost`. */
export type CostResolver = (emission: StrategyEmission) => number;

/** Merges extra properties into a strategy emission's event. */
export type PropertiesResolver = (emission: StrategyEmission) => EventProperties;

export interface StrategyClientFactory<TClient> {
  /** A wrapped client whose usage is metered for this customer. */
  client(customer: IngestionCustomer): TClient;
}

/**
 * Entry point. `Ingestion({ apiKey })` gives you:
 *
 * - `ingest(events)` — direct, awaited delivery (throws to the caller)
 * - `enqueue(event)` + `flush()` — buffered, non-blocking delivery that can
 *   never throw into or slow a request path
 * - `strategy(s).cost(fn).ingest(name)` — the chainable builder metering
 *   adapters plug into
 */
export function Ingestion(config: IngestionConfig): IngestionPipeline {
  return new IngestionPipeline(config);
}

export class IngestionPipeline {
  private readonly creem: Creem;
  private readonly delivery: BufferedDelivery;
  private readonly onWarnings: IngestionConfig["onWarnings"];

  constructor(config: IngestionConfig) {
    this.creem = config.client ?? new Creem({ apiKey: config.apiKey, serverURL: config.serverURL });
    this.onWarnings = config.onWarnings;
    this.delivery = new BufferedDelivery(
      (events) =>
        this.creem.events.ingestEvents(
          { events },
          // The pipeline owns retry policy; the SDK must not retry underneath it.
          { retries: { strategy: "none" } },
        ),
      {
        maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
        flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
        maxQueueSize: config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
        maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
        onError: config.onError ?? (() => undefined),
        onWarnings: config.onWarnings ?? (() => undefined),
      },
    );
  }

  /**
   * Send a batch directly and await the 202 envelope. Errors THROW here —
   * this is the explicit path for callers who want to handle them. Use
   * `enqueue` for the never-throws path.
   */
  async ingest(events: IngestionEvent[]): Promise<IngestResult> {
    const result = await this.creem.events.ingestEvents({
      events: events.map(toWireEvent),
    });
    if (this.onWarnings && result.warnings && result.warnings.length > 0) {
      this.onWarnings(result.warnings);
    }
    return result;
  }

  /** Buffer an event for background delivery. Never throws, never awaits. */
  enqueue(event: IngestionEvent): void {
    this.delivery.enqueue(event);
  }

  /** Deliver everything buffered. Awaitable for serverless teardown. */
  flush(): Promise<void> {
    return this.delivery.flush();
  }

  /** Flush and refuse further events. */
  close(): Promise<void> {
    return this.delivery.close();
  }

  /** Events currently buffered. */
  get pending(): number {
    return this.delivery.pending;
  }

  strategy<TClient>(
    ingestionStrategy: IngestionStrategy<TClient>,
  ): StrategyPipelineBuilder<TClient> {
    return new StrategyPipelineBuilder(this, ingestionStrategy);
  }
}

export class StrategyPipelineBuilder<TClient> {
  private costResolver?: CostResolver;

  constructor(
    private readonly pipeline: IngestionPipeline,
    private readonly ingestionStrategy: IngestionStrategy<TClient>,
  ) {}

  /** Attach a cost figure to every emitted event (reserved `_cost` key). */
  cost(costResolver: CostResolver): this {
    this.costResolver = costResolver;
    return this;
  }

  /**
   * Bind the event name and finish the chain. Every usage the strategy
   * observes is enqueued (buffered, non-blocking) as `eventName`.
   */
  ingest(
    eventName: string,
    propertiesResolver?: PropertiesResolver,
  ): StrategyClientFactory<TClient> {
    const { pipeline, ingestionStrategy, costResolver } = this;
    return {
      client: (customer: IngestionCustomer): TClient =>
        ingestionStrategy.createClient(customer, (emission) => {
          const properties: EventProperties = {
            ...emission.properties,
            ...(propertiesResolver ? propertiesResolver(emission) : {}),
            strategy: ingestionStrategy.strategyKind,
          };
          if (costResolver) {
            properties._cost = costResolver(emission);
          }
          pipeline.enqueue({ name: eventName, ...customer, properties });
        }),
    };
  }
}
