---
"@creem_io/nextjs": patch
---

Invoke `onRevokeAccess` with reason `subscription_canceled` when a `subscription.canceled` webhook arrives, before `onSubscriptionCanceled`. Scheduled cancellation events continue to leave access unchanged.

This changes existing revoke handlers: they now receive cancellation events, including cancellations with a future period end. Update exhaustive reason checks and consolidate duplicate revocation logic if you also handle `onSubscriptionCanceled`. Both callbacks remain optional; a failed revoke callback returns an error for retry before the event-specific callback runs.
