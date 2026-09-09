---
"@creem_io/better-auth": major
---

Handle `subscription.scheduled_cancel` with an optional `onSubscriptionScheduledCancel` callback, persist the scheduled status and `cancelAtPeriodEnd`, and retain access only until the current period ends. Synchronize the cancellation flag when cancellation is undone or finalized.

Ignore delayed scheduled-cancellation updates for subscriptions already stored as canceled or expired, including a terminal event received during the database update. Ignored `subscription.scheduled_cancel` events do not invoke `onSubscriptionScheduledCancel`.

### Upgrade notes

- Canceled subscriptions no longer grant access through `hasAccessGranted()`. This applies immediately to existing stored canceled records, including those with a future period end. Upgrading does not replay webhooks or invoke `onRevokeAccess` for those records. Before deploying, reconcile any separately managed entitlements with the subscription's current state in Creem.
- New `subscription.canceled` deliveries invoke `onRevokeAccess` with the new `subscription_canceled` reason before `onSubscriptionCanceled`. Update exhaustive reason checks. If both callbacks revoke access, consolidate that logic in `onRevokeAccess` or make it idempotent. Scheduled cancellation does not invoke grant or revoke callbacks.
- Subscription webhooks and checkout writes synchronize `cancelAtPeriodEnd` from the subscription status. Existing records are not automatically backfilled; the flag may remain unset or stale until a subsequent event updates the record. Access checks use status and period end, not this flag.
