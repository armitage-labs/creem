import type { PropsWithChildren, ReactNode } from "react";
import type { AvailableAction, BillingSnapshot } from "../../core/types.js";
import { hasBillingActionLocal } from "../../core/display.js";

/**
 * Renders `children` only when every action in `requiredActions` is available on
 * the snapshot, and `fallback` otherwise.
 *
 * This gates UI, not access. Enforce real entitlement on the server.
 */
export const BillingGate = ({
  snapshot,
  requiredActions,
  fallback = null,
  children,
}: PropsWithChildren<{
  /**
   * Billing state to test the required actions against.
   */
  snapshot?: BillingSnapshot | null;
  /**
   * Every action that must be available before `children` renders.
   */
  requiredActions: AvailableAction | AvailableAction[];
  /**
   * Rendered when they are not.
   */
  fallback?: ReactNode;
}>) => {
  if (!snapshot) {
    return <>{fallback}</>;
  }

  const actions = Array.isArray(requiredActions)
    ? requiredActions
    : [requiredActions];
  const canRender = actions.every((action) =>
    hasBillingActionLocal(snapshot, action),
  );
  return <>{canRender ? children : fallback}</>;
};
