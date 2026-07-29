<!--
  @component
  Renders the billing interval selector control.

  Automatically hides when only one interval is available for the active group.
  Typically placed inside `Subscription.Root` with `intervalSelector="external"`.
-->
<script lang="ts">
  import { getContext } from "svelte";
  import IntervalSelector from "../primitives/IntervalSelector.svelte";
  import type { RecurringCycle, SupportedRecurringCycle } from "../../core/types.js";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";

  interface Props {
    /** Available billing cycles. Defaults to cycles available in the active root group. */
    cycles?: RecurringCycle[];
    /** Controlled selected cycle. Defaults to the root's selected cycle. */
    value?: RecurringCycle;
    /** Called when the user selects a cycle. Defaults to updating the root context. */
    onValueChange?: (cycle: RecurringCycle) => void;
    /** Optional badges shown next to billing interval labels. Defaults to root badges. */
    cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
    /** Wrapper CSS class. */
    class?: string;
  }

  let {
    cycles,
    value,
    onValueChange,
    cycleBadges,
    class: className = "",
  }: Props = $props();

  const rootContext = getContext<SubscriptionContextValue | undefined>(
    SUBSCRIPTION_CONTEXT_KEY,
  );
  const resolvedCycles = $derived(cycles ?? rootContext?.availableCycles() ?? []);
  const requestedValue = $derived(
    value ?? rootContext?.getSelectedCycle() ?? resolvedCycles[0],
  );
  const resolvedValue = $derived(
    requestedValue && resolvedCycles.includes(requestedValue)
      ? requestedValue
      : resolvedCycles[0],
  );
  // Root badges merge per cycle rather than being replaced wholesale, matching
  // this component's behaviour before the selector implementations were merged.
  const resolvedBadges = $derived.by(() => {
    const merged: Partial<Record<SupportedRecurringCycle, string>> = {};
    for (const cycle of resolvedCycles) {
      if (cycle === "custom") continue;
      const badge = cycleBadges?.[cycle] ?? rootContext?.getCycleBadge(cycle);
      if (badge) merged[cycle] = badge;
    }
    return merged;
  });
  const handleValueChange = (cycle: RecurringCycle) => {
    if (onValueChange) {
      onValueChange(cycle);
      return;
    }
    rootContext?.setCycle(cycle);
  };
</script>

<IntervalSelector
  cycles={resolvedCycles}
  value={resolvedValue}
  onValueChange={handleValueChange}
  cycleBadges={resolvedBadges}
  unstyled={rootContext?.getUnstyled() ?? false}
  labels={rootContext?.getLabels() ?? undefined}
  class={className}
/>
