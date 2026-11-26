# @creem_io/cli

## 0.11.0

### Minor Changes

- 2020a54: `creem` 2.0 follows the current API:
  - New methods: `productGroups.list({ limit, startingAfter, endingBefore, externalId })` and `productGroups.get({ id })` read product groups, `products.listPrices({ id })` lists a product's price versions, `discounts.update({ id, updateDiscountRequestEntity })` changes a discount, and `files.createUpload(request)` and `files.confirmUpload({ id })` upload a file a product's `file` feature can deliver.
  - `discounts.create` and `meters.createMeter` take an optional `idempotencyKey`, sent as the `Idempotency-Key` header. A create with a key that is still in progress, or failed with an unclear outcome less than 5 minutes ago, answers `429`: `discounts.create` throws `TooManyRequestsErrorEntity`, and `meters.createMeter` throws `UsageMeteringErrorApiResponseDto`. Neither `TooManyRequestsErrorEntity` nor `UsageMeteringErrorApiResponseDto` is an `APIError`, so a 1.x `catch` that checks `instanceof APIError` for a 429 from either method no longer matches; catch `CreemError` and read `statusCode` to handle a 429 from any method. Because both methods gained a parameter, their body moves under its name: `discounts.create({ createDiscountRequestEntity, idempotencyKey })` and `meters.createMeter({ createMeterApiRequestDto, idempotencyKey })`. The migration guide lists them.
  - Discounts can name their products by `external_id` (`appliesToProductExternalIds`) and carry their own `externalId`; `appliesToProducts` is no longer required when the other list names a product. Features carry an `externalId`, and products return `abandonedCartRecoveryEnabled`, which `products.update` also takes, along with `customFields`.
  - Products take `licenseKey`, `custom` (private note) and `file` features on create and update; an update entry with `deleted: true` removes one feature (typed as `{ id, deleted: true }`; an untyped entry with more fields is still sent as a deletion), and `status` archives or unarchives. `products.update` returns a `ProductWriteResponseEntity`, the product plus `writeResult.warnings`. Customers take `country`, and `name` is optional on create; checkouts take and return `trialPeriodDays`; meters return `locked`.
  - A feature entry's `type` is its string literal, such as `"customerCredits"`; the 1.x enum `ProductFeatureRequestType` is removed.
  - In the `marketplace.grant.requested` webhook, `deadlineAt`, `order.transactionId` and `order.paidAt` are `string | null`. The empty `DeadlineAt`, `TransactionId` and `PaidAt` types they had in 1.x are removed; 1.x failed to parse an event with a value in one of them.
  - The `credits.reversed` webhook event: `parseWebhookEventEntity` and `constructWebhookEventEntity` parse it into its own shape, with a `CustomerCreditsReversalEntity` as `object`.

  The CLI's `discounts create` and `meters create` take `--idempotency-key`, and `discounts create` accepts a discount whose products are named only in `appliesToProductExternalIds`. New read-only commands: `product-groups list` (cursor pagination with `--limit`, `--starting-after`, `--ending-before` and `--all`, filtered by `--external-id`), `product-groups get <id>` and `products prices <id>`, which lists a product's price versions. `discounts update <id>` changes a discount (body flags as on `discounts create`, or `--data`), and `files create-upload` and `files confirm-upload <id>` create and confirm a file upload. `customers create` no longer requires `--name`. `discounts create` and `discounts update` take a fractional `--percentage`, such as `12.5`, as the API does; the CLI refused one before.

### Patch Changes

- 2020a54: Every SDK method now takes one request object, then the optional `RequestOptions`: `creem.products.update({ id, updateProductRequestEntity }, options)` instead of `creem.products.update(id, body, options)`. The HTTP API doesn't change. Why: with positional arguments, a new optional API parameter was inserted before `options`, so existing calls stopped compiling (and in JavaScript sent the options object as that parameter). With a request object, a new parameter of an operation that already has one is a new optional property and no call changes, so upcoming parameters such as `dry_run`, `If-None-Match` and `If-Match` on those operations arrive in minor releases. The 17 methods that take only a body keep taking it; the migration guide says what changes if one of them gains a parameter.
  - A method whose parameters are all optional still takes the object: `creem.products.search()` becomes `creem.products.search({})`.
  - The bundled MCP server's tools take the same request object (`{ "request": { … } }`).
  - The CLI moves to the new signatures; its existing commands and flags don't change. `subscriptions list --status` accepts any status, and a billing type the CLI doesn't know is shown as it is instead of as recurring.
  - Response enums are open: a value the API adds later comes through as a string instead of failing the response. The same holds for webhook payloads parsed with `parseWebhookEventEntity` / `constructWebhookEventEntity`, and an unknown event type comes back as the unknown variant (`eventType: "UNKNOWN"`, the payload in `raw`) instead of throwing. A known event type whose payload doesn't match its schema, or a payload without an `eventType`, still throws. So new values and new webhook event types are minor releases from now on. A `switch` over the known values is no longer exhaustive: a `never` exhaustiveness check no longer compiles, and neither does a function that returns from every case when its return type is declared or `noImplicitReturns` is on (with an inferred return type it compiles and its return type gains `undefined`). Add a `default` branch.
  - `@creem_io/convex` calls the new signatures and now needs `creem` 2 as its peer dependency (`^2.0.0`); its component API doesn't change, except that a credit entry's `side` is typed as a string, because the SDK now passes a side the API adds later through. The webhook route acknowledges an event type it doesn't know with `202` instead of answering `400`, so Creem stops retrying it. A malformed payload of a known event type, or one without an `eventType`, still gets `400`, and the route and the `parseSubscription` / `parseCheckout` / `parseProduct` / `parseRefund` helpers log only what failed, not the payload. `parseGeneratedWebhookEvent` now parses with the SDK's `parseWebhookEventEntity`, so it follows the same rules.

  `packages/sdk/MIGRATION.md` lists every changed method next to its new form.

- Updated dependencies [2020a54]
- Updated dependencies [2020a54]
  - creem@2.0.0

## 0.10.0

### Minor Changes

- d7a4947: Support the refreshed API: `transactions list` takes `--status`, `--created-after` and `--created-before`, `products list` and `meters list` take `--external-id`, and `customer-credits debit` and `customer-credits transactions create` take `--moderation-id`. Product and meter create/update accept `--external-id`, and products accept `--metadata`.

### Patch Changes

- Updated dependencies [d7a4947]
  - creem@1.14.0

## 0.9.0

### Minor Changes

- 690edab: Add `creem listen`: receive your store's webhooks on your machine without a tunnel or a deploy. The command creates a temporary `cli` delivery-mode endpoint, forwards each event to a local URL with the real body and `creem-signature` header, reports the local result back to Creem, and deletes the endpoint on exit. New SDK methods `webhooks.listPendingEvents` and `webhooks.acknowledgeEvent`, plus `delivery_mode` on webhook create/read, back it (`creem webhooks pending` / `creem webhooks ack` expose them directly).

  Validate pending-feed limits as integers from 1 to 100, report the stored first acknowledgment outcome, and drain all pending pages with `--once`.

### Patch Changes

- Updated dependencies [690edab]
  - creem@1.13.0

## 0.8.0

### Minor Changes

- b9d214c: Products API: metered pricing and credit grants from code.
  - `products.create` / `products.update` accept `usagePrices[]` (meter, tax-exclusive unit price in minor units per meter unit, free allowance, cap, settlement mode, target credit bucket, trial usage mode) and `features[]` of type `customerCredits` (a credit grant into a customer credit bucket). On update the arrays are the product's complete set: omit to leave untouched, `[]` to remove, include `id` to edit in place.
  - Product responses (`get`, `search`, list) expose `usagePrices[]` and each credit feature's `customerCredits`.
  - Regenerated from the current OpenAPI document, which also brings the product `trialPeriodDays` / `trialPrice` / `businessNetPricing` fields and `customers.update` `email` into the SDK types and the MCP tool schemas.
  - CLI: `products create` and `products update` carry the new fields through `--data`; the parity gate covers them.

### Patch Changes

- Updated dependencies [b9d214c]
  - creem@1.12.0

## 0.7.0

### Minor Changes

- 5ba19e4: Expose the webhook endpoint management surface. The SDK gains `webhooks.list`, `webhooks.create`, `webhooks.get`, `webhooks.update`, `webhooks.delete` and `webhooks.getSecret`, the bundled MCP server gains the matching `webhooks-*` tools, and the CLI gains `creem webhooks …` commands (list, create, get, update, delete, secret). Deleting a webhook is a destructive operation and prompts for confirmation or requires `--yes`.

### Patch Changes

- Updated dependencies [5ba19e4]
  - creem@1.11.0

## 0.6.1

### Patch Changes

- f862ca9: Fix seven OpenAPI field types that made the generated SDK reject valid responses or strip a request body: customers with an `external_id` no longer fail `customers get/list/create/update` or `checkouts get`; usage event `properties` are sent intact instead of `{}`; `events preview` and its error reports parse; `checkouts get` works for license-key products.
- Updated dependencies [f862ca9]
  - creem@1.10.1

## 0.6.0

### Minor Changes

- 54e329a: Expose the Customer Credits transactions surface. The SDK gains `customerCredits.postTransaction` (balanced multi-entry transactions across accounts), `customerCredits.getTransaction`, `customerCredits.reverseTransactionById`, and `customerCredits.listTransactionsByReference`, with matching `creem customer-credits transactions …` CLI commands (create, get, reverse, list). Posting and reversing transactions are destructive operations and prompt for confirmation or require `--yes`.

### Patch Changes

- Updated dependencies [54e329a]
  - creem@1.10.0

## 0.5.0

### Minor Changes

- db88e5d: Usage events: customer resolution and a single attribute bag.
  - Ingest and preview events now take **exactly one** of `customerId` (the
    Creem customer id, validated to exist) or the new `externalCustomerId`
    (your own id for the customer, resolved via the customer's registered
    `external_id`). Unknown references reject the whole batch with a 422
    naming the offending event.
  - Customers gain `external_id` on create, update, and the customer entity
    (unique per store; send `null` on update to clear it). CLI:
    `creem customers create|update --external-id`.
  - Preview reports now include the resolved `customer_id` per event.
  - **Contract cut on the pre-release usage surface**: the `metadata` field is
    removed from usage events — the server now rejects it with a 422. Put
    event attributes in `properties`, the bag meters aggregate and filter on.
    This surface shipped days ago with zero production adoption, hence the
    minor bump.

### Patch Changes

- Updated dependencies [db88e5d]
  - creem@1.9.0

## 0.4.0

### Minor Changes

- 0e6e264: Add the usage-based billing surface: new `events` group (`ingestEvents` batch usage ingestion, `previewEvents` dry-run, `listEvents` with computed `matched_meters`) and `meters` group (create, list, get, update, preview, preview-stored, per-customer consumed units, archive, unarchive) in the SDK, with matching `creem events …` (ingest, preview, list) and `creem meters …` CLI commands. Ingest responses carry advisory warnings when an event will not aggregate as sent. Customer-credits operations drop their experimental marker.

### Patch Changes

- Updated dependencies [0e6e264]
  - creem@1.8.0

## 0.3.0

### Minor Changes

- dbbc55d: Expand CLI commands and request inputs for product/customer/subscription updates, refunds, licenses, stats, moderation, customer credits, affiliate invitations, and revenue splits. Compile against the workspace SDK and enforce operation, input, command, and documentation parity in CI.

  Add environment-key authentication, complete camelCase JSON/file/stdin request bodies, typed validation, page/cursor traversal, streaming NDJSON, global output options, structured trace-aware errors, and non-retrying writes. Preserve large credit amounts as strings.

  Compatibility changes: subscription and discount lists now use the authoritative SDK search endpoints; subscription list JSON removes the old transaction-derived `note` field. Destructive commands (including updates and upgrades) require a TEST/LIVE confirmation interactively or `--yes` in automation and JSON/NDJSON modes. Existing command paths and aliases remain available.

  Preserve the legacy `creem help [command]` path, list pagination defaults, immediate cancellation mode, and fixed-discount USD default. Allow migration previews without target credentials and scope-restricted API keys when login validation authenticates successfully but the validation probe is forbidden.

  Restore Homebrew, npm, and npx installation choices in the docs. Keep the README focused on getting started and link to the canonical guides and command reference.

### Patch Changes

- Updated dependencies [b0276f9]
  - creem@1.7.0

## 0.2.3

### Patch Changes

- 3cf0b89: Include consistent MIT licensing, repository metadata, release documentation,
  and explicit workspace dependency references in published package artifacts,
  and make dual CommonJS/ESM type entrypoints resolve to their matching declaration
  format.

> Renamed from `creem-cli` to `@creem_io/cli` to follow the `@creem_io` scope convention. The installed command remains `creem`.

## 0.2.1

### Patch Changes

- 6725550: add multi-store support to Lemon Squeezy migration

## 0.2.0

### Minor Changes

- daf1f59: Add `creem-cli` as a new package in the monorepo — the official command-line tool for managing Creem products, customers, subscriptions, checkouts, transactions, and discounts from the terminal. Also supports migrating from LemonSqueezy via `creem migrate`.
