import type { RecurringCycle } from "../../core/types.js";
import { formatRecurringCycle } from "../shared.js";
import { SegmentGroup } from "./SegmentGroup.js";

export const BillingToggle = ({
  cycles = [],
  value,
  onValueChange,
  className = "",
}: {
  cycles?: RecurringCycle[];
  value?: RecurringCycle;
  onValueChange?: (cycle: RecurringCycle) => void;
  className?: string;
}) => {
  if (cycles.length < 2) return null;

  return (
    <SegmentGroup
      items={cycles.map((cycle) => ({
        value: cycle,
        label: formatRecurringCycle(cycle),
      }))}
      value={value}
      onValueChange={(segment) => onValueChange?.(segment as RecurringCycle)}
      className={className}
    />
  );
};
