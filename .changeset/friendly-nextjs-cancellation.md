---
"@creem_io/nextjs": minor
---

Invoke `onRevokeAccess` with reason `subscription_canceled` when a `subscription.canceled` webhook arrives, before `onSubscriptionCanceled`. Scheduled cancellation events continue to leave access unchanged.

Previously, cancellation only called `onSubscriptionCanceled`. Existing `onRevokeAccess` handlers now also receive cancellation events. When upgrading, update exhaustive reason checks to handle `subscription_canceled`. If both callbacks revoke access, consolidate that logic in `onRevokeAccess` or ensure the operation is idempotent.

Both callbacks remain optional. The adapter awaits revocation before calling `onSubscriptionCanceled`; a failed revoke callback returns an error for retry before the event-specific callback runs.
