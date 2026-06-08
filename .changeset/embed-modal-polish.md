---
"@creem_io/embed": patch
---

Refresh the embedded checkout modal to match the hosted loader: cleaner surface (no coral edge/glow), the close button now sits above the modal (right-aligned), a slightly darker backdrop, and the merchant page's scroll is locked while the modal is open (with overscroll containment so wheel/trackpad never chains through to the page behind it). The framework wrappers (`@creem_io/react`, `/vue`, `/svelte`) pick this up through their `@creem_io/embed` dependency.
