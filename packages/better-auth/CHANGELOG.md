# [1.1.0](https://github.com/armitage-labs/creem-betterauth/compare/v1.0.2...v1.1.0) (2026-03-10)

## 1.1.1

### Patch Changes

- 29a4834: Await user-facing webhook callbacks so async work completes on serverless

  User-facing callbacks (`onCheckoutCompleted`, `onSubscriptionActive`, `onGrantAccess`, `onRevokeAccess`, etc.) were invoked without `await`, causing returned Promises to be silently dropped on serverless runtimes (Cloudflare Workers, Vercel Edge) where the worker terminates before async DB writes / API calls complete. Callback signatures in `CreemOptions` are widened from `=> void` to `=> void | Promise<void>` to match the JSDoc examples (which already showed `async` callbacks).

  Credit: original fix by @nirgn975 in armitage-labs/creem-betterauth#20.

### Features

- Added support of new creem SDK version ([#19](https://github.com/armitage-labs/creem-betterauth/issues/19)) ([fa0661f](https://github.com/armitage-labs/creem-betterauth/commit/fa0661f6b241ddbac186927fdf94dc29a3c99194))

## [1.0.2](https://github.com/armitage-labs/creem-betterauth/compare/v1.0.1...v1.0.2) (2026-03-06)

### Bug Fixes

- move creem SDK from peerDependencies to dependencies ([edef72c](https://github.com/armitage-labs/creem-betterauth/commit/edef72cb7203410b228201ffe529a2bfe4470126))
- update lockfile for creem as regular dependency ([13a51fd](https://github.com/armitage-labs/creem-betterauth/commit/13a51fd8abb5342063375ac86037d1e9dcd5cf23))

## [1.0.1](https://github.com/armitage-labs/creem-betterauth/compare/v1.0.0...v1.0.1) (2026-03-06)

### Bug Fixes

- **ci:** update npm for trusted publishing OIDC support ([6461d98](https://github.com/armitage-labs/creem-betterauth/commit/6461d98bacd7cd0e8c7f13066e70149d427ca6df))

# [1.0.0](https://github.com/armitage-labs/creem-betterauth/compare/v0.0.12...v1.0.0) (2026-03-06)

### Bug Fixes

- align tests with main branch changes ([318eccc](https://github.com/armitage-labs/creem-betterauth/commit/318eccc8a4469e837a67bfba5a30574848e60960))
- align tests with structured logging changes ([34f315e](https://github.com/armitage-labs/creem-betterauth/commit/34f315e14e9273d4afbf8ece379c0103a6cb9e39))
- **ci:** approve build scripts for transitive dependencies ([d55def2](https://github.com/armitage-labs/creem-betterauth/commit/d55def2092948e7b8eb81f5d035dce54a79b068f))
- **ci:** bump Node to 22.x for semantic-release ([7aa4ae2](https://github.com/armitage-labs/creem-betterauth/commit/7aa4ae22cd4d7c66d78f216da85580fc9ae42e83))
- **ci:** replace pnpm pack --dry-run with pnpm pack ([9e88f91](https://github.com/armitage-labs/creem-betterauth/commit/9e88f91d88205d02c970c8519956c768f2db72c3))
- linter issue ([033ffb2](https://github.com/armitage-labs/creem-betterauth/commit/033ffb21928ef9c1960314cde7558cd630b0e6dc))

### Features

- add Prettier for consistent code formatting ([3989ed4](https://github.com/armitage-labs/creem-betterauth/commit/3989ed4574bd61dd67b82bb9b8b762830b650923))
- add Prettier for consistent code formatting ([#15](https://github.com/armitage-labs/creem-betterauth/issues/15)) ([fa9b16b](https://github.com/armitage-labs/creem-betterauth/commit/fa9b16b74938f5f4ce57fdce75bc29d02859b8a2))
- add structured logging, fix subscription status mapping, clean up JSDoc ([9f4103d](https://github.com/armitage-labs/creem-betterauth/commit/9f4103d93d4be7e249f78ffd04b33007a02ab878))
- add unit and integration tests with vitest ([720f03f](https://github.com/armitage-labs/creem-betterauth/commit/720f03fba89c008e9e5846057ed6520edfb3ab88))
- add unit and integration tests with vitest ([#16](https://github.com/armitage-labs/creem-betterauth/issues/16)) ([1839089](https://github.com/armitage-labs/creem-betterauth/commit/18390898eff0e7b4c207e6bf9db284c533ba1310))
- bug fixes and adjustments ([bd59973](https://github.com/armitage-labs/creem-betterauth/commit/bd5997399458530bae8c9b932d59d3c8229fcbac))
- example app added ([595a212](https://github.com/armitage-labs/creem-betterauth/commit/595a212ab869f6227f80d8ed489c3d8606f5a4c4))
- migrate to Creem SDK v1 namespaced API ([26a84c5](https://github.com/armitage-labs/creem-betterauth/commit/26a84c55b2e7d7bad620f094945cf2e1501b1f04))
- structured logging, example app, bug fixes, and docs overhaul ([#17](https://github.com/armitage-labs/creem-betterauth/issues/17)) ([69b9592](https://github.com/armitage-labs/creem-betterauth/commit/69b95928be0d5fdc94a3c7e3a649f57d5c10b6a8))
- Trial abuse prevention enhancements ([ed73dde](https://github.com/armitage-labs/creem-betterauth/commit/ed73dde02b7b92494b7c1ede3717e93888a2bf06))
- update plugin to use new SDK version ([9f38d65](https://github.com/armitage-labs/creem-betterauth/commit/9f38d6531d93df703d8a3ebbdce386df80dda24d))

### BREAKING CHANGES

- Updated from Creem SDK v0.4.x to v1.3.x

API migration:

- creem.createCheckout() → creem.checkouts.create()
- creem.retrieveSubscription() → creem.subscriptions.get()
- creem.cancelSubscription() → creem.subscriptions.cancel()
- creem.searchTransactions() → creem.transactions.search()
- Portal: raw fetch → creem.customers.generateBillingLinks()

Other changes:

- API key now passed in constructor instead of per-request xApiKey
- Flattened checkout request params (no more createCheckoutRequest wrapper)
- Positional params for transactions.search()
- Bumped version to 0.1.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Improved developer experience: Plugin now logs a warning instead of throwing a fatal error when Creem API key is missing during initialization
- API endpoints (`createCheckout`, `createPortal`, `cancelSubscription`, `retrieveSubscription`, `searchTransactions`) now return clear error messages when called without an API key configured
- Projects can now run without a Creem API key until Creem functionality is actually used, improving developer velocity
- Replaced duplicate `Subscription` interface across 4 files with shared `SubscriptionRecord` in `types.ts`
- Removed unused `baseUrl` option from `CreemOptions`
- Structured logging: all log messages use Better Auth's logger with `[creem]` prefix instead of `console.error`

### Fixed

- Client plugin missing `pathMethods` for `cancel-subscription`, `retrieve-subscription`, and `search-transactions` endpoints (caused 404 errors when called from the client)
- `has-active-subscription` endpoint now checks `past_due` status for period-end grace access
- `has-active-subscription` endpoint no longer leaks internal error messages in 500 responses
- `createCheckout` server utility now throws an error instead of returning empty string when Creem API returns no checkout URL
- Fixed JSDoc import path from `"./lib/creem-betterauth"` to `"@creem_io/better-auth"`

### Added

- Initial release of `@creem_io/better-auth`
- Better Auth plugin for Creem payment integration
- Client-side methods for checkout, portal, subscriptions, and transactions
- Server-side utilities for direct API access
- Database persistence mode for fast access checks
- API mode for database-free operation
- Webhook handlers with signature verification
- Comprehensive TypeScript types and JSDoc documentation
- Enhanced client wrapper for cleaner type hints
- Dual-mode support (database vs API)
- Access control handlers (onGrantAccess, onRevokeAccess)
- 183 unit and integration tests with Vitest
- Runnable Next.js example app in `examples/nextjs/`
- pnpm workspace support for local development

## [0.0.1] - 2024-11-05

### Added

- Initial release
