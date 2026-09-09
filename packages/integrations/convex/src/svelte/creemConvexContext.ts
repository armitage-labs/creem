import type { RecurringCycle, PlanCatalog } from "../core/types.js";
import type { BillingI18n } from "../core/i18n.js";
import type {
  BillingPermissions,
  CheckoutIntent,
  ConnectedBillingApi,
  PlanChangeIntent,
} from "./widgets/types.js";

export const CREEM_CONVEX_CONTEXT_KEY = Symbol("creem-convex-context");

/**
 * The value `CreemConvexProvider` accepts and every connected widget reads.
 */
export interface CreemConvexContextValue {
  readonly api: ConnectedBillingApi;
  readonly catalog?: PlanCatalog;
  readonly defaultCycle?: RecurringCycle;
  readonly permissions?: BillingPermissions;
  readonly onBeforeCheckout?: (
    intent: CheckoutIntent,
  ) => Promise<boolean> | boolean;
  readonly onBeforePlanChange?: (
    intent: PlanChangeIntent,
  ) => Promise<boolean> | boolean;
  readonly onBeforePlanActivation?: (intent: {
    planId: string;
  }) => Promise<boolean> | boolean;
  readonly i18n?: BillingI18n;
}
