<script lang="ts">
  import { getContext } from "svelte";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";

  interface Props {
    value: string;
    label: string;
    children?: import("svelte").Snippet;
  }

  let {
    value,
    label: _label,
    children,
  }: Props = $props();
  const rootContext = getContext<SubscriptionContextValue | undefined>(
    SUBSCRIPTION_CONTEXT_KEY,
  );
  const visible = $derived(
    !rootContext ||
      rootContext.activeGroupId() == null ||
      rootContext.activeGroupId() === value,
  );
</script>

{#if visible && children}
  {@render children()}
{/if}
