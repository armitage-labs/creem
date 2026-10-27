<!--
  @component
  One-line explanation in a `BillingEmail.Root` form. The input references it
  with `aria-describedby`.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<HTMLAttributes<HTMLParagraphElement>, "class" | "id" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
    /** Custom description text. */
    children?: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
  $effect(() => ctx.registerPart("description"));
</script>

<p
  {...rest}
  id={ctx.ids.description}
  class={resolveBillingEmailClass(
    ctx,
    "creem-base:body-m creem-base:text-foreground-muted",
    className,
  )}
>
  {#if children}
    {@render children()}
  {:else}
    {ctx.labels.description}
  {/if}
</p>
