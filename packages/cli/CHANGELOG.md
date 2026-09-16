# @creem_io/cli

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
