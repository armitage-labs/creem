import type { SubscriptionPlanRegistration } from "./types.js";

export type SubscriptionContextValue = {
  registerPlan: (plan: SubscriptionPlanRegistration) => () => void;
};

export const SUBSCRIPTION_CONTEXT_KEY = Symbol("creem.subscription.context");
