# 1.0.0 (2026-03-09)

### Bug Fixes

- **sdk:** bump User-Agent to 0.5.0 ([2b86358](https://github.com/armitage-labs/creem_io/commit/2b86358926abf378a309614f3b32086d7aa37464))
- semantic release version ([#6](https://github.com/armitage-labs/creem_io/issues/6)) ([65d4201](https://github.com/armitage-labs/creem_io/commit/65d42016e858a2098a4b5b5fbf0afc3904484cc5))

### Features

- Moved to pnpm and added linter ([#4](https://github.com/armitage-labs/creem_io/issues/4)) ([23fcb83](https://github.com/armitage-labs/creem_io/commit/23fcb83de0fc264468ba236818aa6bab6184ba01))
- **sdk:** add type exports, pause/resume methods, and scheduled_cancel webhook ([2aabe8d](https://github.com/armitage-labs/creem_io/commit/2aabe8d71fce126ef5483b3aaaaadd7ab3d9d9e1)), closes [#2](https://github.com/armitage-labs/creem_io/issues/2)

# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-02-05

### Added

- **Type Exports**: All types are now exported from the package root. Import directly: `import { Customer, Product, Subscription } from 'creem_io'`
- **Pause/Resume Subscription Methods**: New `subscriptions.pause()` and `subscriptions.resume()` methods for subscription lifecycle management
- **Scheduled Cancel Webhook**: Added `onSubscriptionScheduledCancel` handler for `subscription.scheduled_cancel` events

## [0.4.0] - Previous Release

Initial public release.
