<!--
  @component
  Loading and saved messages of a `BillingEmail.Root` form, announced politely.
-->
<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<HTMLAttributes<HTMLParagraphElement>, "class" | "role" | "children"> {
    /** CSS class added to the part's defaults. */
    class?: string;
  }

  let { class: className = "", ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
</script>

{#if ctx.isLoading}
  <p
    {...rest}
    role="status"
    class={resolveBillingEmailClass(
      ctx,
      "creem-base:body-s creem-base:text-foreground-placeholder",
      className,
    )}
  >
    {ctx.labels.loading}
  </p>
{:else if ctx.state.saved}
  <p
    {...rest}
    role="status"
    class={resolveBillingEmailClass(
      ctx,
      "creem-base:body-s creem-base:text-success-foreground-default",
      className,
    )}
  >
    {ctx.labels.saved}
  </p>
{/if}
