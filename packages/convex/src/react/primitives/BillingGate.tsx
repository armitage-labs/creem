import type { PropsWithChildren, ReactNode } from "react";
import type { AvailableAction, BillingSnapshot } from "../../core/types.js";
import { hasBillingActionLocal } from "../shared.js";

export const BillingGate = ({
  snapshot,
  requiredActions,
  fallback = null,
  children,
}: PropsWithChildren<{
  snapshot?: BillingSnapshot | null;
  requiredActions: AvailableAction | AvailableAction[];
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
