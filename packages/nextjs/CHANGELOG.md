# Changelog

All notable changes to this project will be documented in this file.

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
