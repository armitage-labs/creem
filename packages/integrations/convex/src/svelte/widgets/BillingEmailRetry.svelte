<!--
  @component
  Reload button of a `BillingEmail.Root` form, shown only after the current
  email failed to load.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<HTMLButtonAttributes, "class" | "type" | "onclick" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
    /** Custom button label. */
    children?: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
</script>

{#if ctx.state.status === "load-error"}
  <button
    {...rest}
    type="button"
    onclick={() => ctx.reload()}
    class={resolveBillingEmailClass(
      ctx,
      "creem-base:button-outline creem-base:cursor-pointer",
      className,
    )}
  >
    {#if children}
      {@render children()}
    {:else}
      {ctx.labels.retry}
    {/if}
  </button>
{/if}
