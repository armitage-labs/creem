# Changelog

## 1.11.0

### Minor Changes

- 5ba19e4: Expose the webhook endpoint management surface. The SDK gains `webhooks.list`, `webhooks.create`, `webhooks.get`, `webhooks.update`, `webhooks.delete` and `webhooks.getSecret`, the bundled MCP server gains the matching `webhooks-*` tools, and the CLI gains `creem webhooks …` commands (list, create, get, update, delete, secret). Deleting a webhook is a destructive operation and prompts for confirmation or requires `--yes`.

## 1.10.1

### Patch Changes

- f862ca9: Fix seven OpenAPI field types that made the generated SDK reject valid responses or strip a request body: customers with an `external_id` no longer fail `customers get/list/create/update` or `checkouts get`; usage event `properties` are sent intact instead of `{}`; `events preview` and its error reports parse; `checkouts get` works for license-key products.

## 1.10.0

### Minor Changes

- 54e329a: Expose the Customer Credits transactions surface. The SDK gains `customerCredits.postTransaction` (balanced multi-entry transactions across accounts), `customerCredits.getTransaction`, `customerCredits.reverseTransactionById`, and `customerCredits.listTransactionsByReference`, with matching `creem customer-credits transactions …` CLI commands (create, get, reverse, list). Posting and reversing transactions are destructive operations and prompt for confirmation or require `--yes`.

## 1.9.0

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

## 1.8.0

### Minor Changes

- 0e6e264: Add the usage-based billing surface: new `events` group (`ingestEvents` batch usage ingestion, `previewEvents` dry-run, `listEvents` with computed `matched_meters`) and `meters` group (create, list, get, update, preview, preview-stored, per-customer consumed units, archive, unarchive) in the SDK, with matching `creem events …` (ingest, preview, list) and `creem meters …` CLI commands. Ingest responses carry advisory warnings when an event will not aggregate as sent. Customer-credits operations drop their experimental marker.

## 1.7.0

### Minor Changes

- b0276f9: Regenerate the TypeScript SDK from the latest public API contract, adding revenue split operations and refreshing the generated product, affiliate-invitation, and webhook surfaces.

## 1.6.2

### Patch Changes

- 3cf0b89: Include consistent MIT licensing, repository metadata, release documentation,
  and explicit workspace dependency references in published package artifacts,
  and make dual CommonJS/ESM type entrypoints resolve to their matching declaration
  format.

This changelog records user-facing changes to the `creem` TypeScript SDK. The
generator and publication log remains in [RELEASES.md](./RELEASES.md).

## Unreleased

- Add repository-governance metadata and package-local MIT licensing without
  changing the generated API surface.

## 1.6.1 - 2026-08-18

- Current generated SDK release at the time this changelog was initialized.

For earlier generated releases, see [RELEASES.md](./RELEASES.md) and the
[npm version history](https://www.npmjs.com/package/creem?activeTab=versions).
