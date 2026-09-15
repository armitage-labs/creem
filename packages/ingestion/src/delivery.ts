import { randomUUID } from "node:crypto";
import type { IngestResult, IngestionError, IngestionEvent, IngestWarnings } from "./types.js";

/** The wire shape the SDK's `events.ingestEvents` accepts per event. */
export interface WireEvent {
  name: string;
  customerId?: string;
  externalCustomerId?: string;
  eventId?: string;
  timestamp?: string;
  properties?: IngestionEvent["properties"];
}

export type SendBatch = (events: WireEvent[]) => Promise<IngestResult>;

export interface DeliveryOptions {
  maxBatchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  maxRetries: number;
  onError: (error: IngestionError) => void;
  onWarnings: (warnings: IngestWarnings) => void;
  /** Injectable for tests; defaults to a real setTimeout sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 30_000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const toWireEvent = (event: IngestionEvent): WireEvent => ({
  name: event.name,
  customerId: event.customerId,
  externalCustomerId: event.externalCustomerId,
  eventId: event.eventId,
  timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
  properties: event.properties,
});

/**
 * Extracts the batch index from a validation error's `param`
 * (`events[3].customer_id` → 3), or null when the error does not blame a
 * specific event. Duck-typed against the API error envelope rather than the
 * SDK's error classes so an SDK upgrade cannot silently break eviction.
 */
const rejectedEventIndex = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  const detail = (error as { error?: { param?: string | null } }).error;
  const match = detail?.param?.match(/^events\[(\d+)\]/);
  return match ? Number(match[1]) : null;
};

/** HTTP status of an SDK error, when one is attached. */
const errorStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { httpMeta?: { response?: { status?: number } } }).httpMeta?.response
    ?.status;
  if (typeof status === "number") return status;
  const direct = (error as { statusCode?: number }).statusCode;
  return typeof direct === "number" ? direct : null;
};

/**
 * A 4xx (except 408/429) will fail the same way on every retry; everything
 * else — network failures, 5xx, 429 — is worth retrying.
 */
const isRetryable = (error: unknown): boolean => {
  const status = errorStatus(error);
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
};

/**
 * The buffered, non-blocking delivery engine.
 *
 * Guarantees:
 * - `enqueue` never throws and never awaits the network.
 * - Every event gets an `eventId` at enqueue time, so retries replay the
 *   same ids and the server's `(store, event_id)` dedup collapses them —
 *   a retry can never double-bill.
 * - A batch the server rejects for ONE invalid event is not lost: the
 *   offending event is evicted (reported via `onError`) and the remainder
 *   is retried.
 * - The flush timer is `unref`'d in Node, so an idle buffer never holds the
 *   process open. Serverless callers `await flush()` before returning.
 */
export class BufferedDelivery {
  private queue: IngestionEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly send: SendBatch,
    private readonly options: DeliveryOptions,
  ) {}

  get pending(): number {
    return this.queue.length;
  }

  enqueue(event: IngestionEvent): void {
    if (this.closed) {
      this.options.onError({
        code: "delivery_failed",
        message: "Ingestion pipeline is closed; event dropped.",
        events: [event],
      });
      return;
    }
    if (this.queue.length >= this.options.maxQueueSize) {
      this.options.onError({
        code: "queue_overflow",
        message: `Ingestion queue is full (maxQueueSize=${this.options.maxQueueSize}); newest event dropped.`,
        events: [event],
      });
      return;
    }
    this.queue.push({ ...event, eventId: event.eventId ?? randomUUID() });
    if (this.queue.length >= this.options.maxBatchSize) {
      void this.flush();
    } else {
      this.armTimer();
    }
  }

  /**
   * Drains everything currently queued (and anything already in flight).
   * Safe to call concurrently; flushes serialize. Never rejects.
   */
  flush(): Promise<void> {
    this.disarmTimer();
    this.inFlight = this.inFlight.then(() => this.drain());
    return this.inFlight;
  }

  /** Flush, then refuse further events. */
  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
  }

  private armTimer(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.flushIntervalMs);
    // Node returns a Timeout object; browsers and edge runtimes return a
    // number. An idle buffer must never hold a Node process open.
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  private disarmTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.options.maxBatchSize);
      await this.deliverBatch(batch);
    }
  }

  private async deliverBatch(batch: IngestionEvent[]): Promise<void> {
    const remaining = batch;
    let attempt = 0;
    const sleep = this.options.sleep ?? defaultSleep;

    while (remaining.length > 0) {
      try {
        const result = await this.send(remaining.map(toWireEvent));
        if (result.warnings && result.warnings.length > 0) {
          this.options.onWarnings(result.warnings);
        }
        return;
      } catch (error) {
        // Validation is all-or-nothing server-side: one bad event 422s the
        // whole batch, and the error names it (`events[3].field`). Evict the
        // named event and retry the rest — eviction is progress, so it does
        // not consume a retry attempt and terminates within batch length.
        const rejected = rejectedEventIndex(error);
        if (rejected !== null && rejected < remaining.length) {
          const [evicted] = remaining.splice(rejected, 1);
          this.options.onError({
            code: "event_rejected",
            message: `Server rejected event at batch index ${rejected}; the rest of the batch was retried without it.`,
            events: [evicted],
            cause: error,
          });
          continue;
        }
        if (!isRetryable(error) || attempt >= this.options.maxRetries) {
          this.options.onError({
            code: "delivery_failed",
            message:
              attempt >= this.options.maxRetries
                ? `Batch dropped after ${attempt + 1} delivery attempts.`
                : "Batch dropped on a non-retryable API error.",
            events: remaining,
            cause: error,
          });
          return;
        }
        const backoff = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
        await sleep(backoff + Math.floor(Math.random() * (backoff / 2)));
        attempt += 1;
      }
    }
  }
}
