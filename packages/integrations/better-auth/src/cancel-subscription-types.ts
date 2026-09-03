/**
 * Parameters for canceling a Creem subscription.
 *
 * @example
 * ```typescript
 * const { data, error } = await authClient.creem.cancelSubscription({
 *   id: "sub_abc123"
 * });
 * ```
 */
export interface CancelSubscriptionInput {
  /**
   * The CREEM subscription ID to cancel.
   * You can get this from the subscription object returned by retrieveSubscription
   * or from webhook events.
   *
   * @example "sub_abc123"
   */
  id: string;
}

/**
 * Response from canceling a subscription.
 */
export interface CancelSubscriptionResponse {
  /**
   * Indicates whether the cancellation was successful.
   */
  success: boolean;

  /**
   * Success message confirming the cancellation.
   */
  message: string;
}
