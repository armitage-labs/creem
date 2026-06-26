---
"@creem_io/embed": patch
---

Embedded checkout: calling `close()` inside `onComplete` now cancels the post-payment redirect.

The completion handler previously scheduled the ~3s top-window redirect *after* invoking `onComplete`, so a merchant calling `checkout.close()` inside `onComplete` hit the timer cleanup before the timer existed (a no-op) and the redirect fired anyway — navigating a customer who had explicitly closed the modal. The redirect timer is now scheduled *before* `onComplete`, so `close()`'s cleanup cancels a live timer. Default behavior (no `close()` → redirect to the product Return URL after ~3s) is unchanged.

Re-exported by `@creem_io/react`, `@creem_io/vue`, and `@creem_io/svelte`, which pick up the fix on their next release.
