<script lang="ts">
  /* global $props */
  import type { Snippet } from "svelte";
  import CheckoutButton from "./CheckoutButton.svelte";

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
</script>

<CheckoutButton
  {productId}
  {href}
  {disabled}
  {className}
  {onCheckout}
>
  {#if children}
    {@render children()}
  {:else}
    Buy now
  {/if}
</CheckoutButton>
