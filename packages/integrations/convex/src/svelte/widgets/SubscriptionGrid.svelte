<script lang="ts">
  import { getContext } from "svelte";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";
  import { subscriptionGridClasses } from "../../core/gridColumns.js";

  interface Props {
    class?: string;
    children?: import("svelte").Snippet;
  }

  let { class: className = "", children }: Props = $props();
  const rootContext = getContext<SubscriptionContextValue | undefined>(
    SUBSCRIPTION_CONTEXT_KEY,
  );
  const resolvedClass = $derived(
    rootContext?.getUnstyled()
      ? className
      : `${subscriptionGridClasses(rootContext?.getColumns() ?? "auto")} ${className}`,
  );
</script>

<div class={resolvedClass}>
  {#if children}
    {@render children()}
  {/if}
</div>
