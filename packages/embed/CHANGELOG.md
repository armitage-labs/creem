# @creem_io/embed

## 0.3.3

### Patch Changes

- 0c878d1: Embedded checkout: calling `close()` inside `onComplete` now cancels the post-payment redirect.

  The completion handler previously scheduled the ~3s top-window redirect _after_ invoking `onComplete`, so a merchant calling `checkout.close()` inside `onComplete` hit the timer cleanup before the timer existed (a no-op) and the redirect fired anyway — navigating a customer who had explicitly closed the modal. The redirect timer is now scheduled _before_ `onComplete`, so `close()`'s cleanup cancels a live timer. Default behavior (no `close()` → redirect to the product Return URL after ~3s) is unchanged.

  Re-exported by `@creem_io/react`, `@creem_io/vue`, and `@creem_io/svelte`, which pick up the fix on their next release.

## 0.3.2

### Patch Changes

- 65126ea: Persist the affiliate `creem_ref` token in first-party localStorage so embedded-checkout attribution survives internal navigation (e.g. `/` → `/pricing`) before checkout opens. Adds a `captureAffiliateRef()` helper to capture it on the landing page (re-exported from react/vue/svelte). The newer token by `iat` always wins, so a stale URL token can't clobber a fresher stored ref.

## 0.3.1

### Patch Changes

- 4f05800: Fix embedded checkout not redirecting back to the merchant after payment (ENG-809). The postMessage origin check now folds a leading `www.`, so when the checkout URL is on the apex host (`https://creem.io`) and production 308-redirects it to `https://www.creem.io`, the iframe's `ready`/`completed` events are still accepted and the post-payment redirect fires. Protocol and port stay strict, so this does not widen trust to any unrelated host. The React/Vue/Svelte wrappers pick this up through their `@creem_io/embed` dependency.

## 0.3.0

### Minor Changes

- 6c10cae: Forward the `creem_ref` affiliate token from the merchant page into the checkout iframe URL. Embedded checkout (`openCheckout` / `mount`, and the React/Vue/Svelte wrappers) now attributes the affiliate in every browser — including Safari (ITP), Firefox (TCP), and Chrome incognito, where the third-party affiliate cookie is dropped inside the iframe. The token is read from the merchant page's `?creem_ref=` query param and appended to the checkout URL. No public API change.

## 0.2.1

### Patch Changes

- 5360f99: Refresh the embedded checkout modal to match the hosted loader: cleaner surface (no coral edge/glow), the close button now sits above the modal (right-aligned), a slightly darker backdrop, and the merchant page's scroll is locked while the modal is open (with overscroll containment so wheel/trackpad never chains through to the page behind it). The framework wrappers (`@creem_io/react`, `/vue`, `/svelte`) pick this up through their `@creem_io/embed` dependency.

## 0.2.0

### Minor Changes

- 8e30c8e: Initial release: embedded checkout SDKs. Framework-agnostic core (`@creem_io/embed`) plus React, Vue, and Svelte wrappers — first-class components for all three frameworks (Svelte also ships `{@attach}` attachments + `use:` actions), overlay + inline modes, `ready`/`completed` lifecycle events, and `theme`/`locale` options. On completion the page auto-navigates to the product's Return URL when one is set.

### Patch Changes

- 8e30c8e: Embedded checkout overlay now closes only via the explicit ✕ button — backdrop-click and Escape no longer dismiss it, so a customer can't accidentally lose an in-progress payment by clicking outside the modal.
