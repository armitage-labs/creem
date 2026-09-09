---
"@creem_io/better-auth": minor
---

Handle `subscription.scheduled_cancel` with an optional `onSubscriptionScheduledCancel` callback, persist the scheduled status and `cancelAtPeriodEnd`, and retain access only until the current period ends. Synchronize the cancellation flag when cancellation is undone or finalized.

Canceled subscriptions now invoke `onRevokeAccess` with `subscription_canceled` and no longer grant access through a future stored period end. Existing revoke handlers receive an additional event; update exhaustive reason checks and keep callbacks idempotent. Scheduled cancellation does not invoke grant or revoke callbacks.
