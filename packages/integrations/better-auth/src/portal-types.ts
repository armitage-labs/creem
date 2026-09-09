/**
 * Parameters for creating a Creem customer portal session.
 *
 * @example
 * ```typescript
 * const { data, error } = await authClient.creem.createPortal({
 *   customerId: "cust_abc123" // optional
 * });
 * ```
 */
export interface CreatePortalInput {
  /**
   * Creem customer ID to create portal for.
   * If not provided, uses the authenticated user's Creem customer ID from session.
   *
   * @example "cust_abc123"
   */
  customerId?: string;
}

/**
 * Response from creating a customer portal session.
 */
export interface CreatePortalResponse {
  /**
   * The customer portal URL to redirect the user to.
   * This URL directs to Creem's hosted customer portal where users can
   * manage their subscriptions, view invoices, and update payment methods.
   */
  url: string;

  /**
   * Indicates whether to redirect the user to the portal URL.
   */
  redirect: boolean;
}
