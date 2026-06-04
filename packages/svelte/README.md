# @creem_io/svelte

Svelte components (+ low-level attachment / action APIs) to embed [Creem](https://creem.io) checkout — modal overlay or inline.

```bash
npm install @creem_io/svelte
```

## Components (recommended)

```svelte
<script>
  import { CreemCheckout, CreemCheckoutInline } from "@creem_io/svelte";
  const checkoutUrl = "https://www.creem.io/checkout/<productId>/<checkoutId>";
  const onComplete = (d) => console.log("paid!", d);
</script>

<!-- Overlay — wrap any clickable element -->
<CreemCheckout {checkoutUrl} {onComplete}>
  <button>Subscribe</button>
</CreemCheckout>

<!-- Inline -->
<CreemCheckoutInline {checkoutUrl} {onComplete} style="height:820px" />
```

All accept `theme` (`'light' | 'dark'`) and `locale` (BCP47 tag). On completion, if the product has a Return URL, the page navigates there automatically — handle `onComplete` for custom behavior.

## Low-level

**Attachments** (Svelte 5.29+) — the modern low-level API:

```svelte
<script>
  import { creemCheckoutAttach, creemCheckoutInlineAttach } from "@creem_io/svelte";
</script>

<button {@attach creemCheckoutAttach({ checkoutUrl, onComplete })}>Subscribe</button>
<div {@attach creemCheckoutInlineAttach({ checkoutUrl, onComplete })} style="height:820px"></div>
```

**Actions** (`use:`) — for Svelte 4:

```svelte
<button use:creemCheckout={{ checkoutUrl, onComplete }}>Subscribe</button>
<div use:creemCheckoutInline={{ checkoutUrl, onComplete }} style="height:820px" />
```

**Programmatic:**

```ts
import { openCheckout, CreemEmbedCheckout } from "@creem_io/svelte";

openCheckout({ checkoutUrl, onComplete });
const checkout = await CreemEmbedCheckout.create({ checkoutUrl, onComplete: (d) => checkout.close() });
```

`onComplete` receives `{ checkoutId, orderId, orderNo, redirect, redirectUrl }`. Get `checkoutUrl` from the [Checkout API](https://docs.creem.io/features/checkout/checkout-api).
