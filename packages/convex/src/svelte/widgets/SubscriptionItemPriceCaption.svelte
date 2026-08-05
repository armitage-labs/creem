<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    class?: string;
  }

  let { class: className = "" }: Props = $props();
  const ctx = getSubscriptionItemContext();
  const resolvedClass = $derived(
    ctx.unstyled
      ? className
      : `creem-base:text-sm creem-base:text-foreground-placeholder ${className}`,
  );
</script>

{#if ctx.priceCaption}
  <p class={resolvedClass}>{ctx.priceCaption}</p>
{/if}
