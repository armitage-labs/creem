import type { Creem } from "creem";

/** JSON-serializable value — the only thing an event property may hold. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * The event's ONE attribute bag. Meter filter clauses and aggregation
 * properties resolve their keys here, unprefixed. Server limits: at most 50
 * keys, keys at most 40 characters, string and serialized-object values at
 * most 500 characters. Keys starting with `_` (e.g. `_cost`, `_llm`) are
 * reserved for SDK-written values.
 */
export type EventProperties = Record<string, JsonValue>;

/**
 * Exactly one way to say who used it:
 * - `customerId` — the Creem customer id (must exist for your store)
 * - `externalCustomerId` — your own id, resolved via the customer's
 *   registered `external_id`
 */
export type IngestionCustomer =
  | { customerId: string; externalCustomerId?: never }
  | { externalCustomerId: string; customerId?: never };

/** One usage event, as your application sees it. */
export type IngestionEvent = IngestionCustomer & {
  /** The event name a meter consumes. */
  name: string;
  /**
   * Your idempotency key, unique per store. The buffered pipeline generates
   * one at enqueue time when absent, which is what makes its retries safe.
   */
  eventId?: string;
  /** When the usage occurred, on your clock. Defaults to ingestion time. */
  timestamp?: Date | string;
  properties?: EventProperties;
};

/** The server's 202 envelope, as returned by the underlying SDK. */
export type IngestResult = Awaited<ReturnType<Creem["events"]["ingestEvents"]>>;

/** Advisory warnings attached to an accepted batch. */
export type IngestWarnings = NonNullable<IngestResult["warnings"]>;

/**
 * Why a delivery-side failure was reported. Failures are reported, never
 * thrown — ingestion must not be able to fail the caller's request path.
 */
export type IngestionErrorCode =
  /** A batch was dropped after exhausting retries, or on a terminal API error. */
  | "delivery_failed"
  /** The server rejected specific events as invalid; the rest of their batch was retried without them. */
  | "event_rejected"
  /** The in-memory queue hit `maxQueueSize`; the newest event was dropped. */
  | "queue_overflow"
  /** A `.cost()` or properties resolver threw inside a metered call; the event was dropped. */
  | "resolver_failed";

export interface IngestionError {
  code: IngestionErrorCode;
  message: string;
  /** The events affected — dropped, rejected, or overflowed. */
  events: IngestionEvent[];
  /** The underlying error, when one exists. */
  cause?: unknown;
}

export interface IngestionConfig {
  /** Creem API key with the `events:write` scope. */
  apiKey?: string;
  /** Override the API host (e.g. `https://test-api.creem.io` for test mode). */
  serverURL?: string;
  /**
   * Bring your own configured SDK client instead of `apiKey`/`serverURL`.
   * Takes precedence when provided.
   */
  client?: Creem;
  /** Events per request. Server maximum (and default): 100. */
  maxBatchSize?: number;
  /** How long an idle buffer waits before flushing. Default: 5000ms. */
  flushIntervalMs?: number;
  /**
   * Upper bound on buffered events. Beyond it the NEWEST event is dropped
   * and reported via `onError` (`queue_overflow`) — the oldest events are
   * kept because they are the closest to the server's late-event window.
   * Default: 10,000.
   */
  maxQueueSize?: number;
  /**
   * Retries per batch after the first attempt, so the default of 5 allows up
   * to 6 deliveries before the batch is dropped. Backoff doubles from 500ms,
   * capped at 30s.
   */
  maxRetries?: number;
  /**
   * Every delivery-side failure lands here. Never thrown. If the hook itself
   * throws, the error is swallowed — a failing logger cannot break delivery.
   */
  onError?: (error: IngestionError) => void;
  /**
   * Advisory 202 warnings (`no_matching_meter`, `meter_archived`,
   * `timestamp_outside_late_window`) — the events were accepted but will not
   * produce billable usage as sent.
   */
  onWarnings?: (warnings: IngestWarnings) => void;
}
