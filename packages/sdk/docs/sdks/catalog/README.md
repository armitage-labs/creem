# Catalog

## Overview

### Available Operations

* [validate](#validate) - Validate a batch of catalog writes together, without writing anything.
* [promote](#promote) - Promote the test catalog to live (meters and products).

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

## promote

Copies the store’s test catalog into live by `external_id`: each selected test item is matched to the live item with the same key and written as that kind’s keyed upsert (`POST /v1/meters`, `POST /v1/products`); a keyed test item without a live match is created with its key. Test is the source for every field it sets; promote never clears a `metadata` key only live has (`conflict`), and live items without a test counterpart are not listed and never touched. A test item without a key is `needs_key`, with ranked `candidates` and a `proposed_external_id`: give both sides the same key, then promote again. Archived test items are included only when live has an item with the same key, and a paired meter’s archive state follows test’s.

Every item reports one `result`; the real run writes only `created`, `updated` and `unchanged` items. Before its first write the real run checks every write together in one rolled-back transaction (one dependency layer at a time above the batch limit) and writes nothing when one fails, unless `force` is `true`. The check runs within the time budget too: until it is done a page has no items and a `next_cursor`, and `validation.checked_batches` says how far it got. Then the run writes only what it checked: an item changed after the check is `not_written` (`changed_since_check`). Items run meters first, then products, then the meters test archived (a meter's archive is part of its own write, after the products that may stop pricing it), and pages end after a time budget: follow `next_cursor` with the same `select` and `dry_run` until it is null. Every run and item is recorded under `run_id`, dry runs included.

Requires `products:write` and `meters:write` when meters are promoted. Answers `503` `test_environment_unavailable` when the test environment can’t be reached; try again later.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="promoteCatalog" method="post" path="/v1/catalog/promote" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.catalog.promote({
    catalogPromoteRequestDto: {},
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { catalogPromote } from "creem/funcs/catalogPromote.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await catalogPromote(creem, {
    catalogPromoteRequestDto: {},
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("catalogPromote failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.PromoteCatalogRequest](../../models/operations/promotecatalogrequest.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.CatalogPromoteResponseDto](../../models/components/catalogpromoteresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |