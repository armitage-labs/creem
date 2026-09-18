# @creem_io/ingestion

## 0.1.3

### Patch Changes

- 2b9f0a1: Harden the delivery guarantees and the package's `creem` dependency.
  - A throwing `onError`/`onWarnings` hook no longer rejects `flush()`, poisons
    every later flush, or surfaces as an unhandled rejection; hook failures are
    swallowed and delivery continues.
  - The direct `ingest()` path now assigns an `eventId` to events that lack
    one, so retrying the call (yours, or the SDK's configured backoff) replays
    the same ids and cannot bill twice.
  - A `.cost()` or properties resolver that throws is reported via `onError`
    as the new `resolver_failed` code instead of throwing into the metered call.
  - `creem` is depended on as a caret range (`^1.12.0`) rather than an exact
    pin, so a consumer's own SDK copy satisfies it and `IngestionConfig.client`
    typechecks against it; the SDK release cascade now keeps the range current.
  - `engines.node` is `>=22`, matching the optional `@ai-sdk/provider` peer.
  - `maxRetries` is documented as retries after the first attempt (default 5,
    up to 6 deliveries), which is what the pipeline always did.

## 0.1.2

### Patch Changes

- Updated dependencies [690edab]
  - creem@1.13.0

## 0.1.1

### Patch Changes

- Updated dependencies [b9d214c]
  - creem@1.12.0

## 0.1.0

### Minor Changes

- 434d6f4: Initial release of the Creem usage-ingestion toolkit.
  - `Ingestion({ apiKey })` pipeline with two paths: direct awaited
    `ingest(events)` and buffered `enqueue(event)` / `flush()` that never
    throws into or slows the caller's request path.
  - Buffered delivery: batching (size + interval), bounded queue, retry with
    backoff that replays the same `event_id`s (server dedup makes retries
    billing-safe), poison-pill eviction (a 422-rejected event is evicted and
    the rest of its batch delivered), `onError` / `onWarnings` hooks, and an
    `unref`'d flush timer for clean process exit.
  - Strategy layer: `strategy(s).cost(fn).ingest(name)` chain with the
    `IngestionStrategy` base class — stateless per customer, reserved
    `strategy` and `_cost` property keys written by the pipeline.
  - `AiSdkStrategy` (`@creem_io/ingestion/ai-sdk` subpath): wrap a Vercel AI
    SDK language model (`LanguageModelV3`/`V4`, AI SDK 6+) and every
    generate/stream call emits token counts, model, and vendor; stream usage
    is read from the `finish` part in passing, never buffered.
  - `DeltaTimeStrategy`: time an execution and bill the duration
    (`delta_time_ms`); failed executions bill nothing.
