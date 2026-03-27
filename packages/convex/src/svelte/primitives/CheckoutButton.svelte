<script lang="ts">
  /* global $props, $state */
  import type { Snippet } from "svelte";

  interface Props {
    productId: string;
    href?: string;
    disabled?: boolean;
    className?: string;
    onCheckout?: (payload: { productId: string }) => Promise<void> | void;
    children?: Snippet;
  }

  let {
    productId,
    href = undefined,
    disabled = false,
    className = "",
    onCheckout,
    children,
  }: Props = $props();

  let isLoading = $state(false);

  const handleClick = async () => {
    if (disabled || isLoading || !onCheckout) return;
    isLoading = true;
    try {
      await onCheckout({ productId });
    } finally {
      isLoading = false;
    }
  };
</script>

{#if onCheckout}
  <button
    type="button"
    class={`button-filled disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    {disabled}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {:else}
      {isLoading ? "Loading..." : "Checkout"}
    {/if}
  </button>
{:else}
  <a
    href={href}
    class={`button-filled ${className}`}
  >
    {#if children}
      {@render children()}
    {:else}
      Checkout
    {/if}
  </a>
{/if}
