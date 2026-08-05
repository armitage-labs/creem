import { useContext, type PropsWithChildren } from "react";
import { SubscriptionContext } from "./subscriptionContext.js";
import { subscriptionGridClasses } from "../../core/gridColumns.js";

/**
 * Responsive card layout for subscription plans.
 *
 * Column count comes from the root's `columns` prop, so a composed layout and
 * the default pricing cards resolve it the same way. In `unstyled` mode the
 * built-in classes are dropped entirely.
 *
 * @example
 * ```tsx
 * <Subscription.Root unstyled plans={["basic", "pro"]} columns={2}>
 *   <Subscription.Grid>
 *     <Subscription.Item planId="basic">…</Subscription.Item>
 *     <Subscription.Item planId="pro">…</Subscription.Item>
 *   </Subscription.Grid>
 * </Subscription.Root>
 * ```
 */
export const SubscriptionGrid = ({
  className,
  class: classProp,
  children,
}: PropsWithChildren<{ className?: string; class?: string }>) => {
  const rootContext = useContext(SubscriptionContext);
  const incomingClassName = className ?? classProp ?? "";
  const resolvedClassName = rootContext?.unstyled
    ? incomingClassName
    : `${subscriptionGridClasses(rootContext?.columns ?? "auto")} ${incomingClassName}`;

  return <div className={resolvedClassName}>{children}</div>;
};
