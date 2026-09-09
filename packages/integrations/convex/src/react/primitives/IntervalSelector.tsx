import type {
  RecurringCycle,
  SupportedRecurringCycle,
} from "../../core/types.js";
import { defaultBillingLabels, type BillingLabels } from "../../core/i18n.js";
import { SegmentGroup } from "./SegmentGroup.js";

/**
 * Billing-cycle segment control, such as Monthly and Yearly.
 *
 * Internal to the package. `PricingSection` renders it for the default cards
 * and `Subscription.IntervalSelector` wires it to the root's cycle state, so
 * both paths share one implementation. Renders nothing below two cycles.
 */
export const IntervalSelector = ({
  cycles = [],
  value,
  cycleBadges,
  onValueChange,
  className = "",
  unstyled = false,
  labels = defaultBillingLabels,
}: {
  cycles?: RecurringCycle[];
  value?: RecurringCycle;
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  onValueChange?: (cycle: RecurringCycle) => void;
  className?: string;
  unstyled?: boolean;
  labels?: BillingLabels;
}) => {
  if (cycles.length <= 1 || !value || !onValueChange) return null;

  return (
    <div
      className={
        unstyled
          ? className
          : `creem-base:flex creem-base:justify-center ${className}`
      }
    >
      <SegmentGroup
        items={cycles.map((cycle) => ({
          value: cycle,
          label: labels.billingCycle[cycle] ?? cycle,
          badge: cycle === "custom" ? undefined : cycleBadges?.[cycle],
        }))}
        value={value}
        unstyled={unstyled}
        onValueChange={(segment) => onValueChange(segment as RecurringCycle)}
      />
    </div>
  );
};
