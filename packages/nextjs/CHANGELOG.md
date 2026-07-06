# Changelog

## 0.5.2

### Patch Changes

- bb581ac: Bump creem SDK dependency to 1.5.3

## 0.5.1

### Patch Changes

- a979bc4: Bump creem SDK dependency to 1.5.1

All notable changes to this project will be documented in this file.

## [0.5.1] - 2026-06-04

### Added

- Handle the `subscription.scheduled_cancel` webhook event with a new `onSubscriptionScheduledCancel` callback. Previously this event fell through to the default branch and the route responded with `400 Unknown event type`.

### Fixed

- Clarified `onRevokeAccess` documentation: access is revoked for `paused` and `expired` subscriptions only.

## [0.5.0] - 2025-01-27

### Added

- `checkoutPath` prop to `<CreemCheckout />` for custom API route paths (default: `/checkout`)
- `portalPath` prop to `<CreemPortal />` for custom API route paths (default: `/portal`)
- `customFields` prop to `<CreemCheckout />` for passing custom fields to checkout

### Changed

- Upgraded Creem SDK to v1.3.6+ with new API methods
- Updated SDK initialization to use `serverIdx` instead of `serverURL`
- Changed checkout API from `createCheckout` to `checkouts.create`
- Changed portal API from `createBillingPortalSession` to `customers.createBillingPortalSession`
- Fixed type: `customField` renamed to `customFields` to match SDK

### Fixed

- Example imports now use correct package name `@creem_io/nextjs`

## [0.4.0] - 2025-01-26

### Added

- Initial public release
- `<CreemCheckout />` client component for checkout flows
- `<CreemPortal />` client component for customer portal
- `Checkout()` server function for handling checkout API routes
- `Portal()` server function for handling portal API routes
- `Webhook()` server function for handling webhooks with signature verification
- Access management helpers: `onGrantAccess` and `onRevokeAccess` callbacks
- Full TypeScript support with comprehensive types
