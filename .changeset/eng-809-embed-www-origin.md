---
"@creem_io/embed": patch
---

Fix embedded checkout not redirecting back to the merchant after payment (ENG-809). The postMessage origin check now folds a leading `www.`, so when the checkout URL is on the apex host (`https://creem.io`) and production 308-redirects it to `https://www.creem.io`, the iframe's `ready`/`completed` events are still accepted and the post-payment redirect fires. Protocol and port stay strict, so this does not widen trust to any unrelated host. The React/Vue/Svelte wrappers pick this up through their `@creem_io/embed` dependency.
