/**
 * Widget types live in `core/` so React and Svelte share one definition.
 *
 * This module re-exports them for the React entry point.
 */
export type {
  BillingPermissions,
  ConnectedActiveSubscription,
  ConnectedBillingModel,
  ConnectedBillingUser,
  ConnectedPagination,
  ConnectedProduct,
  ConnectedTransaction,
  ConnectedTransactionList,
  ProductItemRegistration,
  ProductType,
  SubscriptionGroupRegistration,
  SubscriptionPlanRegistration,
  SubscriptionPlanType,
  Transition,
} from "../../core/model.js";

export type {
  ConnectedBillingApi,
  CreemBillingModule,
} from "../../core/connectedApi.js";

export { connectCreemApi } from "../../core/connectedApi.js";

export type { CheckoutIntent, PlanChangeIntent } from "../../core/types.js";
