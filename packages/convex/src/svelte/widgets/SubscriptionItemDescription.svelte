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
      : `creem-base:text-sm creem-base:text-zinc-500 dark:creem-base:text-zinc-400 ${className}`,
  );
</script>

{#if ctx.plan.description}
  <p class={resolvedClass}>
    {ctx.plan.description}
  </p>
{/if}
