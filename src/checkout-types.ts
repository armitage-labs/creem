/**
 * Customer information for checkout.
 * If not provided, the authenticated user's email will be used automatically.
 */
export interface CheckoutCustomer {
  /** Customer email address */
  email?: string;
}

/**
 * Parameters for creating a Creem checkout session.
 *
 * @example
 * ```typescript
 * const { data, error } = await authClient.creem.createCheckout({
 *   productId: "prod_abc123",
 *   units: 1,
 *   successUrl: "/thank-you"
 * });
 * ```
 */
export interface CreateCheckoutInput {
  /**
   * The Creem product ID to checkout.
   * You can find this in your Creem dashboard under Products.
   *
   * @required
   * @example "prod_abc123"
   */
  productId: string;

  /**
   * Idempotency key to prevent duplicate checkouts.
   * If provided, subsequent requests with the same requestId will return the same checkout.
   *
   * @optional
   * @example "checkout-user123-20240101"
   */
  requestId?: string;

  /**
   * Number of units to purchase.
   * Must be a positive number. Defaults to 1 if not provided.
   *
   * @optional
   * @default 1
   * @example 3
   */
  units?: number;

  /**
   * Discount code to apply to the checkout.
   * The code must exist and be active in your Creem dashboard.
   *
   * @optional
   * @example "SUMMER2024"
   */
  discountCode?: string;

  /**
   * Customer information for the checkout.
   * If not provided, uses the authenticated user's email from the session.
   *
   * @optional
   * @example { email: "user@example.com" }
   */
  customer?: CheckoutCustomer;

  /**
   * Custom fields to include with the checkout (max 3).
   * Useful for storing additional information about the purchase.
   *
   * @optional
   * @maxItems 3
   * @example [{ custom_field_1: "value1" }, { custom_field_2: "value2" }]
   */
  customField?: Array<Record<string, unknown>>;

  /**
   * URL to redirect to after successful checkout.
   * If not provided, uses the defaultSuccessUrl from plugin options.
   *
   * @optional
   * @example "/thank-you"
   * @example "https://example.com/success"
   */
  successUrl?: string;

  /**
   * Additional metadata to store with the checkout.
   * Automatically includes the authenticated user's ID as `referenceId` if available.
   *
   * @optional
   * @example { orderId: "12345", source: "web" }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Response from creating a checkout session.
 */
export interface CreateCheckoutResponse {
  /**
   * The checkout URL to redirect the user to.
   * This URL directs to Creem's hosted checkout page.
   */
  url: string;

  /**
   * Indicates whether to redirect the user to the checkout URL.
   */
  redirect: boolean;
}
