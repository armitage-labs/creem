<!--
  @component
  Billing-cycle segment control, such as Monthly and Yearly.

  Internal to the package. `PricingSection` renders it for the default cards and
  `Subscription.IntervalSelector` wires it to the root's cycle state, so both
  paths share one implementation. Renders nothing below two cycles.
-->
<script lang="ts">
  /* global $props */
  import type { RecurringCycle, SupportedRecurringCycle } from "../../core/types.js";
  import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";
  import SegmentGroup from "./SegmentGroup.svelte";

  interface Props {
    /** Billing cycles to offer. Renders nothing below two. */
    cycles?: RecurringCycle[];
    /** Selected cycle. */
    value?: RecurringCycle;
    /** Optional badges shown next to interval labels. */
    cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
    /** Called when the user selects a cycle. */
    onValueChange?: (cycle: RecurringCycle) => void;
    /** Wrapper CSS class. */
    class?: string;
    /** Drop the built-in centring wrapper so the caller owns layout. */
    unstyled?: boolean;
    /** Label set used for cycle names. */
    labels?: BillingLabels;
  }

  let {
    cycles = [],
    value,
    cycleBadges = undefined,
    onValueChange,
    class: className = "",
    unstyled = false,
    labels = defaultBillingLabels,
  }: Props = $props();

  const resolvedClass = $derived(
    unstyled ? className : `creem-base:flex creem-base:justify-center ${className}`,
  );
  const items = $derived(
    cycles.map((cycle) => ({
      value: cycle,
      label: labels.billingCycle[cycle] ?? cycle,
      badge: cycle === "custom" ? undefined : cycleBadges?.[cycle],
    })),
  );
</script>

{#if cycles.length > 1 && value && onValueChange}
  <div class={resolvedClass}>
    <SegmentGroup
      {items}
      {value}
      {unstyled}
      onValueChange={(segment) => onValueChange(segment as RecurringCycle)}
    />
  </div>
{/if}
