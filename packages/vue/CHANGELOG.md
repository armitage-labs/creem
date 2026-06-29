# @creem_io/vue

## 0.2.2

### Patch Changes

- 65126ea: Persist the affiliate `creem_ref` token in first-party localStorage so embedded-checkout attribution survives internal navigation (e.g. `/` → `/pricing`) before checkout opens. Adds a `captureAffiliateRef()` helper to capture it on the landing page (re-exported from react/vue/svelte). The newer token by `iat` always wins, so a stale URL token can't clobber a fresher stored ref.
- Updated dependencies [65126ea]
  - @creem_io/embed@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [6c10cae]
  - @creem_io/embed@0.3.0

## 0.2.0

### Minor Changes

- 8e30c8e: Initial release: embedded checkout SDKs. Framework-agnostic core (`@creem_io/embed`) plus React, Vue, and Svelte wrappers — first-class components for all three frameworks (Svelte also ships `{@attach}` attachments + `use:` actions), overlay + inline modes, `ready`/`completed` lifecycle events, and `theme`/`locale` options. On completion the page auto-navigates to the product's Return URL when one is set.

### Patch Changes

- Updated dependencies [8e30c8e]
- Updated dependencies [8e30c8e]
  - @creem_io/embed@0.2.0
