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
   * @example "sub_abc123"
   */
  id: string;
}

/**
 * Subscription status values from Creem API.
 */
export type SubscriptionDataStatus =
  | "active"
  | "canceled"
  | "unpaid"
  | "paused"
  | "trialing"
  | "scheduled_cancel";

/**
 * Subscription item from Creem API.
 */
export interface SubscriptionItemData {
  /** Unique identifier */
  id: string;
  /** Environment mode */
  mode: "test" | "prod" | "sandbox";
  /** Object type */
  object: "subscription_item";
  /** The product ID */
  productId?: string;
  /** The price ID */
  priceId?: string;
  /** Number of units */
  units?: number;
}

/**
 * Creem subscription object returned from the API.
 */
export interface SubscriptionData {
  /** Unique subscription identifier */
  id: string;
  /** Environment mode */
  mode: "test" | "prod" | "sandbox";
  /** Object type */
  object: "subscription";
  /** The product associated with the subscription (ID or expanded object) */
  product:
    | { id: string; name: string; price: number; currency: string; [key: string]: unknown }
    | string;
  /** The customer associated with the subscription (ID or expanded object) */
  customer: { id: string; email: string; name?: string; [key: string]: unknown } | string;
  /** Subscription items */
  items?: SubscriptionItemData[];
  /** The method used for collecting payments */
  collectionMethod: "charge_automatically";
  /** Current subscription status */
  status: SubscriptionDataStatus;
  /** The ID of the last paid transaction */
  lastTransactionId?: string;
  /** The date of the last paid transaction */
  lastTransactionDate?: Date;
  /** The date when the next subscription transaction will be charged */
  nextTransactionDate?: Date;
  /** The start date of the current subscription period */
  currentPeriodStartDate: Date;
  /** The end date of the current subscription period */
  currentPeriodEndDate: Date;
  /** The date when the subscription was canceled, if applicable */
  canceledAt: Date | null;
  /** The date when the subscription was created */
  createdAt: Date;
  /** The date when the subscription was last updated */
  updatedAt: Date;
  /** The discount applied to the subscription */
  discount?: object;
  /** Optional metadata */
  metadata?: Record<string, string | number | null>;
}
