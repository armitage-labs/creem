# @creem_io/svelte

Svelte actions to embed [Creem](https://creem.io) checkout — modal overlay or inline.

```bash
npm install @creem_io/svelte
```

## Overlay

```svelte
<script>
  import { creemCheckout } from "@creem_io/svelte";
  const checkoutUrl = "https://www.creem.io/checkout/<productId>/<checkoutId>";
</script>

<button use:creemCheckout={{ checkoutUrl, theme: "light", onComplete: (d) => console.log("paid!", d) }}>
  Subscribe
</button>
```

## Inline

```svelte
<div use:creemCheckoutInline={{ checkoutUrl, onComplete }} style="height:820px" />
```

## Programmatic

```ts
import { openCheckout, CreemEmbedCheckout } from "@creem_io/svelte";

openCheckout({ checkoutUrl, onComplete });
const checkout = await CreemEmbedCheckout.create({ checkoutUrl, onComplete: (d) => checkout.close() });
```

`onComplete` receives `{ checkoutId, orderId, orderNo, redirect, redirectUrl }`. Pass `redirect: true` to auto-navigate to the success URL on completion. Get `checkoutUrl` from the [Checkout API](https://docs.creem.io/features/checkout/checkout-api).
