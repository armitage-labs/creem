# CustomerCreditsAccountsExperimental

## Overview

### Available Operations

* [createCustomerCreditsAccount](#createcustomercreditsaccount) - Create a customer credits account
* [listCustomerCreditsAccounts](#listcustomercreditsaccounts) - List customer credits accounts
* [getCustomerCreditsAccount](#getcustomercreditsaccount) - Retrieve a customer credits account
* [getCustomerCreditsAccountBalance](#getcustomercreditsaccountbalance) - Get account balance
* [listCustomerCreditsAccountEntries](#listcustomercreditsaccountentries) - List account entries
* [freezeCustomerCreditsAccount](#freezecustomercreditsaccount) - Freeze an account
* [unfreezeCustomerCreditsAccount](#unfreezecustomercreditsaccount) - Unfreeze an account
* [creditCustomerCreditsAccount](#creditcustomercreditsaccount) - Credit an account
* [debitCustomerCreditsAccount](#debitcustomercreditsaccount) - Debit an account
* [reverseCustomerCreditsAccountTransaction](#reversecustomercreditsaccounttransaction) - Reverse a transaction
* [closeCustomerCreditsAccount](#closecustomercreditsaccount) - Close an account

## createCustomerCreditsAccount

Create a new credits account for a customer. Optionally seed it with an initial balance.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.createCustomerCreditsAccount({
    customerId: "cust_abc123",
    initialBalance: "300",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalCreateCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalCreateCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalCreateCustomerCreditsAccount(creem, {
    customerId: "cust_abc123",
    initialBalance: "300",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalCreateCustomerCreditsAccount failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CreateAccountDto](../../models/components/createaccountdto.md)                                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.AccountResponseDto](../../models/components/accountresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## listCustomerCreditsAccounts

List accounts for the authenticated store with cursor pagination. System accounts are excluded.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listCustomerCreditsAccounts" method="get" path="/v1/customer-credits/accounts" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.listCustomerCreditsAccounts(10, "cust_abc123");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalListCustomerCreditsAccounts } from "creem/funcs/customerCreditsAccountsExperimentalListCustomerCreditsAccounts.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalListCustomerCreditsAccounts(creem, 10, "cust_abc123");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalListCustomerCreditsAccounts failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `limit`                                                                                                                                                                        | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Maximum number of accounts to return                                                                                                                                           |                                                                                                                                                                                |
| `customerId`                                                                                                                                                                   | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Filter by owner ID (e.g. customer ID)                                                                                                                                          | cust_abc123                                                                                                                                                                    |
| `startingAfter`                                                                                                                                                                | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for forward pagination — account ID to start after                                                                                                                      |                                                                                                                                                                                |
| `endingBefore`                                                                                                                                                                 | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for backward pagination — account ID to end before                                                                                                                      |                                                                                                                                                                                |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[components.AccountListResponseDto](../../models/components/accountlistresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## getCustomerCreditsAccount

Get details of a customer credits account by ID.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getCustomerCreditsAccount" method="get" path="/v1/customer-credits/accounts/{id}" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.getCustomerCreditsAccount("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalGetCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalGetCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalGetCustomerCreditsAccount(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalGetCustomerCreditsAccount failed:", res.error);
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

**Promise\<[components.AccountResponseDto](../../models/components/accountresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## getCustomerCreditsAccountBalance

Get the current balance of an account. Optionally pass ?at= for historical balance.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getCustomerCreditsAccountBalance" method="get" path="/v1/customer-credits/accounts/{id}/balance" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.getCustomerCreditsAccountBalance("<id>", "2024-01-15T00:00:00.000Z");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalGetCustomerCreditsAccountBalance } from "creem/funcs/customerCreditsAccountsExperimentalGetCustomerCreditsAccountBalance.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalGetCustomerCreditsAccountBalance(creem, "<id>", "2024-01-15T00:00:00.000Z");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalGetCustomerCreditsAccountBalance failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |                                                                                                                                                                                |
| `at`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | ISO 8601 date. If present, computes balance at that point in time. If absent, returns O(1) projected balance.                                                                  | 2024-01-15T00:00:00.000Z                                                                                                                                                       |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[components.BalanceResponseDto](../../models/components/balanceresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## listCustomerCreditsAccountEntries

List the credit and debit history for an account with cursor pagination.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listCustomerCreditsAccountEntries" method="get" path="/v1/customer-credits/accounts/{id}/entries" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.listCustomerCreditsAccountEntries("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalListCustomerCreditsAccountEntries } from "creem/funcs/customerCreditsAccountsExperimentalListCustomerCreditsAccountEntries.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalListCustomerCreditsAccountEntries(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalListCustomerCreditsAccountEntries failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `limit`                                                                                                                                                                        | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Maximum number of entries to return                                                                                                                                            |
| `startingAfter`                                                                                                                                                                | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for forward pagination — entry ID to start after                                                                                                                        |
| `endingBefore`                                                                                                                                                                 | *string*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | Cursor for backward pagination — entry ID to end before                                                                                                                        |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.EntryListResponseDto](../../models/components/entrylistresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## freezeCustomerCreditsAccount

Freeze an account to prevent new transactions.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="freezeCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts/{id}/freeze" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.freezeCustomerCreditsAccount("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalFreezeCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalFreezeCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalFreezeCustomerCreditsAccount(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalFreezeCustomerCreditsAccount failed:", res.error);
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

**Promise\<[components.AccountResponseDto](../../models/components/accountresponsedto.md)\>**

### Errors

| Error Type                             | Status Code                            | Content Type                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| errors.CustomerCreditsErrorResponseDto | 409                                    | application/json                       |
| errors.APIError                        | 4XX, 5XX                               | \*/\*                                  |

## unfreezeCustomerCreditsAccount

Unfreeze a frozen account to allow transactions again.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="unfreezeCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts/{id}/unfreeze" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.unfreezeCustomerCreditsAccount("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalUnfreezeCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalUnfreezeCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalUnfreezeCustomerCreditsAccount(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalUnfreezeCustomerCreditsAccount failed:", res.error);
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

**Promise\<[components.AccountResponseDto](../../models/components/accountresponsedto.md)\>**

### Errors

| Error Type                             | Status Code                            | Content Type                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| errors.CustomerCreditsErrorResponseDto | 409                                    | application/json                       |
| errors.APIError                        | 4XX, 5XX                               | \*/\*                                  |

## creditCustomerCreditsAccount

Add credits to a customer account. Returns the resulting transaction record.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="creditCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts/{id}/credit" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.creditCustomerCreditsAccount("<id>", {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalCreditCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalCreditCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalCreditCustomerCreditsAccount(creem, "<id>", {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalCreditCustomerCreditsAccount failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `creditDebitRequestDto`                                                                                                                                                        | [components.CreditDebitRequestDto](../../models/components/creditdebitrequestdto.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.TransactionResponseDto](../../models/components/transactionresponsedto.md)\>**

### Errors

| Error Type                             | Status Code                            | Content Type                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| errors.CustomerCreditsErrorResponseDto | 409                                    | application/json                       |
| errors.APIError                        | 4XX, 5XX                               | \*/\*                                  |

## debitCustomerCreditsAccount

Deduct credits from a customer account. Returns the resulting transaction record.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="debitCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts/{id}/debit" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.debitCustomerCreditsAccount("<id>", {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalDebitCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalDebitCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalDebitCustomerCreditsAccount(creem, "<id>", {
    amount: "1000",
    reference: "signup_bonus",
    idempotencyKey: "idem_abc123",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalDebitCustomerCreditsAccount failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `creditDebitRequestDto`                                                                                                                                                        | [components.CreditDebitRequestDto](../../models/components/creditdebitrequestdto.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.TransactionResponseDto](../../models/components/transactionresponsedto.md)\>**

### Errors

| Error Type                             | Status Code                            | Content Type                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| errors.CustomerCreditsErrorResponseDto | 409                                    | application/json                       |
| errors.APIError                        | 4XX, 5XX                               | \*/\*                                  |

## reverseCustomerCreditsAccountTransaction

Reverse a previous credit or debit on this account. Creates a new transaction that undoes the original, preserving the full history.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="reverseCustomerCreditsAccountTransaction" method="post" path="/v1/customer-credits/accounts/{id}/reverse" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.reverseCustomerCreditsAccountTransaction("<id>", {
    transactionId: "cct_abc123",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalReverseCustomerCreditsAccountTransaction } from "creem/funcs/customerCreditsAccountsExperimentalReverseCustomerCreditsAccountTransaction.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalReverseCustomerCreditsAccountTransaction(creem, "<id>", {
    transactionId: "cct_abc123",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalReverseCustomerCreditsAccountTransaction failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `reverseTransactionRequestDto`                                                                                                                                                 | [components.ReverseTransactionRequestDto](../../models/components/reversetransactionrequestdto.md)                                                                             | :heavy_check_mark:                                                                                                                                                             | N/A                                                                                                                                                                            |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.TransactionResponseDto](../../models/components/transactionresponsedto.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## closeCustomerCreditsAccount

Permanently close an account. This action cannot be undone.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="closeCustomerCreditsAccount" method="post" path="/v1/customer-credits/accounts/{id}/close" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.customerCreditsAccountsExperimental.closeCustomerCreditsAccount("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { customerCreditsAccountsExperimentalCloseCustomerCreditsAccount } from "creem/funcs/customerCreditsAccountsExperimentalCloseCustomerCreditsAccount.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await customerCreditsAccountsExperimentalCloseCustomerCreditsAccount(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("customerCreditsAccountsExperimentalCloseCustomerCreditsAccount failed:", res.error);
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

**Promise\<[components.AccountResponseDto](../../models/components/accountresponsedto.md)\>**

### Errors

| Error Type                             | Status Code                            | Content Type                           |
| -------------------------------------- | -------------------------------------- | -------------------------------------- |
| errors.CustomerCreditsErrorResponseDto | 409                                    | application/json                       |
| errors.APIError                        | 4XX, 5XX                               | \*/\*                                  |