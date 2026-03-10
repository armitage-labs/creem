# Creem

Developer-friendly & type-safe Typescript SDK specifically catered to leverage _creem_ API.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=creem&utm_campaign=typescript"><img src="https://custom-icon-badges.demolab.com/badge/-Built%20By%20Speakeasy-212015?style=for-the-badge&logoColor=FBE331&logo=speakeasy&labelColor=545454" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>

<br /><br />
<!-- Start Summary [summary] -->
## Summary

Creem API: Creem is an all-in-one platform for managing subscriptions and recurring revenue, tailored specifically for today's SaaS companies. It enables you to boost revenue, enhance customer retention, and scale your operations seamlessly.

For more information about the API: [Creem Documentation](https://docs.creem.io)
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [Creem](#creem)
  * [SDK Installation](#sdk-installation)
  * [Requirements](#requirements)
  * [SDK Example Usage](#sdk-example-usage)
  * [Authentication](#authentication)
  * [Available Resources and Operations](#available-resources-and-operations)
  * [Standalone functions](#standalone-functions)
  * [Retries](#retries)
  * [Error Handling](#error-handling)
  * [Server Selection](#server-selection)
  * [Custom HTTP Client](#custom-http-client)
  * [Debugging](#debugging)
* [Development](#development)
  * [Maturity](#maturity)
  * [Contributions](#contributions)

<!-- End Table of Contents [toc] -->

<!-- Start SDK Installation [installation] -->
## SDK Installation

The SDK can be installed with either [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/), [bun](https://bun.sh/) or [yarn](https://classic.yarnpkg.com/en/) package managers.

### NPM

```bash
npm add creem
```

### PNPM

```bash
pnpm add creem
```

### Bun

```bash
bun add creem
```

### Yarn

```bash
yarn add creem
```

> [!NOTE]
> This package is published with CommonJS and ES Modules (ESM) support.


### Model Context Protocol (MCP) Server

This SDK is also an installable MCP server where the various SDK methods are
exposed as tools that can be invoked by AI applications.

> Node.js v20 or greater is required to run the MCP server from npm.

<details>
<summary>Claude installation steps</summary>

Add the following server definition to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "Creem": {
      "command": "npx",
      "args": [
        "-y", "--package", "creem",
        "--",
        "mcp", "start",
        "--api-key", "..."
      ]
    }
  }
}
```

</details>

<details>
<summary>Cursor installation steps</summary>

Create a `.cursor/mcp.json` file in your project root with the following content:

```json
{
  "mcpServers": {
    "Creem": {
      "command": "npx",
      "args": [
        "-y", "--package", "creem",
        "--",
        "mcp", "start",
        "--api-key", "..."
      ]
    }
  }
}
```

</details>

You can also run MCP servers as a standalone binary with no additional dependencies. You must pull these binaries from available Github releases:

```bash
curl -L -o mcp-server \
    https://github.com/{org}/{repo}/releases/download/{tag}/mcp-server-bun-darwin-arm64 && \
chmod +x mcp-server
```

If the repo is a private repo you must add your Github PAT to download a release `-H "Authorization: Bearer {GITHUB_PAT}"`.


```json
{
  "mcpServers": {
    "Todos": {
      "command": "./DOWNLOAD/PATH/mcp-server",
      "args": [
        "start"
      ]
    }
  }
}
```

For a full list of server arguments, run:

```sh
npx -y --package creem -- mcp start --help
```
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- Start SDK Example Usage [usage] -->
## SDK Example Usage

### Example

```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890");

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->

<!-- Start Authentication [security] -->
## Authentication

### Per-Client Security Schemes

This SDK supports the following security scheme globally:

| Name     | Type   | Scheme  | Environment Variable |
| -------- | ------ | ------- | -------------------- |
| `apiKey` | apiKey | API key | `CREEM_API_KEY`      |

To authenticate with the API the `apiKey` parameter must be set when initializing the SDK client instance. For example:
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890");

  console.log(result);
}

run();

```
<!-- End Authentication [security] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>

### [Checkouts](docs/sdks/checkouts/README.md)

* [retrieve](docs/sdks/checkouts/README.md#retrieve) - Retrieve a checkout session.
* [create](docs/sdks/checkouts/README.md#create) - Creates a new checkout session.

### [Customers](docs/sdks/customers/README.md)

* [list](docs/sdks/customers/README.md#list) - List all customers
* [retrieve](docs/sdks/customers/README.md#retrieve) - Retrieve a customer
* [generateBillingLinks](docs/sdks/customers/README.md#generatebillinglinks) - Generate Customer Links

### [Discounts](docs/sdks/discounts/README.md)

* [get](docs/sdks/discounts/README.md#get) - Retrieve discount
* [create](docs/sdks/discounts/README.md#create) - Create a discount.
* [delete](docs/sdks/discounts/README.md#delete) - Delete a discount.

### [Licenses](docs/sdks/licenses/README.md)

* [activate](docs/sdks/licenses/README.md#activate) - Activates a license key.
* [deactivate](docs/sdks/licenses/README.md#deactivate) - Deactivate a license key instance.
* [validate](docs/sdks/licenses/README.md#validate) - Validates a license key or instance.

### [Products](docs/sdks/products/README.md)

* [get](docs/sdks/products/README.md#get) - Retrieve a product
* [create](docs/sdks/products/README.md#create) - Creates a new product.
* [search](docs/sdks/products/README.md#search) - List all products

### [Subscriptions](docs/sdks/subscriptions/README.md)

* [get](docs/sdks/subscriptions/README.md#get) - Retrieve a subscription
* [cancel](docs/sdks/subscriptions/README.md#cancel) - Cancel a subscription.
* [update](docs/sdks/subscriptions/README.md#update) - Update a subscription.
* [upgrade](docs/sdks/subscriptions/README.md#upgrade) - Upgrade a subscription to a different product
* [pause](docs/sdks/subscriptions/README.md#pause) - Pause a subscription.
* [resume](docs/sdks/subscriptions/README.md#resume) - Resume a paused subscription.

### [Transactions](docs/sdks/transactions/README.md)

* [getById](docs/sdks/transactions/README.md#getbyid) - Get a transaction by ID
* [search](docs/sdks/transactions/README.md#search) - List all transactions

</details>
<!-- End Available Resources and Operations [operations] -->

<!-- Start Standalone functions [standalone-funcs] -->
## Standalone functions

All the methods listed above are available as standalone functions. These
functions are ideal for use in applications running in the browser, serverless
runtimes or other environments where application bundle size is a primary
concern. When using a bundler to build your application, all unused
functionality will be either excluded from the final bundle or tree-shaken away.

To read more about standalone functions, check [FUNCTIONS.md](./FUNCTIONS.md).

<details>

<summary>Available standalone functions</summary>

- [`checkoutsCreate`](docs/sdks/checkouts/README.md#create) - Creates a new checkout session.
- [`checkoutsRetrieve`](docs/sdks/checkouts/README.md#retrieve) - Retrieve a checkout session.
- [`customersGenerateBillingLinks`](docs/sdks/customers/README.md#generatebillinglinks) - Generate Customer Links
- [`customersList`](docs/sdks/customers/README.md#list) - List all customers
- [`customersRetrieve`](docs/sdks/customers/README.md#retrieve) - Retrieve a customer
- [`discountsCreate`](docs/sdks/discounts/README.md#create) - Create a discount.
- [`discountsDelete`](docs/sdks/discounts/README.md#delete) - Delete a discount.
- [`discountsGet`](docs/sdks/discounts/README.md#get) - Retrieve discount
- [`licensesActivate`](docs/sdks/licenses/README.md#activate) - Activates a license key.
- [`licensesDeactivate`](docs/sdks/licenses/README.md#deactivate) - Deactivate a license key instance.
- [`licensesValidate`](docs/sdks/licenses/README.md#validate) - Validates a license key or instance.
- [`productsCreate`](docs/sdks/products/README.md#create) - Creates a new product.
- [`productsGet`](docs/sdks/products/README.md#get) - Retrieve a product
- [`productsSearch`](docs/sdks/products/README.md#search) - List all products
- [`subscriptionsCancel`](docs/sdks/subscriptions/README.md#cancel) - Cancel a subscription.
- [`subscriptionsGet`](docs/sdks/subscriptions/README.md#get) - Retrieve a subscription
- [`subscriptionsPause`](docs/sdks/subscriptions/README.md#pause) - Pause a subscription.
- [`subscriptionsResume`](docs/sdks/subscriptions/README.md#resume) - Resume a paused subscription.
- [`subscriptionsUpdate`](docs/sdks/subscriptions/README.md#update) - Update a subscription.
- [`subscriptionsUpgrade`](docs/sdks/subscriptions/README.md#upgrade) - Upgrade a subscription to a different product
- [`transactionsGetById`](docs/sdks/transactions/README.md#getbyid) - Get a transaction by ID
- [`transactionsSearch`](docs/sdks/transactions/README.md#search) - List all transactions

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890", {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 1,
        maxInterval: 50,
        exponent: 1.1,
        maxElapsedTime: 100,
      },
      retryConnectionErrors: false,
    },
  });

  console.log(result);
}

run();

```

If you'd like to override the default retry strategy for all operations that support retries, you can provide a retryConfig at SDK initialization:
```typescript
import { Creem } from "creem";

const creem = new Creem({
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 1,
      maxInterval: 50,
      exponent: 1.1,
      maxElapsedTime: 100,
    },
    retryConnectionErrors: false,
  },
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890");

  console.log(result);
}

run();

```
<!-- End Retries [retries] -->

<!-- Start Error Handling [errors] -->
## Error Handling

[`CreemError`](./src/models/errors/creemerror.ts) is the base class for all HTTP error responses. It has the following properties:

| Property            | Type       | Description                                            |
| ------------------- | ---------- | ------------------------------------------------------ |
| `error.message`     | `string`   | Error message                                          |
| `error.statusCode`  | `number`   | HTTP response status code eg `404`                     |
| `error.headers`     | `Headers`  | HTTP response headers                                  |
| `error.body`        | `string`   | HTTP body. Can be empty string if no body is returned. |
| `error.rawResponse` | `Response` | Raw HTTP response                                      |

### Example
```typescript
import { Creem } from "creem";
import * as errors from "creem/models/errors";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  try {
    const result = await creem.products.get("prod_1234567890");

    console.log(result);
  } catch (error) {
    if (error instanceof errors.CreemError) {
      console.log(error.message);
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error.headers);
    }
  }
}

run();

```

### Error Classes
**Primary error:**
* [`CreemError`](./src/models/errors/creemerror.ts): The base class for HTTP error responses.

<details><summary>Less common errors (6)</summary>

<br />

**Network errors:**
* [`ConnectionError`](./src/models/errors/httpclienterrors.ts): HTTP client was unable to make a request to a server.
* [`RequestTimeoutError`](./src/models/errors/httpclienterrors.ts): HTTP request timed out due to an AbortSignal signal.
* [`RequestAbortedError`](./src/models/errors/httpclienterrors.ts): HTTP request was aborted by the client.
* [`InvalidRequestError`](./src/models/errors/httpclienterrors.ts): Any input used to create a request is invalid.
* [`UnexpectedClientError`](./src/models/errors/httpclienterrors.ts): Unrecognised or unexpected error.


**Inherit from [`CreemError`](./src/models/errors/creemerror.ts)**:
* [`ResponseValidationError`](./src/models/errors/responsevalidationerror.ts): Type mismatch between the data returned from the server and the structure expected by the SDK. See `error.rawValue` for the raw value and `error.pretty()` for a nicely formatted multi-line string.

</details>
<!-- End Error Handling [errors] -->

<!-- Start Server Selection [server] -->
## Server Selection

### Select Server by Index

You can override the default server globally by passing a server index to the `serverIdx: number` optional parameter when initializing the SDK client instance. The selected server will then be used as the default on the operations that use it. This table lists the indexes associated with the available servers:

| #   | Server                      | Description |
| --- | --------------------------- | ----------- |
| 0   | `https://api.creem.io`      |             |
| 1   | `https://test-api.creem.io` |             |

#### Example

```typescript
import { Creem } from "creem";

const creem = new Creem({
  serverIdx: 0,
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890");

  console.log(result);
}

run();

```

### Override Server URL Per-Client

The default server can also be overridden globally by passing a URL to the `serverURL: string` optional parameter when initializing the SDK client instance. For example:
```typescript
import { Creem } from "creem";

const creem = new Creem({
  serverURL: "https://test-api.creem.io",
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.products.get("prod_1234567890");

  console.log(result);
}

run();

```
<!-- End Server Selection [server] -->

<!-- Start Custom HTTP Client [http-client] -->
## Custom HTTP Client

The TypeScript SDK makes API calls using an `HTTPClient` that wraps the native
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). This
client is a thin wrapper around `fetch` and provides the ability to attach hooks
around the request lifecycle that can be used to modify the request or handle
errors and response.

The `HTTPClient` constructor takes an optional `fetcher` argument that can be
used to integrate a third-party HTTP client or when writing tests to mock out
the HTTP client and feed in fixtures.

The following example shows how to:
- route requests through a proxy server using [undici](https://www.npmjs.com/package/undici)'s ProxyAgent
- use the `"beforeRequest"` hook to add a custom header and a timeout to requests
- use the `"requestError"` hook to log errors

```typescript
import { Creem } from "creem";
import { ProxyAgent } from "undici";
import { HTTPClient } from "creem/lib/http";

const dispatcher = new ProxyAgent("http://proxy.example.com:8080");

const httpClient = new HTTPClient({
  // 'fetcher' takes a function that has the same signature as native 'fetch'.
  fetcher: (input, init) =>
    // 'dispatcher' is specific to undici and not part of the standard Fetch API.
    fetch(input, { ...init, dispatcher } as RequestInit),
});

httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(5000)
  });

  nextRequest.headers.set("x-custom-header", "custom value");

  return nextRequest;
});

httpClient.addHook("requestError", (error, request) => {
  console.group("Request Error");
  console.log("Reason:", `${error}`);
  console.log("Endpoint:", `${request.method} ${request.url}`);
  console.groupEnd();
});

const sdk = new Creem({ httpClient: httpClient });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { Creem } from "creem";

const sdk = new Creem({ debugLogger: console });
```

You can also enable a default debug logger by setting an environment variable `CREEM_DEBUG` to true.
<!-- End Debugging [debug] -->

<!-- Placeholder for Future Speakeasy SDK Sections -->

# Development

## Maturity

This SDK is in beta, and there may be breaking changes between versions without a major version update. Therefore, we recommend pinning usage
to a specific package version. This way, you can install the same version each time without breaking changes unless you are intentionally
looking for the latest version.

## Contributions

While we value open-source contributions to this SDK, this library is generated programmatically. Any manual changes added to internal files will be overwritten on the next generation.
We look forward to hearing your feedback. Feel free to open a PR or an issue with a proof of concept and we'll do our best to include it in a future release.

### SDK Created by [Speakeasy](https://www.speakeasy.com/?utm_source=creem&utm_campaign=typescript)
