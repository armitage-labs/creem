/**
 * Customer information for checkout.
 * If not provided, the authenticated user's email will be used automatically.
 */
export interface CheckoutCustomer {
  /** Customer email address */
  email?: string;
}

/**
 * Configuration for a text custom field.
 */
export interface TextFieldConfig {
  /** Maximum character length */
  maxLength?: number;
  /** Minimum character length */
  minLength?: number;
}

/**
 * Configuration for a checkbox custom field.
 */
export interface CheckboxFieldConfig {
  /** Label displayed next to the checkbox */
  label?: string;
}

/**
 * A custom field to display on the checkout page.
 * Up to 3 custom fields can be added per checkout.
 *
 * @example
 * ```typescript
 * const field: CustomFieldInput = {
 *   type: "text",
 *   key: "company_name",
 *   label: "Company Name",
 *   optional: false,
 *   text: { maxLength: 100 }
 * };
 * ```
 */
export interface CustomFieldInput {
  /** Field type */
  type: "text" | "checkbox";
  /** Unique key for the field (max 200 chars) */
  key: string;
  /** Display label (max 50 chars) */
  label: string;
  /** Whether the field is optional */
  optional?: boolean;
  /** Text field configuration (only for type "text") */
  text?: TextFieldConfig;
  /** Checkbox field configuration (only for type "checkbox") */
  checkbox?: CheckboxFieldConfig;
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
   * @example "prod_abc123"
   */
  productId: string;

  /**
   * Idempotency key to prevent duplicate checkouts.
   * If provided, subsequent requests with the same requestId will return the same checkout.
   *
   * @example "checkout-user123-20240101"
   */
  requestId?: string;

  /**
   * Number of units to purchase.
   * Must be a positive number. Defaults to 1 if not provided.
   *
   * Defaults to 1.
   *
   * @example 3
   */
  units?: number;

  /**
   * Discount code to apply to the checkout.
   * The code must exist and be active in your Creem dashboard.
   *
   * @example "SUMMER2024"
   */
  discountCode?: string;

  /**
   * Customer information for the checkout.
   * If not provided, uses the authenticated user's email from the session.
   *
   * @example { email: "user@example.com" }
   */
  customer?: CheckoutCustomer;

  /**
   * Custom fields to display on the checkout page (max 3).
   * Collect additional information from customers during checkout.
   *
   * @example
   * ```typescript
   * customFields: [
   *   { type: "text", key: "company", label: "Company Name", text: { maxLength: 100 } },
   *   { type: "checkbox", key: "terms", label: "Accept Terms" }
   * ]
   * ```
   */
  customFields?: CustomFieldInput[];

  /**
   * @deprecated Use `customFields` instead.
   */
  customField?: CustomFieldInput[];

  /**
   * URL to redirect to after successful checkout.
   * If not provided, uses the defaultSuccessUrl from plugin options.
   *
   * @example "/thank-you"
   * @example "https://example.com/success"
   */
  successUrl?: string;

  /**
   * Additional metadata to store with the checkout.
   * Automatically includes the authenticated user's ID as `referenceId` if available.
   *
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
