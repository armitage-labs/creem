---
"@creem_io/better-auth": patch
---

Await user-facing webhook callbacks so async work completes on serverless

User-facing callbacks (`onCheckoutCompleted`, `onSubscriptionActive`, `onGrantAccess`, `onRevokeAccess`, etc.) were invoked without `await`, causing returned Promises to be silently dropped on serverless runtimes (Cloudflare Workers, Vercel Edge) where the worker terminates before async DB writes / API calls complete. Callback signatures in `CreemOptions` are widened from `=> void` to `=> void | Promise<void>` to match the JSDoc examples (which already showed `async` callbacks).

Credit: original fix by @nirgn975 in armitage-labs/creem-betterauth#20.
