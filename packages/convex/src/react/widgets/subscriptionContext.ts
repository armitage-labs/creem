import { createContext } from "react";
import type { SubscriptionPlanRegistration } from "./types.js";

export type SubscriptionContextValue = {
  registerPlan: (plan: SubscriptionPlanRegistration) => () => void;
};

export const SubscriptionContext = createContext<
  SubscriptionContextValue | undefined
>(undefined);
