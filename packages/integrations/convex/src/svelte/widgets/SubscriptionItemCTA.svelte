<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    /** Button CSS class. */
    class?: string;
    /** Label shown for the active/current plan state. */
    activeLabel?: string;
    /** Label shown for initial checkout. */
    checkoutLabel?: string;
    /** Label shown for switching to this plan. */
    switchLabel?: string;
  }

  let {
    class: className = "",
    activeLabel = undefined,
    checkoutLabel = undefined,
    switchLabel = undefined,
  }: Props = $props();

  const ctx = getSubscriptionItemContext();
  const activeClass = $derived(
    ctx.unstyled
      ? className
      : `creem-base:w-full creem-base:rounded-lg creem-base:bg-zinc-100 creem-base:px-4 creem-base:py-2 creem-base:text-sm creem-base:font-medium creem-base:text-zinc-500 dark:creem-base:bg-zinc-800 dark:creem-base:text-zinc-400 ${className}`,
  );
  const actionClass = $derived(
    ctx.unstyled ? className : `creem-base:button-filled creem-base:w-full ${className}`,
  );
</script>

{#if ctx.isActive}
  <button
    type="button"
    class={activeClass}
    disabled
  >
    {activeLabel ?? ctx.labels.subscription.currentPlan}
  </button>
{:else if ctx.onSwitch}
  <button
    type="button"
    class={actionClass}
    onclick={ctx.onSwitch}
  >
    {switchLabel ?? ctx.labels.subscription.switchPlan}
  </button>
{:else if ctx.isScheduledTarget}
  <button
    type="button"
    class={activeClass}
    disabled
  >
    {ctx.scheduledEffectiveDate
      ? ctx.labels.subscription.scheduledPlanWithDate(ctx.scheduledEffectiveDate)
      : ctx.labels.subscription.scheduledPlan}
  </button>
{:else if ctx.onCheckout}
  <button
    type="button"
    class={actionClass}
    onclick={ctx.onCheckout}
  >
    {checkoutLabel ?? ctx.labels.subscription.getStarted}
  </button>
{/if}
