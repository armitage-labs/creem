<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    /** Badge label override. Defaults to current/recommended labels when applicable. */
    label?: string;
    /** Badge CSS class. */
    class?: string;
    /** Optional custom badge content. */
    children?: import("svelte").Snippet;
  }

  let {
    label = undefined,
    class: className = "",
    children,
  }: Props = $props();

  const ctx = getSubscriptionItemContext();
  const text = $derived(
    label ??
      (ctx.isActive
        ? ctx.labels.subscription.current
        : ctx.isRecommended
          ? ctx.labels.subscription.recommended
          : null),
  );
  const show = $derived(text != null || children != null);
  const resolvedClass = $derived(
    ctx.unstyled
      ? className
      : `creem-base:inline-block creem-base:rounded-full creem-base:bg-blue-100 creem-base:px-2.5 creem-base:py-0.5 creem-base:text-xs creem-base:font-medium creem-base:text-blue-800 dark:creem-base:bg-blue-900/30 dark:creem-base:text-blue-300 ${className}`,
  );
</script>

{#if show}
  <span class={resolvedClass}>
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </span>
{/if}
