<!--
  @component
  Visible label for the `BillingEmail.Input`. Without it the input is named by
  the `inputLabel` text through `aria-label`.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLabelAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props extends Omit<HTMLLabelAttributes, "class" | "for" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
    /** Custom label text. */
    children?: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
  $effect(() => ctx.registerPart("label"));
</script>

<label
  {...rest}
  for={ctx.ids.input}
  class={resolveBillingEmailClass(
    ctx,
    "creem-base:label-m creem-base:text-foreground-default",
    className,
  )}
>
  {#if children}
    {@render children()}
  {:else}
    {ctx.labels.inputLabel}
  {/if}
</label>
