<!--
  @component
  The current load or save error of a `BillingEmail.Root` form. The input
  references it while it is shown.
-->
<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<
      HTMLAttributes<HTMLParagraphElement>,
      "class" | "id" | "role" | "children"
    > {
    /** CSS class added to the part's defaults. */
    class?: string;
  }

  let { class: className = "", ...rest }: Props = $props();
  const ctx = getBillingEmailContext();
  $effect(() => ctx.registerPart("error"));
</script>

{#if ctx.errorMessage}
  <p
    {...rest}
    id={ctx.ids.error}
    role="alert"
    class={resolveBillingEmailClass(
      ctx,
      "creem-base:text-sm creem-base:text-error-foreground-default",
      className,
    )}
  >
    {ctx.errorMessage}
  </p>
{/if}
