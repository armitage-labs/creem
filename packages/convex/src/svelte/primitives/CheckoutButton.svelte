<!--
  @component
  Styled checkout button.

  Works in callback mode via `onCheckout` or link mode via `href`. A low-level
  primitive: inside a `Subscription.Root`, use `Subscription.ItemCTA`, which is
  wired to the root's checkout flow.
-->
<script lang="ts">
  /* global $props, $state */
  import type { Snippet } from "svelte";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
    /**
     * Creem product to check out, passed back to `onCheckout`.
     */
    productId: string;
    /**
     * Link mode: navigate straight to this URL instead of calling `onCheckout`.
     */
    href?: string;
    /**
     * Disable the button, for example while a checkout is already in flight.
     */
    disabled?: boolean;
    /**
     * CSS class for the wrapper element.
     */
    className?: string;
    /**
     * Callback mode: receives `{ productId }` when the button is pressed.
     */
    onCheckout?: (payload: { productId: string }) => Promise<void> | void;
    /**
     * Label overrides for the default button text.
     */
    labels?: BillingLabels;
    /**
     * Custom button label.
     */
    children?: Snippet;
  }

  let {
    productId,
    href = undefined,
    disabled = false,
    className = "",
    onCheckout,
    labels = defaultBillingLabels,
    children,
  }: Props = $props();

  let isLoading = $state(false);

  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || isLoading || !onCheckout) return;
    isLoading = true;
    Promise.resolve(onCheckout({ productId })).finally(() => {
      isLoading = false;
    });
  };
</script>

{#if onCheckout}
  <!--
    Disabled while in flight, not just when the caller says so: every card passes
    its own children, which hides the loading label, so without this the button
    looks idle and invites a second checkout session.
  -->
  <button
    type="button"
    class={`button-filled disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    disabled={disabled || isLoading}
    aria-busy={isLoading}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {:else}
      {isLoading ? labels.checkout.loading : labels.checkout.checkout}
    {/if}
  </button>
{:else if href}
  <a
    href={href}
    class={`button-filled ${className}`}
  >
    {#if children}
      {@render children()}
    {:else}
      {labels.checkout.checkout}
    {/if}
  </a>
{/if}
