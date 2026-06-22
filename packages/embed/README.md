# @creem_io/embed

Framework-agnostic core for embedding [Creem](https://creem.io) checkout — modal overlay or inline. The runtime behind `@creem_io/react`, `@creem_io/vue`, and `@creem_io/svelte`. Use it directly in vanilla JS, or reach for a framework wrapper.

```bash
npm install @creem_io/embed
```

```ts
import { openCheckout, CreemEmbedCheckout, mount } from "@creem_io/embed";

// Overlay
openCheckout({ checkoutUrl, theme: "light", onComplete: (d) => {} });

// Inline
mount({ checkoutUrl, container: document.getElementById("checkout")!, onComplete: (d) => {} });

// Programmatic
const checkout = await CreemEmbedCheckout.create({ checkoutUrl, onComplete: (d) => checkout.close() });
```

Get `checkoutUrl` from the [Checkout API](https://docs.creem.io/features/checkout/checkout-api). `onComplete` receives `{ checkoutId, orderId, orderNo, redirect, redirectUrl }` — `redirect` is `true` when the checkout has a success/return URL configured, in which case the embed navigates the top window to `redirectUrl` automatically once payment completes. Handle `onComplete` to run your own post-payment logic instead.
