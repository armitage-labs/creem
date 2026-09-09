# @creem_io/react

React components + SDK to embed [Creem](https://creem.io) checkout directly in your app — as a modal overlay or inline.

## Install

```bash
npm install @creem_io/react
```

## Getting a checkout URL

Create a checkout session server-side with your secret API key ([Checkout API](https://docs.creem.io/features/checkout/checkout-api)) and pass the returned `checkout_url` to these components. The URL is safe to expose; completion is confirmed server-side via webhook.

## 1. Declarative

Wrap any clickable element — clicking opens the checkout overlay.

```tsx
import { CreemCheckout } from "@creem_io/react";

export function Pricing() {
  return (
    <CreemCheckout
      checkoutUrl="https://www.creem.io/checkout/<productId>/<checkoutId>"
      theme="light"
      onComplete={(detail) => console.log("paid!", detail)}
    >
      <button>Subscribe</button>
    </CreemCheckout>
  );
}
```

## 2. Programmatic

```ts
import { CreemEmbedCheckout } from "@creem_io/react";

const checkout = await CreemEmbedCheckout.create({
  checkoutUrl,
  theme: "dark",
  onComplete: (detail) => {
    // detail = { checkoutId, orderId, orderNo }
    checkout.close();
  },
});
```

Or the hook:

```tsx
import { useCreemCheckout } from "@creem_io/react";

const openCheckout = useCreemCheckout();
openCheckout({ checkoutUrl, onComplete });
```

## 3. Inline

```tsx
import { CreemCheckoutInline } from "@creem_io/react";

<CreemCheckoutInline
  checkoutUrl={checkoutUrl}
  onComplete={(detail) => unlock(detail.orderId)}
  style={{ width: 460, height: 820 }}
/>;
```

## Options

All components accept `theme` (`'light' | 'dark'`) and `locale` (BCP47 tag, e.g. `'pt-BR'`, to force the checkout language). They also emit a `ready` event (`onReady`) once the checkout UI has rendered. On completion, if the product has a Return URL, the page navigates there automatically — handle `onComplete` for custom behavior.

## `onComplete` payload

```ts
{ checkoutId: string; orderId?: string; orderNo?: string; redirect?: boolean; redirectUrl?: string }
```

Fired when the embedded checkout finishes successfully. The SDK only accepts the completion event from the checkout's own origin.
