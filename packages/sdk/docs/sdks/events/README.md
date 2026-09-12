# Events

## Overview

### Available Operations

* [ingestEvents](#ingestevents) - Ingest usage events
* [listEvents](#listevents) - List usage events

## ingestEvents

Send up to 100 usage events in one request.

Returns **202 Accepted** with the number of events accepted and the `event_id` of each, in submission order — your own value where you supplied one, a generated value where you did not.

Ingestion is **idempotent on (store, event_id)**: re-sending an event_id this store has already accepted records nothing and is not an error, so **retrying a whole batch after a timeout or a partial failure is always safe**. Duplicates are deduplicated silently rather than reported — a replayed batch returns the same 202 and the same `event_ids` as the original. Supply your own `event_id` to get that guarantee; when you omit it we generate one, which makes the event unique and a retry a second event.

Your `event_id` is **stored trimmed**, and the `event_ids` we return are the stored values — so `" abc "` is recorded and echoed as `"abc"`, which is what `reference=` on `GET /v1/events` matches. Two entries in one batch whose ids differ only by surrounding whitespace are therefore the **same** event: the second is deduplicated against the first, both are reported accepted, and both carry the same id. An `event_id` that is entirely whitespace is rejected like an empty one (422) rather than being replaced with a generated id — an unusable key is worth telling you about.

The **whole batch is validated before anything is accepted**: if any event is invalid the request is rejected with 422 and `param` pointing at the offending event (e.g. `events[3].customer_id`), and no event in the batch is ingested.

Billing attribution uses the `timestamp` you supply (defaulting to the time of ingestion), bounded by the late-event window: once a billing period has been closed for longer than that window, an event arriving for it is still stored durably but is no longer folded into that period's totals.

**202, not 200, is deliberate.** It means the batch has been accepted for processing, not that every downstream effect has completed: aggregation into meter totals is already asynchronous today, and the transport behind this endpoint may become queue-backed. A queue producer cannot know how many rows a consumer will ultimately insert, so this response reports acceptance rather than an insert/duplicate split — the contract you code against stays identical when that lands.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="ingestUsageEvents" method="post" path="/v1/events/ingest" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.events.ingestEvents({
    events: [],
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { eventsIngestEvents } from "creem/funcs/eventsIngestEvents.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await eventsIngestEvents(creem, {
    events: [],
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("eventsIngestEvents failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.IngestUsageEventsApiRequestDto](../../models/components/ingestusageeventsapirequestdto.md)                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.IngestUsageEventsApiResponseDto](../../models/components/ingestusageeventsapiresponsedto.md)\>**

### Errors

| Error Type                              | Status Code                             | Content Type                            |
| --------------------------------------- | --------------------------------------- | --------------------------------------- |
| errors.UsageMeteringErrorApiResponseDto | 422                                     | application/json                        |
| errors.APIError                         | 4XX, 5XX                                | \*/\*                                   |

## listEvents

List the usage events your store has ingested, oldest first in ingestion order, as a forward cursor page. Filters compose: by meter (resolved to the meter's event name), by customer, and by `reference` (the `event_id` you supplied). Events are returned raw — a meter's filter clauses are not applied. Usage events are append-only, so pagination is forward-only and there is no `ending_before`.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listUsageEvents" method="get" path="/v1/events" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.events.listEvents("mtr_abc123", "cust_abc123", "order-1234", 10, "uev_abc123");

  for await (const page of result) {
    console.log(page);
  }
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { eventsListEvents } from "creem/funcs/eventsListEvents.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await eventsListEvents(creem, "mtr_abc123", "cust_abc123", "order-1234", 10, "uev_abc123");
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("eventsListEvents failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `meterId`                                                                                                                                                                      | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Only return events consumed by this meter (resolved to the meter’s event name)                                                                                                 | mtr_abc123                                                                                                                                                                     |
| `customerId`                                                                                                                                                                   | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Only return events for this customer                                                                                                                                           | cust_abc123                                                                                                                                                                    |
| `reference`                                                                                                                                                                    | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Only return the event carrying this `event_id`                                                                                                                                 | order-1234                                                                                                                                                                     |
| `limit`                                                                                                                                                                        | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Maximum number of events to return                                                                                                                                             |                                                                                                                                                                                |
| `startingAfter`                                                                                                                                                                | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for forward pagination — event ID to start after. Usage events are append-only and paginate forward only, so there is deliberately no `ending_before`.                  | uev_abc123                                                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[operations.ListUsageEventsResponse](../../models/operations/listusageeventsresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |