import { useContext, type PropsWithChildren } from "react";
import { SubscriptionContext } from "./subscriptionContext.js";

/**
 * Scopes plans to an app-facing audience/product line.
 *
 * Only renders its children when the parent `Subscription.Root`'s active group
 * matches this group's `value`. When used as a registration-only element (no explicit
 * children rendering logic), it acts as a semantic grouping marker.
 *
 * @example
 * ```tsx
 * <Subscription.Group value="individual" label="Individual">
 *   <Subscription.Grid>
 *     <Subscription.Item planId="basic-individual" />
 *   </Subscription.Grid>
 * </Subscription.Group>
 * ```
 */
export const SubscriptionGroup = ({
  value,
  children,
}: PropsWithChildren<{
  value: string;
  label: string;
  description?: string;
}>) => {
  const rootContext = useContext(SubscriptionContext);
  if (rootContext?.activeGroupId && rootContext.activeGroupId !== value) {
    return null;
  }
  return <>{children}</>;
};
