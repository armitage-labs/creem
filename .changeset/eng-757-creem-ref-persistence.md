---
"@creem_io/embed": patch
"@creem_io/react": patch
"@creem_io/vue": patch
"@creem_io/svelte": patch
---

Persist the affiliate `creem_ref` token in first-party localStorage so embedded-checkout attribution survives internal navigation (e.g. `/` → `/pricing`) before checkout opens. Adds a `captureAffiliateRef()` helper to capture it on the landing page (re-exported from react/vue/svelte). The newer token by `iat` always wins, so a stale URL token can't clobber a fresher stored ref.
