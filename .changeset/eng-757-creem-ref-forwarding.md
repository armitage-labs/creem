---
"@creem_io/embed": minor
---

Forward the `creem_ref` affiliate token from the merchant page into the checkout iframe URL. Embedded checkout (`openCheckout` / `mount`, and the React/Vue/Svelte wrappers) now attributes the affiliate in every browser — including Safari (ITP), Firefox (TCP), and Chrome incognito, where the third-party affiliate cookie is dropped inside the iframe. The token is read from the merchant page's `?creem_ref=` query param and appended to the checkout URL. No public API change.
