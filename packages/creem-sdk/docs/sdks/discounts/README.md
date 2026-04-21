# Discounts

## Overview

### Available Operations

* [searchDiscounts](#searchdiscounts) - Search discounts
* [get](#get) - Retrieve discount
* [create](#create) - Create a discount.
* [delete](#delete) - Delete a discount.

## searchDiscounts

Search and list discount codes for a store with filters and pagination.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="searchDiscounts" method="get" path="/v1/discounts/search" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.discounts.searchDiscounts(1, 10, "prod_1234567890", undefined, undefined, "2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { discountsSearchDiscounts } from "creem/funcs/discountsSearchDiscounts.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await discountsSearchDiscounts(creem, 1, 10, "prod_1234567890", undefined, undefined, "2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("discountsSearchDiscounts failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pageNumber`                                                                                                                                                                   | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The page number for pagination.                                                                                                                                                | 1                                                                                                                                                                              |
| `pageSize`                                                                                                                                                                     | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The number of items per page.                                                                                                                                                  | 10                                                                                                                                                                             |
| `productId`                                                                                                                                                                    | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Filter discounts that apply to a specific product.                                                                                                                             | prod_1234567890                                                                                                                                                                |
| `status`                                                                                                                                                                       | [operations.Status](../../models/operations/status.md)                                                                                                                         | :heavy_minus_sign:                                                                                                                                                             | Filter by discount status.                                                                                                                                                     |                                                                                                                                                                                |
| `type`                                                                                                                                                                         | [operations.Type](../../models/operations/type.md)                                                                                                                             | :heavy_minus_sign:                                                                                                                                                             | Filter by discount type.                                                                                                                                                       |                                                                                                                                                                                |
| `createdAfter`                                                                                                                                                                 | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Filter discounts created after this date.                                                                                                                                      | 2024-01-01T00:00:00Z                                                                                                                                                           |
| `createdBefore`                                                                                                                                                                | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Filter discounts created before this date.                                                                                                                                     | 2024-12-31T23:59:59Z                                                                                                                                                           |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[components.DiscountListEntity](../../models/components/discountlistentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## get

Retrieve discount code details by ID or code. Check usage limits, expiration, and discount amount.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="retrieveDiscount" method="get" path="/v1/discounts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.discounts.get("disc_1234567890", "SAVE20");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { discountsGet } from "creem/funcs/discountsGet.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await discountsGet(creem, "disc_1234567890", "SAVE20");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("discountsGet failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `discountId`                                                                                                                                                                   | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The unique identifier of the discount (provide either discount_id OR discount_code).                                                                                           | disc_1234567890                                                                                                                                                                |
| `discountCode`                                                                                                                                                                 | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The unique discount code (provide either discount_id OR discount_code).                                                                                                        | SAVE20                                                                                                                                                                         |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[components.DiscountEntity](../../models/components/discountentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## create

Create promotional discount codes for products. Set percentage or fixed amount discounts with expiration dates.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createDiscount" method="post" path="/v1/discounts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.discounts.create({
    name: "Holiday Sale",
    code: "HOLIDAY2024",
    type: "percentage",
    amount: 20,
    currency: "USD",
    percentage: 15,
    expiryDate: new Date("2024-12-31T23:59:59Z"),
    maxRedemptions: 100,
    duration: "repeating",
    durationInMonths: 6,
    appliesToProducts: [
      "prod_123",
      "prod_456",
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
import { discountsCreate } from "creem/funcs/discountsCreate.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await discountsCreate(creem, {
    name: "Holiday Sale",
    code: "HOLIDAY2024",
    type: "percentage",
    amount: 20,
    currency: "USD",
    percentage: 15,
    expiryDate: new Date("2024-12-31T23:59:59Z"),
    maxRedemptions: 100,
    duration: "repeating",
    durationInMonths: 6,
    appliesToProducts: [
      "prod_123",
      "prod_456",
    ],
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("discountsCreate failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CreateDiscountRequestEntity](../../models/components/creatediscountrequestentity.md)                                                                               | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.DiscountEntity](../../models/components/discountentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## delete

Permanently delete a discount code. Prevent further usage of the discount.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="deleteDiscount" method="delete" path="/v1/discounts/{id}/delete" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.discounts.delete("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { discountsDelete } from "creem/funcs/discountsDelete.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await discountsDelete(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("discountsDelete failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | The unique identifier of the discount to delete                                                                                                                                |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.DiscountEntity](../../models/components/discountentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |