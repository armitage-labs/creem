# Checkouts

## Overview

### Available Operations

* [retrieve](#retrieve) - Retrieve a checkout session.
* [create](#create) - Creates a new checkout session.

## retrieve

Retrieve details of a checkout session by ID. View status, customer info, and payment details.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="retrieveCheckout" method="get" path="/v1/checkouts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.checkouts.retrieve("chk_1234567890");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { checkoutsRetrieve } from "creem/funcs/checkoutsRetrieve.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await checkoutsRetrieve(creem, "chk_1234567890");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("checkoutsRetrieve failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checkoutId`                                                                                                                                                                   | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | The ID of the checkout session to retrieve.                                                                                                                                    | chk_1234567890                                                                                                                                                                 |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[components.CheckoutEntity](../../models/components/checkoutentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## create

Create a new checkout session to accept one-time payments or start subscriptions. Returns a checkout URL to redirect customers.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createCheckout" method="post" path="/v1/checkouts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.checkouts.create({
    productId: "prod_1234567890",
    units: 1,
    discountCode: "SUMMER2024",
    customer: {
      id: "cust_1234567890",
      email: "user@example.com",
    },
    customFields: [
      {
        type: "text",
        key: "companyName",
        label: "Company Name",
        text: {
          maxLength: 200,
          minLength: 1,
        },
        checkbox: {
          label: "I agree to the [terms and conditions](https://example.com/terms)",
        },
      },
    ],
    metadata: {
      "userId": "user_123",
      "visitCount": 42,
      "lastVisit": "2023-04-01",
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
import { checkoutsCreate } from "creem/funcs/checkoutsCreate.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await checkoutsCreate(creem, {
    productId: "prod_1234567890",
    units: 1,
    discountCode: "SUMMER2024",
    customer: {
      id: "cust_1234567890",
      email: "user@example.com",
    },
    customFields: [
      {
        type: "text",
        key: "companyName",
        label: "Company Name",
        text: {
          maxLength: 200,
          minLength: 1,
        },
        checkbox: {
          label: "I agree to the [terms and conditions](https://example.com/terms)",
        },
      },
    ],
    metadata: {
      "userId": "user_123",
      "visitCount": 42,
      "lastVisit": "2023-04-01",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("checkoutsCreate failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CreateCheckoutRequest](../../models/components/createcheckoutrequest.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.CheckoutEntity](../../models/components/checkoutentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |