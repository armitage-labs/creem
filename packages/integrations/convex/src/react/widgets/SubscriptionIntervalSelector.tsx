import { useContext } from "react";
import { IntervalSelector } from "../primitives/IntervalSelector.js";
import type {
  RecurringCycle,
  SupportedRecurringCycle,
} from "../../core/types.js";
import { SubscriptionContext } from "./subscriptionContext.js";

/**
 * Renders the billing interval selector control.
 *
 * Automatically hides when only one interval is available for the active group.
 * Typically placed inside `Subscription.Root` with `intervalSelector="external"`.
 *
 * @example
 * ```tsx
 * <Subscription.Root intervalSelector="external">
 *   <Subscription.IntervalSelector className="interval-control" />
 * </Subscription.Root>
 * ```
 */
export const SubscriptionIntervalSelector = ({
  cycles,
  value,
  onValueChange,
  cycleBadges,
  className = "",
}: {
  cycles?: RecurringCycle[];
  value?: RecurringCycle;
  onValueChange?: (cycle: RecurringCycle) => void;
  cycleBadges?: Partial<Record<SupportedRecurringCycle, string>>;
  className?: string;
}) => {
  const rootContext = useContext(SubscriptionContext);
  const resolvedCycles = cycles ?? rootContext?.availableCycles ?? [];
  const requestedValue =
    value ?? rootContext?.selectedCycle ?? resolvedCycles[0];
  const resolvedValue =
    requestedValue && resolvedCycles.includes(requestedValue)
      ? requestedValue
      : resolvedCycles[0];

  // Merge per cycle rather than replacing the root's map wholesale: supplying a
  // badge for one interval must not silently drop the badges for the others.
  // Matches the Svelte component so the same prop renders the same badges on
  // both surfaces.
  const resolvedBadges: Partial<Record<SupportedRecurringCycle, string>> = {};
  for (const cycle of resolvedCycles) {
    if (cycle === "custom") continue;
    const badge = cycleBadges?.[cycle] ?? rootContext?.cycleBadges?.[cycle];
    if (badge) resolvedBadges[cycle] = badge;
  }

  return (
    <IntervalSelector
      cycles={resolvedCycles}
      value={resolvedValue}
      onValueChange={onValueChange ?? rootContext?.setCycle}
      cycleBadges={resolvedBadges}
      unstyled={rootContext?.unstyled ?? false}
      labels={rootContext?.labels}
      className={className}
    />
  );
};
