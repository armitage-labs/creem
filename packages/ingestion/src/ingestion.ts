import { Creem } from "creem";
import { BufferedDelivery, invokeHook, toWireEvent, withEventId } from "./delivery.js";
import type { IngestionStrategy, StrategyEmission } from "./strategy.js";
import type {
  EventProperties,
  IngestResult,
  IngestionConfig,
  IngestionCustomer,
  IngestionError,
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
  private readonly onError: NonNullable<IngestionConfig["onError"]>;
  private readonly onWarnings: IngestionConfig["onWarnings"];

  constructor(config: IngestionConfig) {
    this.creem = config.client ?? new Creem({ apiKey: config.apiKey, serverURL: config.serverURL });
    this.onError = config.onError ?? (() => undefined);
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
        onError: this.onError,
        onWarnings: config.onWarnings ?? (() => undefined),
      },
    );
  }

  /**
   * Send a batch directly and await the 202 envelope. Errors THROW here —
   * this is the explicit path for callers who want to handle them. Use
   * `enqueue` for the never-throws path.
   *
   * Events without an `eventId` get one before sending, so a retry — by
   * you, or by a `client` configured with the SDK's backoff — replays the
   * same ids and can never bill twice. The ids come back in `eventIds`.
   */
  async ingest(events: IngestionEvent[]): Promise<IngestResult> {
    const result = await this.creem.events.ingestEvents({
      events: events.map((event) => toWireEvent(withEventId(event))),
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

  /**
   * Route a failure that happened outside the delivery engine (a throwing
   * resolver) to the configured `onError`. Internal to the package.
   * @internal
   */
  reportError(error: IngestionError): void {
    invokeHook(this.onError, error);
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
   *
   * The resolvers run inside the metered call (inside `generateText`, the
   * timed function, …). One that throws is reported via `onError` as
   * `resolver_failed` and the event is dropped; it never throws into the
   * caller's request path.
   */
  ingest(
    eventName: string,
    propertiesResolver?: PropertiesResolver,
  ): StrategyClientFactory<TClient> {
    const { pipeline, ingestionStrategy, costResolver } = this;
    return {
      client: (customer: IngestionCustomer): TClient =>
        ingestionStrategy.createClient(customer, (emission) => {
          const event: IngestionEvent = {
            name: eventName,
            ...customer,
            properties: { ...emission.properties, strategy: ingestionStrategy.strategyKind },
          };
          try {
            event.properties = {
              ...emission.properties,
              ...(propertiesResolver ? propertiesResolver(emission) : {}),
              strategy: ingestionStrategy.strategyKind,
            };
            if (costResolver) {
              event.properties._cost = costResolver(emission);
            }
          } catch (error) {
            pipeline.reportError({
              code: "resolver_failed",
              message: "A cost or properties resolver threw; the event was dropped.",
              events: [event],
              cause: error,
            });
            return;
          }
          pipeline.enqueue(event);
        }),
    };
  }
}
