<!--
  @component
  Billing-cycle segment control, such as Monthly and Yearly.

  Rendered internally by `PricingSection`. Inside a `Subscription.Root`, use
  `Subscription.IntervalSelector`, which is wired to the root's cycle state.
-->
<script lang="ts">
  /* global $props */
  import type { RecurringCycle, SupportedRecurringCycle } from "../../core/types.js";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";
  import { formatRecurringCycle } from "../../core/display.js";
  import SegmentGroup from "./SegmentGroup.svelte";

  interface Props {
    cycles?: RecurringCycle[];
    value?: RecurringCycle;
    cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
    onValueChange?: (cycle: RecurringCycle) => void;
    className?: string;
    labels?: BillingLabels;
  }

  let {
    cycles = [],
    value,
    cycleBadges = undefined,
    onValueChange,
    className = "",
    labels = defaultBillingLabels,
  }: Props = $props();

  const getCycleBadge = (cycle: RecurringCycle) =>
    cycle === "custom" ? undefined : cycleBadges?.[cycle];
</script>

{#if cycles.length > 1}
  <SegmentGroup
    items={cycles.map((cycle) => ({
      value: cycle,
      label: formatRecurringCycle(cycle, labels),
      badge: getCycleBadge(cycle),
    }))}
    value={value}
    onValueChange={(segment) => onValueChange?.(segment as RecurringCycle)}
    className={className}
  />
{/if}
