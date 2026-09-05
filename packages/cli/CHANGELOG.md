# @creem_io/cli

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
