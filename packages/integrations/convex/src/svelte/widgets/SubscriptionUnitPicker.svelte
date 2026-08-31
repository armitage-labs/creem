<script lang="ts">
  import NumberInput from "../primitives/NumberInput.svelte";
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    /** Wrapper CSS class. */
    class?: string;
    /** Class for the row containing the label and numeric input/value. */
    rowClass?: string;
    /** Class for the unit label. */
    labelClass?: string;
    /** Class for the edit action row. */
    actionsClass?: string;
    /** Class for secondary actions such as Change or Cancel. */
    secondaryClass?: string;
    /** Class for the primary update action. */
    primaryClass?: string;
    /** Class passed to the internal numeric input. */
    numberInputClass?: string;
    /** Unit label override. */
    label?: string;
    /** Change button label override. */
    changeLabel?: string;
    /** Update button label override. */
    updateLabel?: string;
    /** Cancel button label override. */
    cancelLabel?: string;
    /** Show current subscribed quantity before the change button. */
    detailed?: boolean;
  }

  let {
    class: className = "",
    rowClass: rowClassName = "",
    labelClass: labelClassName = "",
    actionsClass: actionsClassName = "",
    secondaryClass: secondaryClassName = "",
    primaryClass: primaryClassName = "",
    numberInputClass: numberInputClassName = "",
    label = undefined,
    changeLabel = undefined,
    updateLabel = undefined,
    cancelLabel = undefined,
    detailed = false,
  }: Props = $props();

  const ctx = getSubscriptionItemContext();
  let editing = $state(false);
  let draftUnits = $state(1);

  const isUnitPlan = $derived(ctx.plan.pricingModel === "unit");
  const outerClass = $derived(
    ctx.unstyled
      ? className
      : `creem-base:flex creem-base:w-full creem-base:flex-col creem-base:gap-2 ${className}`,
  );
  const rowClass = $derived(
    ctx.unstyled
      ? rowClassName
      : `creem-base:flex creem-base:w-full creem-base:items-center creem-base:justify-between creem-base:rounded-xl creem-base:bg-surface-subtle creem-base:py-2 creem-base:pl-4 creem-base:pr-2 ${rowClassName}`,
  );
  const labelClass = $derived(
    ctx.unstyled
      ? labelClassName
      : `creem-base:label-m creem-base:text-foreground-default ${labelClassName}`,
  );
  const actionsClass = $derived(
    ctx.unstyled
      ? actionsClassName
      : `creem-base:flex creem-base:w-full creem-base:items-center creem-base:gap-2 ${actionsClassName}`,
  );
  const secondaryClass = $derived(
    ctx.unstyled
      ? secondaryClassName
      : `creem-base:button-faded creem-base:h-8 creem-base:w-full ${secondaryClassName}`,
  );
  const primaryClass = $derived(
    ctx.unstyled
      ? primaryClassName
      : `creem-base:button-filled creem-base:h-8 creem-base:w-full creem-base:disabled:cursor-not-allowed creem-base:disabled:opacity-50 ${primaryClassName}`,
  );
  const unitsChanged = $derived(
    ctx.subscribedUnits != null && draftUnits !== ctx.subscribedUnits,
  );
  const resolvedLabel = $derived(label ?? ctx.labels.subscription.units);
  const resolvedChangeLabel = $derived(changeLabel ?? ctx.labels.subscription.changeUnits);
  const resolvedUpdateLabel = $derived(updateLabel ?? ctx.labels.subscription.update);
  const resolvedCancelLabel = $derived(cancelLabel ?? ctx.labels.common.cancel);
</script>

{#if isUnitPlan && !ctx.isSwitchPlan}
  {#if ctx.isActive}
    {#if !ctx.onUpdateUnits}
      <div class={outerClass}>
        <div class={rowClass}>
          <span class={labelClass}>{resolvedLabel}</span>
          <span>{ctx.subscribedUnits ?? ctx.checkoutUnits}</span>
        </div>
      </div>
    {:else if !editing}
      <div class={outerClass}>
        {#if detailed}
          <div class={rowClass}>
            <span class={labelClass}>{resolvedLabel}</span>
            <span>{ctx.subscribedUnits ?? ctx.checkoutUnits}</span>
          </div>
        {/if}
        <button
          type="button"
          class={secondaryClass}
          disabled={ctx.disableUnits}
          onclick={() => {
            draftUnits = ctx.subscribedUnits ?? ctx.checkoutUnits;
            editing = true;
          }}
        >
          {resolvedChangeLabel}
        </button>
      </div>
    {:else}
      <div class={outerClass}>
        <div class={rowClass}>
          <span class={labelClass}>{resolvedLabel}</span>
          <NumberInput
            value={draftUnits}
            min={1}
            compact
            disabled={ctx.disableUnits}
            className={numberInputClassName}
            decreaseLabel={ctx.labels.accessibility.decreaseValue}
            increaseLabel={ctx.labels.accessibility.increaseValue}
            onValueChange={(next) => {
              if (next > 0) draftUnits = next;
            }}
          />
        </div>
        <div class={actionsClass}>
          <button
            type="button"
            class={secondaryClass}
            onclick={() => {
              draftUnits = ctx.subscribedUnits ?? ctx.checkoutUnits;
              editing = false;
            }}
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            class={primaryClass}
            disabled={ctx.disableUnits || !unitsChanged}
            onclick={() => ctx.onUpdateUnits?.(draftUnits)}
          >
            {resolvedUpdateLabel}
          </button>
        </div>
      </div>
    {/if}
  {:else}
    <div class={outerClass}>
      <div class={rowClass}>
        <span class={labelClass}>{resolvedLabel}</span>
        <NumberInput
          value={ctx.checkoutUnits}
          min={1}
          compact
          disabled={ctx.disableUnits}
          className={numberInputClassName}
          decreaseLabel={ctx.labels.accessibility.decreaseValue}
          increaseLabel={ctx.labels.accessibility.increaseValue}
          onValueChange={ctx.setCheckoutUnits}
        />
      </div>
    </div>
  {/if}
{/if}
