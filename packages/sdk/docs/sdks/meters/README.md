# Meters

## Overview

### Available Operations

* [createMeter](#createmeter) - Create a meter
* [listMeters](#listmeters) - List meters
* [previewMeter](#previewmeter) - Preview an unsaved meter definition
* [getMeter](#getmeter) - Retrieve a meter
* [updateMeter](#updatemeter) - Update a meter
* [previewExistingMeter](#previewexistingmeter) - Preview an existing meter
* [getConsumedUnits](#getconsumedunits) - Get consumed units for a customer
* [archiveMeter](#archivemeter) - Archive a meter
* [unarchiveMeter](#unarchivemeter) - Unarchive a meter

## createMeter

Define how a stream of usage events is aggregated into billable units. The unit label doubles as the display unit and as the credit bucket the meter settles into. A duplicate name within the store is rejected with 409 meter_name_taken.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createMeter" method="post" path="/v1/meters" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.createMeter({
    name: "Image generations",
    eventName: "image.generated",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
    unitLabel: "images",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersCreateMeter } from "creem/funcs/metersCreateMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersCreateMeter(creem, {
    name: "Image generations",
    eventName: "image.generated",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
    unitLabel: "images",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersCreateMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CreateMeterApiRequestDto](../../models/components/createmeterapirequestdto.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)\>**

### Errors

| Error Type                              | Status Code                             | Content Type                            |
| --------------------------------------- | --------------------------------------- | --------------------------------------- |
| errors.UsageMeteringErrorApiResponseDto | 409, 422                                | application/json                        |
| errors.APIError                         | 4XX, 5XX                                | \*/\*                                   |

## listMeters

List your meters, newest first, as a cursor page. Archived meters are hidden unless include_archived=true.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listMeters" method="get" path="/v1/meters" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.listMeters(10, "mtr_abc123", "mtr_abc123");

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
import { metersListMeters } from "creem/funcs/metersListMeters.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersListMeters(creem, 10, "mtr_abc123", "mtr_abc123");
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("metersListMeters failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `limit`                                                                                                                                                                        | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Maximum number of meters to return                                                                                                                                             |                                                                                                                                                                                |
| `startingAfter`                                                                                                                                                                | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for forward pagination — meter ID to start after                                                                                                                        | mtr_abc123                                                                                                                                                                     |
| `endingBefore`                                                                                                                                                                 | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for backward pagination — meter ID to end before                                                                                                                        | mtr_abc123                                                                                                                                                                     |
| `includeArchived`                                                                                                                                                              | *boolean*                                                                                                                                                                      | :heavy_minus_sign:                                                                                                                                                             | Include archived meters in the page. Defaults to false — archived meters are hidden.                                                                                           |                                                                                                                                                                                |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[operations.ListMetersResponse](../../models/operations/listmetersresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## previewMeter

Dry-run a candidate meter definition against your real usage over the last 7 whole UTC days (today included, future-dated events excluded) WITHOUT creating anything: matched events, aggregated units, distinct customers, and a zero-filled per-day series, oldest first. Useful for checking a definition before committing to it. The scan is capped defensively and runs newest-first, so a very high-volume store gets the most recent slice of the window rather than an unbounded scan — the recent days stay complete and the oldest day of the series degrades.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="previewMeter" method="post" path="/v1/meters/preview" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.previewMeter({
    eventName: "image.generated",
    aggregation: "count",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
    unitLabel: "images",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersPreviewMeter } from "creem/funcs/metersPreviewMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersPreviewMeter(creem, {
    eventName: "image.generated",
    aggregation: "count",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
    unitLabel: "images",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersPreviewMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.PreviewMeterApiRequestDto](../../models/components/previewmeterapirequestdto.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterPreviewApiResponseDto](../../models/components/meterpreviewapiresponsedto.md)\>**

### Errors

| Error Type                              | Status Code                             | Content Type                            |
| --------------------------------------- | --------------------------------------- | --------------------------------------- |
| errors.UsageMeteringErrorApiResponseDto | 422                                     | application/json                        |
| errors.APIError                         | 4XX, 5XX                                | \*/\*                                   |

## getMeter

Get one meter by ID. Archived meters ARE returned here — a fetch by explicit ID is an intentional lookup.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getMeter" method="get" path="/v1/meters/{id}" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.getMeter("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersGetMeter } from "creem/funcs/metersGetMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersGetMeter(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersGetMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## updateMeter

Rename a meter and/or revise its definition. A rename is always allowed — the name is a label no aggregate depends on — but it must stay unique within the store (409 meter_name_taken). Definition changes (filter, aggregation, aggregation_property) are only accepted while the meter has processed no usage and has no associated purchase; otherwise the request is rejected with 409, because editing the definition would silently rewrite what already-recorded usage means. Send aggregation_property as null to clear it; omit it to leave it unchanged.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="updateMeter" method="patch" path="/v1/meters/{id}" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.updateMeter("<id>", {
    name: "Image generations (v2)",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersUpdateMeter } from "creem/funcs/metersUpdateMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersUpdateMeter(creem, "<id>", {
    name: "Image generations (v2)",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [
        {
          property: "tier",
          operator: "equals",
          value: "pro",
        },
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersUpdateMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `updateMeterApiRequestDto`                                                                                                                                                     | [components.UpdateMeterApiRequestDto](../../models/components/updatemeterapirequestdto.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)\>**

### Errors

| Error Type                              | Status Code                             | Content Type                            |
| --------------------------------------- | --------------------------------------- | --------------------------------------- |
| errors.UsageMeteringErrorApiResponseDto | 409, 422                                | application/json                        |
| errors.APIError                         | 4XX, 5XX                                | \*/\*                                   |

## previewExistingMeter

Dry-run an existing meter against your real usage over the last 7 whole UTC days (today included, future-dated events excluded). Same shape as the unsaved-definition preview; nothing is written.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="previewExistingMeter" method="post" path="/v1/meters/{id}/preview" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.previewExistingMeter("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersPreviewExistingMeter } from "creem/funcs/metersPreviewExistingMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersPreviewExistingMeter(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersPreviewExistingMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterPreviewApiResponseDto](../../models/components/meterpreviewapiresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## getConsumedUnits

How many units a customer has consumed through this meter in a billing period, alongside the period's boundaries. Without `at`, this is an O(1) read of the current period's projection — the number billing uses. With `at`, the units are replayed from the raw events as of that instant, within the billing period containing it, which is the right call for reconstructing what a customer had consumed at a past moment (an invoice date, a support question).

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getMeterConsumedUnits" method="get" path="/v1/meters/{id}/consumed" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.getConsumedUnits("<id>", "cust_abc123", "2026-08-15T00:00:00.000Z");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersGetConsumedUnits } from "creem/funcs/metersGetConsumedUnits.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersGetConsumedUnits(creem, "<id>", "cust_abc123", "2026-08-15T00:00:00.000Z");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersGetConsumedUnits failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                                                                    | Type                                                                                                                                                                                                                         | Required                                                                                                                                                                                                                     | Description                                                                                                                                                                                                                  | Example                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                                                                                                                                         | *string*                                                                                                                                                                                                                     | :heavy_check_mark:                                                                                                                                                                                                           | N/A                                                                                                                                                                                                                          |                                                                                                                                                                                                                              |
| `customerId`                                                                                                                                                                                                                 | *string*                                                                                                                                                                                                                     | :heavy_check_mark:                                                                                                                                                                                                           | The customer whose consumption is read                                                                                                                                                                                       | cust_abc123                                                                                                                                                                                                                  |
| `at`                                                                                                                                                                                                                         | *string*                                                                                                                                                                                                                     | :heavy_minus_sign:                                                                                                                                                                                                           | ISO 8601 instant. When present, the consumption is replayed from the raw events as of that point in time, within the billing period that contains it. When absent, the current billing period’s projected total is returned. | 2026-08-15T00:00:00.000Z                                                                                                                                                                                                     |
| `options`                                                                                                                                                                                                                    | RequestOptions                                                                                                                                                                                                               | :heavy_minus_sign:                                                                                                                                                                                                           | Used to set various options for making HTTP requests.                                                                                                                                                                        |                                                                                                                                                                                                                              |
| `options.fetchOptions`                                                                                                                                                                                                       | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                                                                      | :heavy_minus_sign:                                                                                                                                                                                                           | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed.                                               |                                                                                                                                                                                                                              |
| `options.retries`                                                                                                                                                                                                            | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                                                                | :heavy_minus_sign:                                                                                                                                                                                                           | Enables retrying HTTP requests under certain failure conditions.                                                                                                                                                             |                                                                                                                                                                                                                              |

### Response

**Promise\<[components.MeterConsumedUnitsApiResponseDto](../../models/components/meterconsumedunitsapiresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## archiveMeter

Archive a meter: it leaves the default listing and stops accruing new usage, but is never deleted, so the usage it already recorded stays meaningful. Idempotent — archiving an archived meter returns it unchanged.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="archiveMeter" method="post" path="/v1/meters/{id}/archive" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.archiveMeter("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersArchiveMeter } from "creem/funcs/metersArchiveMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersArchiveMeter(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersArchiveMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)\>**

### Errors

| Error Type                              | Status Code                             | Content Type                            |
| --------------------------------------- | --------------------------------------- | --------------------------------------- |
| errors.UsageMeteringErrorApiResponseDto | 409                                     | application/json                        |
| errors.APIError                         | 4XX, 5XX                                | \*/\*                                   |

## unarchiveMeter

Restore an archived meter: it returns to the default listing and resumes accruing usage from the next matching event. Idempotent — unarchiving an active meter returns it unchanged. No gate applies and none is needed: archiving never released the meter's name, because per-store name uniqueness counts archived meters (which is why creating a meter with an archived meter's name returns 409 `meter_name_taken` with `details.archived_holder`), and it never altered the definition. Usage ingested while the meter was archived is retained as raw events and IS folded back in for any period still inside the late-event window, since a period is recomputed in full rather than incrementally — so units for an open period can increase by more than the usage seen since the unarchive. Finalized periods are not moved.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="unarchiveMeter" method="post" path="/v1/meters/{id}/unarchive" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.meters.unarchiveMeter("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { metersUnarchiveMeter } from "creem/funcs/metersUnarchiveMeter.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await metersUnarchiveMeter(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("metersUnarchiveMeter failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |