<!--
  @component
  Heading of a `BillingEmail.Root` form. Names the form for assistive technology.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<HTMLAttributes<HTMLHeadingElement>, "class" | "id" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
    /** Custom heading text. */
    children?: Snippet;
  }

  let { class: className = "", children, ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
  $effect(() => ctx.registerPart("title"));
</script>

<h3
  {...rest}
  id={ctx.ids.title}
  class={resolveBillingEmailClass(
    ctx,
    "creem-base:title-s creem-base:text-foreground-default",
    className,
  )}
>
  {#if children}
    {@render children()}
  {:else}
    {ctx.labels.title}
  {/if}
</h3>
