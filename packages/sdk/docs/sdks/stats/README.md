# Stats

## Overview

### Available Operations

* [getSummary](#getsummary) - Get store metrics summary

## getSummary

Retrieve aggregated store metrics including counts, revenue, and MRR. When startDate and endDate are provided, totals are filtered to that date range. When interval is also provided, the response includes a periods array with time-series data points grouped by that interval. The periods array starts from the store's first transaction or startDate, whichever is later, to avoid empty leading buckets. All monetary amounts are in cents (integer, no decimals).

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getMetricsSummary" method="get" path="/v1/stats/summary" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.stats.getSummary("USD");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { statsGetSummary } from "creem/funcs/statsGetSummary.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await statsGetSummary(creem, "USD");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("statsGetSummary failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                        | Type                                                                                                                                                                             | Required                                                                                                                                                                         | Description                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currency`                                                                                                                                                                       | [operations.Currency](../../models/operations/currency.md)                                                                                                                       | :heavy_check_mark:                                                                                                                                                               | N/A                                                                                                                                                                              |
| `startDate`                                                                                                                                                                      | *number*                                                                                                                                                                         | :heavy_minus_sign:                                                                                                                                                               | Start of the date range as a Unix timestamp in milliseconds (e.g. 1740614400000). When provided with endDate, filters totals to this range. Required when interval is specified. |
| `endDate`                                                                                                                                                                        | *number*                                                                                                                                                                         | :heavy_minus_sign:                                                                                                                                                               | End of the date range as a Unix timestamp in milliseconds (e.g. 1772150400000). When provided with startDate, filters totals to this range. Required when interval is specified. |
| `interval`                                                                                                                                                                       | [operations.Interval](../../models/operations/interval.md)                                                                                                                       | :heavy_minus_sign:                                                                                                                                                               | Groups time-series data into buckets of this size. Requires startDate and endDate. Returns a periods array with one entry per bucket containing grossRevenue and netRevenue.     |
| `options`                                                                                                                                                                        | RequestOptions                                                                                                                                                                   | :heavy_minus_sign:                                                                                                                                                               | Used to set various options for making HTTP requests.                                                                                                                            |
| `options.fetchOptions`                                                                                                                                                           | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                          | :heavy_minus_sign:                                                                                                                                                               | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed.   |
| `options.retries`                                                                                                                                                                | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                    | :heavy_minus_sign:                                                                                                                                                               | Enables retrying HTTP requests under certain failure conditions.                                                                                                                 |

### Response

**Promise\<[components.StatsSummaryEntity](../../models/components/statssummaryentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |