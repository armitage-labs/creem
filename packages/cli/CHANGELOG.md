# @creem_io/cli

## 0.12.0

### Minor Changes

- 478df02: `creem catalog promote` copies the store's test catalog (meters and products) into live, pairing items by key (`external_id`), and `creem catalog link` and `creem catalog unlink` pair and unpair a test and a live item by hand.
  - `catalog promote` runs Creem's dry run first and follows `next_cursor` until the run is complete. In a terminal it asks for each `needs_key` item's key (a numbered list of live items with the same name, and the proposed key), for each feature that needs a key, and for each `possible_rename` (create, or re-pair with a live item), offers to copy live-only `metadata` keys into test, runs the dry run again after any of these writes, and asks before the real run. A write that may have gone through (a timeout, a `5xx`, a half-done pair) is named, and its item is asked about again after a fresh dry run; a `401` or `403` stops the command with exit 3. `--dry-run` previews only; `--yes` confirms the real run but never a key, and stops before it on a `possible_rename` unless `--create <test id>` names the item; `--force` writes the other items when the check refuses one; `--select meters=…|products=…` takes `all` or test ids. Every item's result, error code and message is printed with the `run_id`; `--json` prints `{ preview, run }`. The exit code is 4 when an item ends `failed`, `conflict`, `blocked` or `needs_key`, or `not_written` because it changed since the check. Promote waits 90 s per page unless `--timeout` is given; a run whose later page fails prints what it got, with its `run_id`, and exits 4 (3 for a `401` or `403`, with a `429`'s `Retry-After`).
  - `catalog link --kind product|meter|feature` checks the key on both sides with a dry run, then writes live first and test second, and reports "Live written" when the test write fails; running it again finishes the pair. Without `--key` it proposes a key and asks; outside a terminal `--key` is required. A feature's key is written through each side's product, re-sending the product's other features of that type. `catalog unlink` clears the live item's key after confirmation.
  - These commands use the store's live and test keys: `CREEM_LIVE_API_KEY` and `CREEM_TEST_API_KEY`, else the current key when it belongs to that environment. In a terminal a missing key is asked for and never saved, and must be that environment's key; otherwise the command exits 3 and names the variable.

- 7fe9f96: The CLI follows the regenerated SDK:
  - New commands: `product-groups create` (an upsert when `--external-id` is set), `product-groups update <id>`, `product-groups delete <id>`, `product-groups add-product <id>`, `product-groups remove-product <id> --product-id <id>` and `catalog validate --data <batch>`, which checks up to 100 meter and product writes together without writing anything.
  - `products`, `discounts` and `meters` `create` and `update`, and `product-groups create` and `update`, take `--dry-run`, a switch: the API runs the write and rolls it back, and the answer's `writeResult.dryRun` is `true`. The creates take `--if-none-match '*'` to create only.
  - `products create` no longer refuses a missing `--name`, `--description`, `--price`, `--currency` or `--billing-type` itself, because with `--external-id` it can update an existing product with only the fields sent; the API still answers `400` for a create without them.
  - `subscriptions list` takes `--product-id`, `--price-id` and `--customer-id`, filtered by the API. `--status` still takes one status and reads every page; a status the API knows is now also sent as its filter, so fewer pages come back.

- 50c5d5f: `creem migrate lemon-squeezy` can now run again safely. It keys every product by `ls_variant_<id>` and every discount by `ls_discount_<id>` in `external_id`, reads your Creem store first, and prints a plan of what it creates, updates, leaves unchanged and skips before the first write. A second run finds what the first one wrote and writes nothing when nothing changed.
  - New mappings: free one-time products, pay-what-you-want one-time products with their suggested price, custom billing cycles (weekly and others), trials in days, the LS tax code, license key settings as a license key feature, and files as file downloads, uploaded through `POST /v1/files` and uploaded again only when their SHA-256 changed. Discount codes limited to some variants now apply to those products instead of being skipped; other codes apply to every migrated product, including products from earlier runs. A code with a redemption limit gets what's left of it, read from Lemon Squeezy's redemption count, and a used-up code is skipped.
  - Skipped with the reason in the plan: free subscriptions, usage-based and tiered prices, unsupported billing cycles, pay what you want with a minimum below 1.00, draft variants, discount codes longer than 14 characters, files that couldn't be downloaded, and the hidden default variant of a product with other variants. Discount names longer than 40 characters are shortened with a warning. Product groups are listed for you to create in the dashboard. Keyed Creem products whose variant is gone or no longer migrated, and active keyed Creem discounts whose code is gone or no longer migrated, are listed with an `orphaned` warning and left as they are.
  - A re-run keeps what you added in Creem: your own files in a migrated file feature, your own products and metadata, and your own features. A migrated discount's products only grow: a product Lemon Squeezy no longer lists stays, with a `discount_product_kept` warning, because the CLI can't tell it from one you added. A file of yours is never taken as the Lemon Squeezy file, even with the same name and size, because the API can't show its contents; the Lemon Squeezy file is uploaded next to it.
  - `--json` prints a versioned migration report (`schema: "creem.migration_report"`, `version: 1`). With `--yes` it runs the plan and prints the result. Exit code `2` means invalid options, an `--adopt` answer that can't be applied, or a missing API key; `4` means the Lemon Squeezy store couldn't be read completely and nothing was written; `6` means the run finished with failed items; `7` means an adoption proposal is unanswered and nothing was written (also for `--dry-run` and a `--json` plan).
  - Adoption: a Creem product without a key and the same name (ignoring case and spacing), or a discount with the same code, is proposed with every candidate and its differences, never preselected. In a terminal, the CLI asks about each candidate. Without one, `--adopt <key>=<creem id>` adopts that object (also an unkeyed one whose name differs), `--adopt <key>=new` creates a new one, and `--adopt` alone adopts every proposal with one candidate. Answers are checked before anything is asked or written: one for a key the plan doesn't have, an unknown or keyed object, or an object another answer already adopts stops the command. `--yes` never answers a proposal. An adopted product's own keyless license-key feature, or file feature holding a file of the same name, gets the key instead of a second feature being added; the Lemon Squeezy file is added next to the merchant's files.
  - The command no longer fetches Lemon Squeezy customers, and no longer says customers are migrated.

- 7fe9f96: `creem migrate lemon-squeezy` writes through Creem's keyed upserts and has Creem check every write before the first one:
  - Products, product groups and discounts are written with `POST` and their key in `external_id` (`ls_variant_<id>`, `ls_product_<id>`, `ls_discount_<id>`), which creates the object when the key is new and changes only the fields sent otherwise. Two runs at the same time can't create an object twice. Only two writes still go by ID: adopting an object without a key, which makes the item's changes in the same request, and an update that clears a trial, a redemption limit or an expiry date, which the upsert can't send.
  - Product groups are created now: one per Lemon Squeezy product with two or more subscription variants, with the variants first, in Lemon Squeezy's order. The CLI never removes a product from a group: any other product stays after the variants, and one with a variant key that Lemon Squeezy doesn't list for that product carries a `group_product_kept` warning; when that product is a variant of another Lemon Squeezy product that gets its own group, the warning also says Creem refuses that group until you move it (a product is in one group only). If you already made the group in the dashboard, Creem refuses the new one and the plan names the command that gives yours the key.
  - Before the first write, Creem checks the plan without writing anything: the products together with `POST /v1/catalog/validate`, and each product group and discount with `?dry_run=true`. The plan shows what Creem would do with each item. When Creem refuses an item, nothing is written, the item carries Creem's error and a hint, and the command exits with the new code `8`, also for `--dry-run` and a `--json` plan. `--force` writes the other items and leaves the refused ones out (exit `6`).
  - Only Creem refusing an item counts as a refusal. When Creem is unavailable, times out or refuses the API key during the check, nothing is written and the command exits `1` (`3` for the key). A rate limit is waited out as long as `Retry-After` says, up to a minute, and the request sent again; a longer wait stops the command there, with what it already wrote, the wait named and exit `1`.
  - During the run, each write runs as a dry run again right before it. When Creem answers a dry run without `write_result.dry_run: true`, the command stops, prints what it wrote before, and exits `1`.
  - `--dry-run` is this check alone: it writes and uploads nothing.
  - A store migrated by the previous version re-runs with every item unchanged; the only new writes are its product groups.

### Patch Changes

- Updated dependencies [478df02]
- Updated dependencies [7fe9f96]
- Updated dependencies [7fe9f96]
  - creem@2.1.0

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
