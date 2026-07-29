<!--
  @component
  Context boundary every connected widget reads.

  Render it around any `Subscription`, `Product`, `BillingPortal`,
  `BillingHistory`, or `Credits` widget and pass the connected API once; widgets
  no longer take `api` props themselves.

  `createCreemReact` / `createCreemSvelte` return a spreadable binding, so
  `<CreemConvexProvider {...billing}>` wires catalog, API, and defaults together.
-->
<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import type { PlanCatalog, RecurringCycle } from "../core/types.js";
  import type { BillingI18n } from "../core/i18n.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "./creemConvexContext.js";
  import type {
    BillingPermissions,
    CheckoutIntent,
    ConnectedBillingApi,
    PlanChangeIntent,
  } from "./widgets/types.js";

  interface Props {
    /** Connected Convex function references used by all billing widgets below this provider. */
    api: ConnectedBillingApi;
    /** Optional app-owned billing catalog used to resolve plan IDs, labels, product IDs, and limits. */
    catalog?: PlanCatalog;
    /** Default billing cycle for subscription widgets when no local cycle is selected. */
    defaultCycle?: RecurringCycle;
    /** UI permission flags. These only hide/disable client UI; enforce authorization in Convex functions. */
    permissions?: BillingPermissions;
    /** Optional guard that can block checkout before redirecting to Creem. */
    onBeforeCheckout?: (intent: CheckoutIntent) => Promise<boolean> | boolean;
    /** Optional guard that can block paid plan switches and unit updates. */
    onBeforePlanChange?: (
      intent: PlanChangeIntent,
    ) => Promise<boolean> | boolean;
    /** Optional guard that can block activating an app-owned plan. */
    onBeforePlanActivation?: (intent: {
      planId: string;
    }) => Promise<boolean> | boolean;
    /** Locale, labels, and formatting overrides for widgets below this provider. */
    i18n?: BillingI18n;
    /** Billing UI rendered inside the configured provider context. */
    children?: Snippet;
  }

  let {
    api,
    catalog = undefined,
    defaultCycle = undefined,
    permissions = undefined,
    onBeforeCheckout = undefined,
    onBeforePlanChange = undefined,
    onBeforePlanActivation = undefined,
    i18n = undefined,
    children,
  }: Props = $props();

  const contextValue: CreemConvexContextValue = {
    get api() {
      return api;
    },
    get catalog() {
      return catalog;
    },
    get defaultCycle() {
      return defaultCycle;
    },
    get permissions() {
      return permissions;
    },
    get onBeforeCheckout() {
      return onBeforeCheckout;
    },
    get onBeforePlanChange() {
      return onBeforePlanChange;
    },
    get onBeforePlanActivation() {
      return onBeforePlanActivation;
    },
    get i18n() {
      return i18n;
    },
  };

  setContext(CREEM_CONVEX_CONTEXT_KEY, contextValue);
</script>

{@render children?.()}
