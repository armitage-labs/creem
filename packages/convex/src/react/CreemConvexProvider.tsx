/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { PlanCatalog, RecurringCycle } from "../core/types.js";
import type { BillingI18n } from "../core/i18n.js";
import type {
  BillingPermissions,
  CheckoutIntent,
  ConnectedBillingApi,
  PlanChangeIntent,
} from "./widgets/types.js";

/**
 * The value `CreemConvexProvider` accepts and every connected widget reads.
 */
export interface CreemConvexContextValue {
  /**
   * Connected Convex function references, built with
   * `connectCreemApi(api.billing)`; the fields you supply decide which controls
   * the widgets render.
   */
  api: ConnectedBillingApi;
  /**
   * App-owned billing catalog used by the subscription widgets and by
   * `plansOf`.
   */
  catalog?: PlanCatalog;
  /**
   * Billing cycle subscription widgets start on when they do not set their own.
   */
  defaultCycle?: RecurringCycle;
  /**
   * Provider-level UI permission flags; these hide controls only, so enforce
   * real authorization in your Convex functions.
   */
  permissions?: BillingPermissions;
  /**
   * Runs before any checkout starts; return `false` to abort, for example to
   * gate on sign-in or accepted terms.
   */
  onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
  /**
   * Runs before a paid plan switch or unit update; return `false` to abort.
   */
  onBeforePlanChange?: (intent: PlanChangeIntent) => Promise<boolean> | boolean;
  /**
   * Runs before an app-owned plan (free, no-card trial) is activated; return
   * `false` to abort.
   */
  onBeforePlanActivation?: (intent: {
    planId: string;
  }) => Promise<boolean> | boolean;
  /**
   * Locale, label, date, and currency formatter overrides.
   */
  i18n?: BillingI18n;
}

const CreemConvexContext = createContext<CreemConvexContextValue | null>(null);

/**
 * Reads the `CreemConvexProvider` context: billing model, loading and error
 * state, and the checkout, plan, and cancellation actions.
 *
 * @throws When called outside a `CreemConvexProvider`.
 */
export const useCreemConvex = () => useContext(CreemConvexContext);

export const requireCreemConvexApi = (
  componentName: string,
  provider: CreemConvexContextValue | null,
) => {
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      `${componentName} must be rendered inside <CreemConvexProvider>.`,
    );
  }
  return resolvedApi;
};

/**
 * Context boundary every connected widget reads.
 *
 * Render it around any `Subscription`, `Product`, `BillingPortal`,
 * `BillingHistory`, or `Credits` widget and pass the connected API once; widgets
 * no longer take `api` props themselves.
 *
 * `createCreemReact` / `createCreemSvelte` return a spreadable binding, so
 * `<CreemConvexProvider {...billing}>` wires catalog, API, and defaults together.
 */
export const CreemConvexProvider = ({
  api,
  catalog,
  defaultCycle,
  permissions,
  onBeforeCheckout,
  onBeforePlanChange,
  onBeforePlanActivation,
  i18n,
  children,
}: PropsWithChildren<CreemConvexContextValue>) => {
  const value = useMemo(
    () => ({
      api,
      catalog,
      defaultCycle,
      permissions,
      onBeforeCheckout,
      onBeforePlanChange,
      onBeforePlanActivation,
      i18n,
    }),
    [
      api,
      catalog,
      defaultCycle,
      permissions,
      onBeforeCheckout,
      onBeforePlanChange,
      onBeforePlanActivation,
      i18n,
    ],
  );

  return (
    <CreemConvexContext.Provider value={value}>
      {children}
    </CreemConvexContext.Provider>
  );
};
