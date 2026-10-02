<!--
  @component
  The email input of a `BillingEmail.Root` form, bound to the draft.
-->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { billingEmailInputDescribedBy } from "../../core/billingEmail.js";
  import {
    getBillingEmailContext,
    resolveBillingEmailClass,
  } from "./billingEmailContext.js";

  interface Props
    extends Omit<
      HTMLInputAttributes,
      "class" | "id" | "type" | "value" | "oninput" | "disabled" | "children"
    > {
    /** CSS class added to the part's defaults. */
    class?: string;
  }

  let {
    class: className = "",
    placeholder = undefined,
    name = "billingEmail",
    autocomplete = "email",
    onblur = undefined,
    ...rest
  }: Props = $props();
  const ctx = getBillingEmailContext();
</script>

<input
  {...rest}
  {name}
  {autocomplete}
  placeholder={placeholder ?? ctx.labels.placeholder}
  type="email"
  id={ctx.ids.input}
  aria-label={ctx.parts.label ? undefined : ctx.labels.inputLabel}
  aria-invalid={ctx.isInvalid}
  aria-describedby={billingEmailInputDescribedBy(ctx)}
  value={ctx.state.draft}
  disabled={ctx.state.status !== "ready" || ctx.state.saving}
  oninput={(event) => ctx.setDraft(event.currentTarget.value)}
  onblur={(event) => {
    onblur?.(event);
    ctx.markTouched();
  }}
  class={resolveBillingEmailClass(
    ctx,
    "creem-base:input-default creem-base:w-full",
    className,
  )}
/>
