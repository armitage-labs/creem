# Catalog

## Overview

### Available Operations

* [validate](#validate) - Validate a batch of catalog writes together, without writing anything.

## validate

Runs every item as its own write would run with `?dry_run=true`, but all of them in one database transaction that is always rolled back, so the batch is checked as a whole: an item may name a resource another item of the batch creates (a product's usage price naming a new meter by `meter_external_id`), and every check, uniqueness rule and guard runs against what the earlier items would have written. Items run in dependency order (meters, products, product groups, discounts) and are answered in the order of the request. Without `id` an item runs as the keyed upsert of its kind (`POST /v1/products`, `POST /v1/meters`) with the same body; with `id` it runs as that resource's `PATCH` with `PATCH`'s rules, which is meant for a migrator adopting an existing resource (giving it an `external_id`). Requires `products:write` and the write scope of every kind in the batch (`meters:write` for meters). Nothing is written and nothing is triggered. A batch that passes can still fail when it is applied, if the catalog changes in between; validate it again right before applying it.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="validateCatalog" method="post" path="/v1/catalog/validate" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.catalog.validate({
    items: [
      {
        kind: "product",
        body: {
          "key": "<value>",
        },
      },
    ],
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { catalogValidate } from "creem/funcs/catalogValidate.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await catalogValidate(creem, {
    items: [
      {
        kind: "product",
        body: {
          "key": "<value>",
        },
      },
    ],
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("catalogValidate failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CatalogValidateRequestDto](../../models/components/catalogvalidaterequestdto.md)                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.CatalogValidationResponseDto](../../models/components/catalogvalidationresponsedto.md)\>**

### Errors

| Error Type                          | Status Code                         | Content Type                        |
| ----------------------------------- | ----------------------------------- | ----------------------------------- |
| errors.CatalogValidationResponseDto | 422                                 | application/json                    |
| errors.APIError                     | 4XX, 5XX                            | \*/\*                               |