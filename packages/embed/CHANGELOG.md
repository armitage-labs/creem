# @creem_io/embed

## 0.2.1

### Patch Changes

- 5360f99: Refresh the embedded checkout modal to match the hosted loader: cleaner surface (no coral edge/glow), the close button now sits above the modal (right-aligned), a slightly darker backdrop, and the merchant page's scroll is locked while the modal is open (with overscroll containment so wheel/trackpad never chains through to the page behind it). The framework wrappers (`@creem_io/react`, `/vue`, `/svelte`) pick this up through their `@creem_io/embed` dependency.

## 0.2.0

### Minor Changes

- 8e30c8e: Initial release: embedded checkout SDKs. Framework-agnostic core (`@creem_io/embed`) plus React, Vue, and Svelte wrappers — first-class components for all three frameworks (Svelte also ships `{@attach}` attachments + `use:` actions), overlay + inline modes, `ready`/`completed` lifecycle events, and `theme`/`locale` options. On completion the page auto-navigates to the product's Return URL when one is set.

### Patch Changes

- 8e30c8e: Embedded checkout overlay now closes only via the explicit ✕ button — backdrop-click and Escape no longer dismiss it, so a customer can't accidentally lose an in-progress payment by clicking outside the modal.
