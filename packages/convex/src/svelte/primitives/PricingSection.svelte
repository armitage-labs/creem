<script lang="ts">
  import BillingToggle from "./BillingToggle.svelte";
  import PricingCard from "./PricingCard.svelte";
  import type { BillingSnapshot, UIPlanEntry, RecurringCycle } from "../../core/types.js";
  import type { ConnectedProduct } from "../widgets/types.js";
    import { SvelteSet } from "svelte/reactivity";

  interface Props {
    plans?: UIPlanEntry[];
    snapshot?: BillingSnapshot | null;
    selectedCycle?: RecurringCycle;
    products?: ConnectedProduct[];
    subscriptionProductId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionTrialEnd?: string | null;
    units?: number;
    showSeatPicker?: boolean;
    twoColumnLayout?: boolean;
    subscribedSeats?: number | null;
    isGroupSubscribed?: boolean;
    disableCheckout?: boolean;
    disableSwitch?: boolean;
    disableSeats?: boolean;
    className?: string;
    onCycleChange?: (cycle: RecurringCycle) => void;
    onCheckout?: (payload: {
      plan: UIPlanEntry;
      productId: string;
      units?: number;
    }) => Promise<void> | void;
    onSwitchPlan?: (payload: {
      plan: UIPlanEntry;
      productId: string;
      units?: number;
    }) => Promise<void> | void;
    onUpdateSeats?: (payload: { units: number }) => Promise<void> | void;
    onContactSales?: (payload: { plan: UIPlanEntry }) => Promise<void> | void;
    onCancelSubscription?: () => void;
  }

  let {
    plans = [],
    snapshot = null,
    selectedCycle = undefined,
    products = [],
    subscriptionProductId = null,
    subscriptionStatus = null,
    subscriptionTrialEnd = null,
    units = undefined,
    showSeatPicker = false,
    twoColumnLayout = false,
    subscribedSeats = null,
    isGroupSubscribed = false,
    disableCheckout = false,
    disableSwitch = false,
    disableSeats = false,
    className = "",
    onCycleChange,
    onCheckout,
    onSwitchPlan,
    onUpdateSeats,
    onContactSales,
    onCancelSubscription,
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

  const availableCycles = $derived(toUniqueCycles(plans));
  const hasEnterprisePlan = $derived(plans.some((plan) => plan.category === "enterprise"));
  const effectiveCycle = $derived(
    selectedCycle ?? snapshot?.recurringCycle ?? availableCycles[0],
  );
  const showToggle = $derived(availableCycles.length > 1);
</script>

<section class={className}>
  {#if showToggle}
    <div class="mb-[6.5rem] flex justify-center">
      <BillingToggle
        cycles={availableCycles}
        value={effectiveCycle}
        onValueChange={onCycleChange}
      />
    </div>
  {/if}

  <div class={`grid grid-cols-1 gap-1 ${showSeatPicker || twoColumnLayout ? "md:grid-cols-2" : hasEnterprisePlan ? "sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 md:grid-cols-3"}`}>
    {#each plans as plan (plan.planId)}
      <PricingCard
        {plan}
        selectedCycle={effectiveCycle}
        activePlanId={snapshot?.activePlanId}
        {subscriptionProductId}
        {subscriptionStatus}
        {subscriptionTrialEnd}
        {products}
        {units}
        {showSeatPicker}
        {subscribedSeats}
        {isGroupSubscribed}
        {disableCheckout}
        {disableSwitch}
        {disableSeats}
        {onCheckout}
        {onSwitchPlan}
        {onUpdateSeats}
        {onContactSales}
        {onCancelSubscription}
        className=""
      />
    {/each}
  </div>
</section>
