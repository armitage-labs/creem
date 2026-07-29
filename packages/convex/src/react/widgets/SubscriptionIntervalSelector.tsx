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

  return (
    <IntervalSelector
      cycles={resolvedCycles}
      value={resolvedValue}
      onValueChange={onValueChange ?? rootContext?.setCycle}
      cycleBadges={cycleBadges ?? rootContext?.cycleBadges}
      unstyled={rootContext?.unstyled ?? false}
      labels={rootContext?.labels}
      className={className}
    />
  );
};
