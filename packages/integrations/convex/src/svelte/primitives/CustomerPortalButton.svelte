<!--
  @component
  Styled button for opening the customer billing portal.

  A low-level primitive that calls nothing on its own. `BillingPortal` is the
  connected widget that resolves the portal URL for you.
-->
<script lang="ts">
  /* global $props, $state */
  import type { Snippet } from "svelte";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
    href?: string;
    disabled?: boolean;
    className?: string;
    onOpenPortal?: () => Promise<void> | void;
    labels?: BillingLabels;
    children?: Snippet;
  }

  let {
    href = undefined,
    disabled = false,
    className = "",
    onOpenPortal,
    labels = defaultBillingLabels,
    children,
  }: Props = $props();

  let isLoading = $state(false);

  const handleClick = async () => {
    if (disabled || isLoading || !onOpenPortal) return;
    isLoading = true;
    try {
      await onOpenPortal();
    } finally {
      isLoading = false;
    }
  };
</script>

{#if onOpenPortal}
  <button
    type="button"
    class={`${className || "button-outline"} disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer`}
    {disabled}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {:else}
      {isLoading ? labels.portal.loading : labels.portal.manageBilling}
    {/if}
  </button>
{:else}
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    class={`${className || "button-outline"}`}
  >
    {#if children}
      {@render children()}
    {:else}
      {labels.portal.manageBilling}
    {/if}
  </a>
{/if}
