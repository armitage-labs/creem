# Affiliates

## Overview

### Available Operations

* [createInvite](#createinvite) - Create an affiliate invitation
* [listInvites](#listinvites) - List affiliate invitations
* [list](#list) - List all affiliates
* [retrieve](#retrieve) - Retrieve an affiliate
* [listCommissions](#listcommissions) - List affiliate commissions

## createInvite

Invite someone to your affiliate program by email. They receive an invitation email and become an active affiliate once they accept. If `program_id` is omitted, the invitation is created for your store's affiliate program.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createAffiliateInvite" method="post" path="/v1/affiliates/invites" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.affiliates.createInvite({
    email: "partner@example.com",
    name: "Jane Partner",
    programId: "prog_1234567890",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { affiliatesCreateInvite } from "creem/funcs/affiliatesCreateInvite.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await affiliatesCreateInvite(creem, {
    email: "partner@example.com",
    name: "Jane Partner",
    programId: "prog_1234567890",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("affiliatesCreateInvite failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [components.CreateAffiliateInviteRequestEntity](../../models/components/createaffiliateinviterequestentity.md)                                                                 | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.AffiliateInviteEntity](../../models/components/affiliateinviteentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## listInvites

Retrieve a paginated list of the invitations you have sent, with their status (`pending` until accepted, `accepted` once the affiliate has joined).

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listAffiliateInvites" method="get" path="/v1/affiliates/invites" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.affiliates.listInvites();

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
import { affiliatesListInvites } from "creem/funcs/affiliatesListInvites.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await affiliatesListInvites(creem);
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("affiliatesListInvites failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pageNumber`                                                                                                                                                                   | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The page number for pagination.                                                                                                                                                | 1                                                                                                                                                                              |
| `pageSize`                                                                                                                                                                     | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The number of items per page.                                                                                                                                                  | 50                                                                                                                                                                             |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[operations.ListAffiliateInvitesResponse](../../models/operations/listaffiliateinvitesresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## list

Retrieve a paginated list of your affiliates with their referral link, click and conversion counts, and lifetime commission. Affiliates who were invited but have not yet joined a program are not included.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listAffiliates" method="get" path="/v1/affiliates" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.affiliates.list();

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
import { affiliatesList } from "creem/funcs/affiliatesList.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await affiliatesList(creem);
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("affiliatesList failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pageNumber`                                                                                                                                                                   | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The page number for pagination.                                                                                                                                                | 1                                                                                                                                                                              |
| `pageSize`                                                                                                                                                                     | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The number of items per page.                                                                                                                                                  | 50                                                                                                                                                                             |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[operations.ListAffiliatesResponse](../../models/operations/listaffiliatesresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## retrieve

Retrieve a single affiliate by ID, including referral link, click and conversion counts, and lifetime commission.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="retrieveAffiliate" method="get" path="/v1/affiliates/{id}" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.affiliates.retrieve("<id>");

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { CreemCore } from "creem/core.js";
import { affiliatesRetrieve } from "creem/funcs/affiliatesRetrieve.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await affiliatesRetrieve(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("affiliatesRetrieve failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | The unique identifier of the affiliate                                                                                                                                         |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[components.AffiliateEntity](../../models/components/affiliateentity.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |

## listCommissions

Retrieve a paginated list of an affiliate’s commissions. Filter by settlement status (pending, approved, paid).

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listAffiliateCommissions" method="get" path="/v1/affiliates/{id}/commissions" -->
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.affiliates.listCommissions("<id>");

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
import { affiliatesListCommissions } from "creem/funcs/affiliatesListCommissions.js";

// Use `CreemCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const creem = new CreemCore({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const res = await affiliatesListCommissions(creem, "<id>");
  if (res.ok) {
    const { value: result } = res;
    for await (const page of result) {
    console.log(page);
  }
  } else {
    console.log("affiliatesListCommissions failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    | Example                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                                                                                           | *string*                                                                                                                                                                       | :heavy_check_mark:                                                                                                                                                             | The unique identifier of the affiliate                                                                                                                                         |                                                                                                                                                                                |
| `status`                                                                                                                                                                       | [components.CommissionStatus](../../models/components/commissionstatus.md)                                                                                                     | :heavy_minus_sign:                                                                                                                                                             | The settlement status of the commission. `pending` while on hold, `approved` once cleared and available, `paid` once settled by a payout.                                      |                                                                                                                                                                                |
| `pageNumber`                                                                                                                                                                   | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The page number for pagination.                                                                                                                                                | 1                                                                                                                                                                              |
| `pageSize`                                                                                                                                                                     | *number*                                                                                                                                                                       | :heavy_minus_sign:                                                                                                                                                             | The number of items per page.                                                                                                                                                  | 10                                                                                                                                                                             |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |                                                                                                                                                                                |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |                                                                                                                                                                                |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |                                                                                                                                                                                |

### Response

**Promise\<[operations.ListAffiliateCommissionsResponse](../../models/operations/listaffiliatecommissionsresponse.md)\>**

### Errors

| Error Type      | Status Code     | Content Type    |
| --------------- | --------------- | --------------- |
| errors.APIError | 4XX, 5XX        | \*/\*           |