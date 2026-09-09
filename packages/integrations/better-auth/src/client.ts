import type { BetterAuthClientPlugin } from "better-auth";
import type { creem } from "./index.js";

/**
 * Creem client plugin for Better-Auth.
 *
 * Provides client-side methods for interacting with Creem:
 * - `authClient.creem.createCheckout()` - Create a checkout session
 * - `authClient.creem.createPortal()` - Create a customer portal session
 * - `authClient.creem.cancelSubscription()` - Cancel a subscription
 * - `authClient.creem.retrieveSubscription()` - Get subscription details
 * - `authClient.creem.searchTransactions()` - Search transactions
 * - `authClient.creem.hasAccessGranted()` - Check if user has access granted
 *
 * @example
 * ```typescript
 * import { createAuthClient } from "better-auth/client";
 * import { creemClient } from "./lib/creem-betterauth/client";
 *
 * export const authClient = createAuthClient({
 *   plugins: [creemClient()]
 * });
 *
 * // Usage in components - hover over createCheckout to see clean parameter types!
 * const { data, error } = await authClient.creem.createCheckout({
 *   productId: "prod_abc123",
 *   units: 1,
 *   successUrl: "/success"
 * });
 * ```
 */
export const creemClient = () => {
  return {
    id: "creem",
    $InferServerPlugin: {} as ReturnType<typeof creem>,
    pathMethods: {
      "/creem/create-portal": "POST",
      "/creem/cancel-subscription": "POST",
      "/creem/retrieve-subscription": "POST",
      "/creem/search-transactions": "POST",
    },
  } satisfies BetterAuthClientPlugin;
};

// Re-export types for client-side usage
export type {
  CreateCheckoutInput,
  CreateCheckoutResponse,
  CheckoutCustomer,
  CustomFieldInput,
  TextFieldConfig,
  CheckboxFieldConfig,
} from "./checkout-types.js";

export type { CreatePortalInput, CreatePortalResponse } from "./portal-types.js";

export type {
  CancelSubscriptionInput,
  CancelSubscriptionResponse,
} from "./cancel-subscription-types.js";

export type { RetrieveSubscriptionInput, SubscriptionData } from "./retrieve-subscription-types.js";

export type {
  SearchTransactionsInput,
  SearchTransactionsResponse,
  TransactionData,
} from "./search-transactions-types.js";

export type { HasAccessGrantedResponse } from "./has-active-subscription-types.js";
