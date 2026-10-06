<!--
  @component
  Submit button of a `BillingEmail.Root` form. Disabled until the draft is a
  valid, changed address.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<HTMLButtonAttributes, "class" | "type" | "disabled" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
    /** Custom button label. */
    children?: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
</script>

<button
  {...rest}
  type="submit"
  disabled={!ctx.canSave}
  class={resolveBillingEmailClass(
    ctx,
    "creem-base:button-filled creem-base:cursor-pointer disabled:creem-base:cursor-not-allowed disabled:creem-base:opacity-60",
    className,
  )}
>
  {#if children}
    {@render children()}
  {:else}
    {ctx.state.saving ? ctx.labels.saving : ctx.labels.save}
  {/if}
</button>
