# @creem_io/ingestion

Usage ingestion toolkit for [Creem](https://creem.io) — buffered, retry-safe,
non-blocking delivery of usage events, with a pluggable strategy layer for
automatic metering (LLM calls, streams, timed executions).

```bash
npm install @creem_io/ingestion
```

## Why not just call the API?

You can — `creem.events.ingestEvents()` works. This package exists for the
delivery guarantees your request path needs:

- **Never blocks, never throws.** `enqueue()` buffers in memory and returns
  immediately. Delivery failures surface via an `onError` hook, not as
  exceptions inside your user's request.
- **Retry-safe by construction.** Every event gets an `event_id` at enqueue
  time; retries resend the same ids and Creem's `(store, event_id)` dedup
  collapses them — a retried batch can never double-bill.
- **Batched.** Events flush when a batch fills (100, the server cap) or on an
  interval, not one HTTP call per event.
- **Poison-pill eviction.** Creem validates batches all-or-nothing. When the
  server rejects one invalid event, the pipeline evicts exactly that event
  (reported via `onError`) and delivers the rest — one bad event can't take
  99 good ones down with it.
- **Serverless-aware.** `await flush()` before your handler returns (or hand
  it to `waitUntil`). The idle flush timer is `unref`'d, so it never holds a
  Node process open.

## Buffered ingestion

```ts
import { Ingestion } from "@creem_io/ingestion";

const ingestion = Ingestion({
  apiKey: process.env.CREEM_API_KEY!,
  onError: (error) => console.error("[creem]", error.code, error.message),
  onWarnings: (warnings) => console.warn("[creem]", warnings),
});

// In your request handler — synchronous, cannot fail the request:
ingestion.enqueue({
  name: "tokens_used",
  externalCustomerId: userId, // or { customerId: "cust_..." }
  properties: { tokens: 512, model: "gpt-4o" },
});

// Serverless teardown / graceful shutdown:
await ingestion.flush();
```

Each event names its customer **exactly one** way: `customerId` (the Creem
id) or `externalCustomerId` (your own id, registered as `external_id` on the
customers API).

## Direct ingestion

When you want the response (and are prepared to handle errors yourself):

```ts
const result = await ingestion.ingest([
  { name: "tokens_used", customerId: "cust_abc", properties: { tokens: 512 } },
]);
// { accepted: 1, eventIds: ["..."], warnings?: [...] }
```

Events without an `eventId` get one before sending, so retrying the call —
yourself, or through a `client` configured with the SDK's backoff — replays
the same ids and cannot bill twice.

`warnings` tells you when an accepted event will not produce billable usage —
no meter listens to the event name, only archived meters match, or the
timestamp falls in a finalized billing period.

## Strategies

Strategies wrap a client you already use and meter it automatically. The
chain binds a strategy to an event name; `client(customer)` returns a fresh
wrapped client per customer (strategies are stateless — one instance serves
concurrent customers safely):

```ts
const metered = ingestion
  .strategy(new SomeStrategy(/* ... */))
  .cost((emission) => Number(emission.properties.tokens) * 0.000002)
  .ingest("llm-usage");

const client = metered.client({ externalCustomerId: userId });
// use `client` normally — every call enqueues a usage event
```

Emitted events carry the strategy's raw measurements in `properties`, plus
the reserved keys the SDK owns: `strategy` (the capture mechanism) and
`_cost` (when a `.cost()` resolver is attached). Keys starting with `_` are
reserved for SDK-written values.

Resolvers run inside the metered call. If one throws, the event is dropped
and reported via `onError` as `resolver_failed` — it never throws into the
call you are metering.

### Vercel AI SDK

Wrap a language model once and every `generateText` / `streamText` call is
metered — token counts, model, and vendor, with no per-call code. Imported
from the `/ai-sdk` subpath so its types only load when you use it (AI SDK 6+
/ `LanguageModelV3`+`V4`):

```ts
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { AiSdkStrategy } from "@creem_io/ingestion/ai-sdk";

const metered = ingestion
  .strategy(new AiSdkStrategy(openai("gpt-4o")))
  .ingest("llm-usage");

const model = metered.client({ externalCustomerId: userId });
const result = await generateText({ model, prompt });
// → event: { input_tokens, output_tokens, cached_input_tokens,
//            total_tokens, model, vendor, _llm, strategy }
```

Streaming is metered from the stream's `finish` part as it passes through —
consuming the stream once is enough, nothing is buffered or double-read. A
stream cancelled before its `finish` part bills nothing.

### Timed execution

The cheapest strategy: time a unit of work, bill the duration. Only
successful executions emit — a throwing execution propagates its error and
bills nothing:

```ts
import { DeltaTimeStrategy } from "@creem_io/ingestion";

const metered = ingestion
  .strategy(new DeltaTimeStrategy())
  .ingest("compute-time");

const timed = metered.client({ customerId });
const output = await timed(() => renderVideo(input));
// → event: { delta_time_ms, strategy }
```

Further strategies (raw LLM provider clients, streams/bytes,
OpenTelemetry) build on the same `IngestionStrategy` base class exported
here.

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `apiKey` | — | Creem API key with the `events:write` scope |
| `serverURL` | production | e.g. `https://test-api.creem.io` for test mode |
| `client` | — | bring your own configured `Creem` SDK instance |
| `maxBatchSize` | `100` | events per request (server cap) |
| `flushIntervalMs` | `5000` | idle time before a partial batch flushes |
| `maxQueueSize` | `10000` | buffer bound; overflow drops the newest event via `onError` |
| `maxRetries` | `5` | retries per batch after the first attempt (up to 6 deliveries; backoff capped at 30s) |
| `onError` | — | every delivery-side failure; never thrown, and a throwing hook is swallowed |
| `onWarnings` | — | advisory 202 warnings |
