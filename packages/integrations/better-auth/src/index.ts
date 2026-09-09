import { BetterAuthPlugin, logger } from "better-auth";
import { Creem } from "creem";
import { getSchema } from "./schema.js";
import { createCheckoutEndpoint } from "./checkout.js";
import { createPortalEndpoint } from "./portal.js";
import { createCancelSubscriptionEndpoint } from "./cancel-subscription.js";
import { createRetrieveSubscriptionEndpoint } from "./retrieve-subscription.js";
import { createSearchTransactionsEndpoint } from "./search-transactions.js";
import { createHasAccessGrantedEndpoint } from "./has-active-subscription.js";
import { createWebhookEndpoint } from "./webhook.js";
import { CreemOptions } from "./types.js";

// Export plugin configuration types
export type {
  CreemOptions,
  GrantAccessContext,
  RevokeAccessContext,
  GrantAccessReason,
  RevokeAccessReason,
  FlatCheckoutCompleted,
  FlatRefundCreated,
  FlatDisputeCreated,
  FlatSubscriptionEvent,
} from "./types.js";

// Export checkout types
export type {
  CreateCheckoutInput,
  CreateCheckoutResponse,
  CheckoutCustomer,
  CustomFieldInput,
  TextFieldConfig,
  CheckboxFieldConfig,
} from "./checkout-types.js";

// Export portal types
export type { CreatePortalInput, CreatePortalResponse } from "./portal-types.js";

// Export subscription types
export type {
  CancelSubscriptionInput,
  CancelSubscriptionResponse,
} from "./cancel-subscription-types.js";

export type { RetrieveSubscriptionInput, SubscriptionData } from "./retrieve-subscription-types.js";

// Export transaction types
export type {
  SearchTransactionsInput,
  SearchTransactionsResponse,
  TransactionData,
} from "./search-transactions-types.js";

// Export discount types
export type {
  DiscountEntity,
  DiscountStatus,
  DiscountType,
  DiscountDuration,
} from "@creem_io/webhook-types";

// Export access check types
export type { HasAccessGrantedResponse } from "./has-active-subscription-types.js";

// Export server utilities and types
export type { CreemServerConfig } from "./creem-server.js";
export {
  createCreemClient,
  isActiveSubscription,
  formatCreemDate,
  getDaysUntilRenewal,
  validateWebhookSignature,
  createCheckout,
  createPortal,
  cancelSubscription,
  retrieveSubscription,
  searchTransactions,
  checkSubscriptionAccess,
  getActiveSubscriptions,
} from "./creem-server.js";

/**
 * Creem Better-Auth plugin for payment and subscription management.
 *
 * Provides endpoints for:
 * - `createCheckout` - Create a checkout session for a product
 * - `createPortal` - Create a customer portal session
 * - `cancelSubscription` - Cancel an active subscription
 * - `retrieveSubscription` - Get subscription details
 * - `searchTransactions` - Search transaction history
 * - `hasAccessGranted` - Check if user has an active subscription
 *
 * @param options - Plugin configuration options
 * @returns BetterAuth plugin configuration
 *
 * @example
 * ```typescript
 * import { creem } from "@creem_io/better-auth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     creem({
 *       apiKey: process.env.CREEM_API_KEY!,
 *       testMode: true,
 *       defaultSuccessUrl: "/success",
 *       onGrantAccess: async ({ customer, product, metadata }) => {
 *         // Grant user access to your platform
 *       },
 *       onRevokeAccess: async ({ customer, product, metadata }) => {
 *         // Revoke user access
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export const creem = (options: CreemOptions) => {
  const serverURL = options.testMode ? "https://test-api.creem.io" : "https://api.creem.io";

  const creem = new Creem({
    apiKey: options.apiKey,
    serverURL,
  });

  if (!options.apiKey) {
    logger.warn(
      "[creem] API key is not set. The plugin will initialize, but API functionality will not work until an API key is provided.",
    );
  }

  logger.debug(
    `[creem] Plugin initialized (${options.testMode ? "test" : "production"} mode, persistence: ${options.persistSubscriptions !== false}, webhook: ${!!options.webhookSecret})`,
  );

  return {
    id: "creem",
    endpoints: {
      createCheckout: createCheckoutEndpoint(creem, options),
      createPortal: createPortalEndpoint(creem, options),
      cancelSubscription: createCancelSubscriptionEndpoint(creem, options),
      retrieveSubscription: createRetrieveSubscriptionEndpoint(creem, options),
      searchTransactions: createSearchTransactionsEndpoint(creem, options),
      hasAccessGranted: createHasAccessGrantedEndpoint(options),
      ...(options.webhookSecret && {
        creemWebhook: createWebhookEndpoint(options),
      }),
    },
    schema: getSchema(options),
  } satisfies BetterAuthPlugin;
};
