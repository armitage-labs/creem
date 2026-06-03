# @creem_io/vue

Vue 3 components + SDK to embed [Creem](https://creem.io) checkout — modal overlay or inline.

```bash
npm install @creem_io/vue
```

## Declarative

```vue
<script setup>
import { CreemCheckout } from "@creem_io/vue";
</script>

<template>
  <CreemCheckout
    checkout-url="https://www.creem.io/checkout/<productId>/<checkoutId>"
    theme="light"
    @complete="(detail) => console.log('paid!', detail)"
  >
    <button>Subscribe</button>
  </CreemCheckout>
</template>
```

## Inline

```vue
<CreemCheckoutInline :checkout-url="checkoutUrl" @complete="onComplete" />
```

## Composable / programmatic

```ts
import { useCreemCheckout, CreemEmbedCheckout } from "@creem_io/vue";

const openCheckout = useCreemCheckout();
openCheckout({ checkoutUrl, onComplete });

const checkout = await CreemEmbedCheckout.create({ checkoutUrl, onComplete: (d) => checkout.close() });
```

`@complete` (and `onComplete`) receives `{ checkoutId, orderId, orderNo, redirect, redirectUrl }`. Pass `:redirect="true"` to auto-navigate to the success URL on completion. Get `checkoutUrl` from the [Checkout API](https://docs.creem.io/features/checkout/checkout-api).
