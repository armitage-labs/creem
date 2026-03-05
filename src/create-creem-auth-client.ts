import { createAuthClient } from "better-auth/react";
import type { CreateCheckoutInput, CreateCheckoutResponse } from "./checkout-types.js";
import type { CreatePortalInput, CreatePortalResponse } from "./portal-types.js";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResponse,
} from "./cancel-subscription-types.js";
import type { RetrieveSubscriptionInput, SubscriptionData } from "./retrieve-subscription-types.js";
import type {
  SearchTransactionsInput,
  SearchTransactionsResponse,
} from "./search-transactions-types.js";
import type { HasAccessGrantedResponse } from "./has-active-subscription-types.js";

/**
 * Standard Better-Auth response type
 */
type AuthResponse<T> = Promise<{
  data: T | null;
  error: { message: string; status?: number } | null;
}>;

/**
 * Creem client methods with clean, well-documented types
 */
export interface CreemClient {
  /**
   * Create a checkout session for a product.
   *
   * **Required:**
   * - `productId` - The Creem product ID
   *
   * **Optional:**
   * - `units` - Number of units (default: 1)
   * - `successUrl` - Redirect URL after checkout
   * - `discountCode` - Discount code to apply
   * - `customer` - Customer info (defaults to session user)
   * - `metadata` - Additional metadata
   * - `requestId` - Idempotency key
   * - `customField` - Up to 3 custom fields
   *
   * @example
   * ```typescript
   * const { data } = await authClient.creem.createCheckout({
   *   productId: "prod_abc123",
   *   units: 1,
   *   successUrl: "/success"
   * });
   * if (data?.url) window.location.href = data.url;
   * ```
   */
  createCheckout(input: CreateCheckoutInput): AuthResponse<CreateCheckoutResponse>;

  /**
   * Create a customer portal session.
   *
   * Opens the Creem customer portal where users can manage their subscriptions,
   * view invoices, and update payment methods.
   *
   * **Optional:**
   * - `customerId` - Override customer ID (defaults to session user's Creem customer ID)
   *
   * @param input - Portal parameters (optional)
   * @returns Promise with portal URL and redirect flag, or error
   *
   * @example
   * ```typescript
   * // Use default customer from session
   * const { data } = await authClient.creem.createPortal();
   *
   * // Or specify a customer ID
   * const { data } = await authClient.creem.createPortal({
   *   customerId: "cust_abc123"
   * });
   *
   * if (data?.url) window.location.href = data.url;
   * ```
   */
  createPortal(input?: CreatePortalInput): AuthResponse<CreatePortalResponse>;

  /**
   * Cancel an active subscription.
   *
   * Cancels a subscription immediately or at the end of the current billing period,
   * depending on your Creem settings.
   *
   * **Required:**
   * - `id` - The subscription ID to cancel
   *
   * @param input - Cancellation parameters
   * @returns Promise with success status and message, or error
   *
   * @example
   * ```typescript
   * const { data, error } = await authClient.creem.cancelSubscription({
   *   id: "sub_abc123"
   * });
   *
   * if (data?.success) {
   *   console.log(data.message);
   * }
   * ```
   */
  cancelSubscription(input: CancelSubscriptionInput): AuthResponse<CancelSubscriptionResponse>;

  /**
   * Retrieve subscription details.
   *
   * Gets detailed information about a subscription including status,
   * product details, customer information, and billing dates.
   *
   * **Required:**
   * - `id` - The subscription ID
   *
   * @param input - Retrieval parameters
   * @returns Promise with subscription data, or error
   *
   * @example
   * ```typescript
   * const { data } = await authClient.creem.retrieveSubscription({
   *   id: "sub_abc123"
   * });
   *
   * if (data) {
   *   console.log(`Status: ${data.status}`);
   *   console.log(`Product: ${data.product.name}`);
   *   console.log(`Price: ${data.product.price} ${data.product.currency}`);
   * }
   * ```
   */
  retrieveSubscription(input: RetrieveSubscriptionInput): AuthResponse<SubscriptionData>;

  /**
   * Search transaction history.
   *
   * Searches for transactions with optional filters for customer, product, or order.
   * Supports pagination for large result sets.
   *
   * **All parameters are optional:**
   * - `customerId` - Filter by customer ID (defaults to session user)
   * - `productId` - Filter by product ID
   * - `orderId` - Filter by order ID
   * - `pageNumber` - Page number (starts at 1)
   * - `pageSize` - Number of results per page
   *
   * @param input - Search parameters (optional)
   * @returns Promise with transaction list, or error
   *
   * @example
   * ```typescript
   * // Get all transactions for current user
   * const { data } = await authClient.creem.searchTransactions();
   *
   * // Search with filters and pagination
   * const { data } = await authClient.creem.searchTransactions({
   *   customerId: "cust_abc123",
   *   productId: "prod_xyz789",
   *   pageNumber: 2,
   *   pageSize: 50
   * });
   *
   * if (data?.transactions) {
   *   data.transactions.forEach(tx => {
   *     console.log(`${tx.type}: ${tx.amount} ${tx.currency}`);
   *   });
   * }
   * ```
   */
  searchTransactions(input?: SearchTransactionsInput): AuthResponse<SearchTransactionsResponse>;

  /**
   * Check if the current user has access granted.
   *
   * Verifies if the authenticated user has an active subscription or access
   * to your platform based on their Creem subscription status.
   *
   * @returns Promise with access status, or error
   *
   * @example
   * ```typescript
   * const { data } = await authClient.creem.hasAccessGranted();
   *
   * if (data?.hasAccess) {
   *   console.log("User has active subscription");
   * }
   * ```
   */
  hasAccessGranted(): AuthResponse<HasAccessGrantedResponse>;
}

/**
 * Helper function to create an auth client with proper Creem types.
 *
 * This function wraps Better-Auth's `createAuthClient` and provides proper
 * TypeScript types for the Creem plugin methods, giving you clean IntelliSense
 * with full documentation.
 *
 * @param config - Better-Auth client configuration with Creem plugin
 * @returns Auth client with properly typed Creem methods
 *
 * @example
 * ```typescript
 * import { createCreemAuthClient, creemClient } from "./lib/creem-betterauth";
 *
 * export const authClient = createCreemAuthClient({
 *   plugins: [creemClient()]
 * });
 *
 * // Now you get clean type hints!
 * const { data } = await authClient.creem.createCheckout({
 *   productId: "prod_abc123"
 * });
 * ```
 */
export function createCreemAuthClient(config: Parameters<typeof createAuthClient>[0]) {
  const baseClient = createAuthClient(config);

  return baseClient as typeof baseClient & {
    creem: CreemClient;
  };
}
