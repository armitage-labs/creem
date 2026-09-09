---
"@creem_io/better-auth": major
---

Handle `subscription.scheduled_cancel` with an optional `onSubscriptionScheduledCancel` callback, persist the scheduled status and `cancelAtPeriodEnd`, and retain access only until the current period ends. Synchronize the cancellation flag when cancellation is undone or finalized.

Ignore delayed scheduled-cancellation updates for subscriptions already stored as canceled or expired, including a terminal event received during the database update. Ignored `subscription.scheduled_cancel` events do not invoke `onSubscriptionScheduledCancel`.

**Breaking changes:** Canceled subscriptions no longer grant access through `hasAccessGranted()`, including existing records. Upgrading does not replay revoke callbacks. New `subscription.canceled` deliveries invoke `onRevokeAccess` with the additional `subscription_canceled` reason before `onSubscriptionCanceled`.

Follow the [1.x to 2.0 migration guide](https://docs.creem.io/code/sdks/better-auth/migration#upgrading-from-1-x) to update callbacks and exhaustive reason checks, reconcile existing entitlements, and verify the upgrade. No database schema migration is required; existing cancellation flags are not automatically backfilled.
