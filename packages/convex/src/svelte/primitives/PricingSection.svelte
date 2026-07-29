<script lang="ts">
  import BillingToggle from "./BillingToggle.svelte";
  import PricingCard from "./PricingCard.svelte";
  import type {
    UIPlanEntry,
    RecurringCycle,
    ScheduledSubscriptionUpdate,
    SupportedRecurringCycle,
  } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingCurrencyFormatInput,
    type BillingLabels,
  } from "../../core/i18n.js";
  import type { ConnectedProduct } from "../widgets/types.js";
  import { SvelteSet } from "svelte/reactivity";

  interface Props {
    plans?: UIPlanEntry[];
    activePlanId?: string | null;
    selectedCycle?: RecurringCycle;
    products?: ConnectedProduct[];
    subscriptionProductId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTrialEnd?: string | null;
    scheduledUpdate?: ScheduledSubscriptionUpdate | null;
    scheduledEffectiveDate?: string | null;
    units?: number;
    showUnitPicker?: boolean;
    showCycleToggle?: boolean;
    cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
    columns?: "auto" | 1 | 2 | 3 | 4;
    subscribedUnits?: number | null;
    isGroupSubscribed?: boolean;
    disableCheckout?: boolean;
    disableSwitch?: boolean;
    disableUnits?: boolean;
    className?: string;
    onCycleChange?: (cycle: RecurringCycle) => void;
    onCheckout?: (payload: {
      plan: UIPlanEntry;
      productId: string;
      units?: number;
    }) => Promise<void> | void;
    onSwitchPlan?: (payload: {
      plan: UIPlanEntry;
      productId?: string;
      appPlanId?: string;
      freePlanId?: string;
      units?: number;
    }) => Promise<void> | void;
    onUpdateUnits?: (payload: { units: number }) => Promise<void> | void;
    onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
    onCancelSubscription?: () => void;
    labels?: BillingLabels;
    formatCurrency?: (input: BillingCurrencyFormatInput) => string;
  }

  let {
    plans = [],
    activePlanId = null,
    selectedCycle = undefined,
    products = [],
    subscriptionProductId = null,
    subscriptionStatus = null,
    subscriptionTrialEnd = null,
    scheduledUpdate = null,
    scheduledEffectiveDate = null,
    units = undefined,
    showUnitPicker = false,
    showCycleToggle = true,
    cycleBadges = undefined,
    columns = "auto",
    subscribedUnits = null,
    isGroupSubscribed = false,
    disableCheckout = false,
    disableSwitch = false,
    disableUnits = false,
    className = "",
    onCycleChange,
    onCheckout,
    onSwitchPlan,
    onUpdateUnits,
    onContactSales,
    onCancelSubscription,
    labels = defaultBillingLabels,
    formatCurrency = undefined,
  }: Props = $props();

  const toUniqueCycles = (entries: UIPlanEntry[]) => {
    const set = new SvelteSet<RecurringCycle>();
    for (const plan of entries) {
      for (const cycle of plan.billingCycles ?? []) {
        set.add(cycle);
      }
    }
    return Array.from(set);
  };

  const primaryPlans = $derived(plans.filter((plan) => plan.category !== "trial"));
  const trialPlans = $derived(plans.filter((plan) => plan.category === "trial"));
  const availableCycles = $derived(toUniqueCycles(primaryPlans));
  const hasEnterprisePlan = $derived(primaryPlans.some((plan) => plan.category === "enterprise"));
  const effectiveCycle = $derived(selectedCycle ?? availableCycles[0]);
  const showToggle = $derived(showCycleToggle && availableCycles.length > 1);
  // Only the section knows whether a sibling plan offers a trial, so it decides
  // whether every card reserves the caption row under its CTA. Each grid is its
  // own alignment context, so the two grids are measured separately.
  const reservesTrialCaption = (group: UIPlanEntry[]) =>
    group.some((candidate) => (candidate.trialDays ?? 0) > 0);
  const reserveTrialCaption = $derived(reservesTrialCaption(primaryPlans));
  const reserveTrialCaptionForTrials = $derived(reservesTrialCaption(trialPlans));

  const gridColumnsClass = $derived.by(() => {
    switch (columns) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-1 sm:grid-cols-2";
      case 3:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
      case "auto":
        if (showUnitPicker || primaryPlans.length <= 2) {
          return "grid-cols-1 sm:grid-cols-2";
        }
        return hasEnterprisePlan
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
    }
  });
</script>

<section class={className}>
  {#if showToggle}
    <div class="mb-6 flex justify-center">
      <BillingToggle
        cycles={availableCycles}
        value={effectiveCycle}
        {cycleBadges}
        onValueChange={onCycleChange}
        {labels}
      />
    </div>
  {/if}

  <div class={`grid gap-1 ${gridColumnsClass}`}>
    {#each primaryPlans as plan (plan.planId)}
      <PricingCard
        {plan}
        selectedCycle={effectiveCycle}
        {activePlanId}
        {subscriptionProductId}
        {subscriptionStatus}
        {subscriptionTrialEnd}
        {scheduledUpdate}
        {scheduledEffectiveDate}
        {products}
        {units}
        {showUnitPicker}
        {reserveTrialCaption}
        {subscribedUnits}
        {isGroupSubscribed}
        {disableCheckout}
        {disableSwitch}
        {disableUnits}
        {onCheckout}
        {onSwitchPlan}
        {onUpdateUnits}
        {onContactSales}
        {onCancelSubscription}
        {labels}
        {formatCurrency}
        className=""
      />
    {/each}
  </div>

  {#if trialPlans.length > 0}
    <div class="mt-8 grid gap-1">
      {#each trialPlans as plan (plan.planId)}
        <PricingCard
          {plan}
          selectedCycle={effectiveCycle}
          {activePlanId}
          {subscriptionProductId}
          {subscriptionStatus}
          {subscriptionTrialEnd}
          {scheduledUpdate}
          {scheduledEffectiveDate}
          {products}
          {units}
          {showUnitPicker}
          reserveTrialCaption={reserveTrialCaptionForTrials}
          {subscribedUnits}
          {isGroupSubscribed}
          {disableCheckout}
          {disableSwitch}
          {disableUnits}
          {onCheckout}
          {onSwitchPlan}
          {onUpdateUnits}
          {onContactSales}
          {onCancelSubscription}
          {labels}
          {formatCurrency}
          className=""
        />
      {/each}
    </div>
  {/if}
</section>
