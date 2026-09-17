---
"@creem_io/ingestion": patch
---

Harden the delivery guarantees and the package's `creem` dependency.

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
