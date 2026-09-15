---
"@creem_io/ingestion": minor
---

Initial release of the Creem usage-ingestion toolkit.

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
