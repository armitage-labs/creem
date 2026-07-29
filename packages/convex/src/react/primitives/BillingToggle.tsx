import type {
  RecurringCycle,
  SupportedRecurringCycle,
} from "../../core/types.js";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";
import { formatRecurringCycle } from "../../core/display.js";
import { SegmentGroup } from "./SegmentGroup.js";

/**
 * Billing-cycle segment control, such as Monthly and Yearly.
 *
 * Rendered internally by `PricingSection`. Inside a `Subscription.Root`, use
 * `Subscription.IntervalSelector`, which is wired to the root's cycle state.
 */
export const BillingToggle = ({
  cycles = [],
  value,
  cycleBadges,
  onValueChange,
  className = "",
  labels = defaultBillingLabels,
}: {
  cycles?: RecurringCycle[];
  value?: RecurringCycle;
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  onValueChange?: (cycle: RecurringCycle) => void;
  className?: string;
  labels?: BillingLabels;
}) => {
  if (cycles.length < 2) return null;

  return (
    <SegmentGroup
      items={cycles.map((cycle) => ({
        value: cycle,
        label: formatRecurringCycle(cycle, labels),
        badge: cycle === "custom" ? undefined : cycleBadges?.[cycle],
      }))}
      value={value}
      onValueChange={(segment) => onValueChange?.(segment as RecurringCycle)}
      className={className}
    />
  );
};
