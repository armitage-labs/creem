<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    class?: string;
  }

  let { class: className = "" }: Props = $props();
  const ctx = getSubscriptionItemContext();
  const resolvedClass = $derived(
    ctx.unstyled ? className : `creem-base:text-2xl creem-base:font-bold ${className}`,
  );
</script>

{#if ctx.price}
  <p class={resolvedClass}>{ctx.price}</p>
{/if}
