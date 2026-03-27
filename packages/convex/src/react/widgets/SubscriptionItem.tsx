import { useContext, useEffect } from "react";
import type { RecurringCycle } from "../../core/types.js";
import { SubscriptionContext } from "./subscriptionContext.js";

type BaseProps = {
  planId?: string;
  title?: string;
  description?: string;
  recommended?: boolean;
};

type Props =
  | (BaseProps & {
      type: "free";
      productIds?: undefined;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "single";
      productIds: Partial<Record<RecurringCycle, string>>;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "seat-based";
      productIds: Partial<Record<RecurringCycle, string>>;
      contactUrl?: string;
    })
  | (BaseProps & {
      type: "enterprise";
      productIds?: undefined;
      contactUrl: string;
    });

export const SubscriptionItem = ({
  planId,
  type,
  title,
  description,
  contactUrl,
  recommended,
  productIds,
}: Props) => {
  const rootContext = useContext(SubscriptionContext);

  useEffect(() => {
    if (!rootContext) return;
    const resolvedPlanId = planId ?? Object.values(productIds ?? {})[0] ?? type;
    const registration = {
      planId: resolvedPlanId,
      type,
      title,
      description,
      contactUrl,
      recommended,
      productIds,
    };
    const unregister = rootContext.registerPlan(registration);
    return unregister;
  }, [
    rootContext,
    planId,
    type,
    title,
    description,
    contactUrl,
    recommended,
    productIds,
  ]);

  return null;
};
