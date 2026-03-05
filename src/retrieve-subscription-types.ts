/**
 * Parameters for retrieving a Creem subscription.
 *
 * @example
 * ```typescript
 * const { data, error } = await authClient.creem.retrieveSubscription({
 *   id: "sub_abc123"
 * });
 * ```
 */
export interface RetrieveSubscriptionInput {
  /**
   * The subscription ID to retrieve.
   * You can get this from webhook events or from your database.
   *
   * @required
   * @example "sub_abc123"
   */
  id: string;
}

/**
 * Creem subscription object returned from the API.
 */
export interface SubscriptionData {
  /**
   * Unique subscription identifier
   */
  id: string;

  /**
   * Current subscription status
   * @example "active", "paused", "canceled", "expired"
   */
  status: string;

  /**
   * Product information
   */
  product: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };

  /**
   * Customer information
   */
  customer: {
    id: string;
    email: string;
    name?: string;
  };

  /**
   * Current billing period end date (Unix timestamp)
   */
  current_period_end_date?: number;

  /**
   * Next billing date (Unix timestamp)
   */
  next_billing_date?: number;

  /**
   * Subscription creation date (Unix timestamp)
   */
  created_at: number;

  /**
   * Custom metadata stored with the subscription
   */
  metadata?: Record<string, unknown>;

  /**
   * Additional subscription properties from Creem API
   */
  [key: string]: unknown;
}
