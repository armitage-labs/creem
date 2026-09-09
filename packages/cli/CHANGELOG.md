# @creem_io/cli

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
