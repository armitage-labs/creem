<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    /** Button CSS class. */
    class?: string;
    /** Cancel button label override. */
    label?: string;
  }

  let { class: className = "", label = undefined }: Props =
    $props();

  const ctx = getSubscriptionItemContext();
  const resolvedClass = $derived(
    ctx.unstyled
      ? className
      : `creem-base:button-outline creem-base:w-full ${className}`,
  );
</script>

{#if ctx.isActive && ctx.onCancelSubscription}
  <button type="button" class={resolvedClass} onclick={ctx.onCancelSubscription}>
    {label ?? ctx.labels.subscription.cancelSubscription}
  </button>
{/if}
