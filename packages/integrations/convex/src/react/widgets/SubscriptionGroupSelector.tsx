import { useContext } from "react";
import { SegmentGroup } from "../primitives/SegmentGroup.js";
import { SubscriptionContext } from "./subscriptionContext.js";

/**
 * Renders the audience/group selector control.
 *
 * Typically placed inside `Subscription.Root` with `groupSelector="external"` to
 * control positioning. When `groupSelector="auto"`, the root renders this internally.
 *
 * @example
 * ```tsx
 * <Subscription.Root groupSelector="external">
 *   <div className="pricing-toolbar">
 *     <Subscription.GroupSelector className="audience-control" />
 *   </div>
 * </Subscription.Root>
 * ```
 */
export const SubscriptionGroupSelector = ({
  items,
  value,
  onValueChange,
  className = "",
}: {
  items?: Array<{ value: string; label: string }>;
  value?: string | null;
  onValueChange?: (value: string) => void;
  className?: string;
}) => {
  const rootContext = useContext(SubscriptionContext);
  const resolvedItems = items ?? rootContext?.groupItems ?? [];
  const resolvedValue = value ?? rootContext?.activeGroupId ?? null;
  const handleValueChange = onValueChange ?? rootContext?.setGroup;
  const unstyled = rootContext?.unstyled ?? false;

  if (resolvedItems.length <= 1 || !handleValueChange) return null;

  return (
    <div
      className={
        unstyled
          ? className
          : `creem-base:flex creem-base:justify-center ${className}`
      }
    >
      <SegmentGroup
        items={resolvedItems}
        value={resolvedValue}
        unstyled={unstyled}
        onValueChange={handleValueChange}
      />
    </div>
  );
};
