<!--
  @component
  Success banner for the post-checkout return page.

  Parses Creem's query parameters from the URL unless you pass `params` or
  `search` explicitly.
-->
<script lang="ts">
  /* global $props, $derived */
  import {
    hasCheckoutSuccessParams,
    parseCheckoutSuccessParams,
  } from "../../core/payments.js";
  import type { CheckoutSuccessParams } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
    params?: CheckoutSuccessParams;
    search?: string;
    class?: string;
    labels?: BillingLabels;
  }

  let {
    params = undefined,
    search = "",
    class: className = "",
    labels = defaultBillingLabels,
  }: Props = $props();

  const parsed = $derived(params ?? parseCheckoutSuccessParams(search));
  const show = $derived(hasCheckoutSuccessParams(parsed));
</script>

{#if show}
  <div
    class={`rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ${className}`}
  >
    <p class="font-medium">{labels.checkout.success}</p>
    <ul class="mt-2 space-y-1">
      {#if parsed.checkoutId}<li>Checkout: {parsed.checkoutId}</li>{/if}
      {#if parsed.orderId}<li>Order: {parsed.orderId}</li>{/if}
      {#if parsed.customerId}<li>Customer: {parsed.customerId}</li>{/if}
      {#if parsed.productId}<li>Product: {parsed.productId}</li>{/if}
      {#if parsed.requestId}<li>Request: {parsed.requestId}</li>{/if}
    </ul>
  </div>
{/if}
