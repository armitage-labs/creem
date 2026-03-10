import { BaseEntity, Metadata } from "./general";
import { Product, ProductFeature } from "./products";
import { Order } from "./transactions";
import { Subscription } from "./subscriptions";
import { Customer } from "./customer";

/**
 * Text field configuration for custom fields
 */
export interface Text {
  /** Maximum character length constraint for the input */
  maxLength?: number;
  /** Minimum character length requirement for the input */
  minimumLength?: number;
  /**
   * @deprecated Use `minimumLength` instead
   */
  minLength?: number;
  /** The value of the input */
  value?: string;
}

/**
 * Checkbox field configuration for custom fields
 */
export interface Checkbox {
  /** The markdown text to display for the checkbox */
  label?: string;
  /** The value of the checkbox (checked or not) */
  value?: boolean;
}

/**
 * Custom field configuration
 */
export interface CustomField {
  /** The type of the field */
  type: "text" | "checkbox";
  /** Unique key for custom field. Must be unique, alphanumeric, up to 200 characters */
  key: string;
  /** The label for the field, displayed to the customer, up to 50 characters */
  label: string;
  /** Whether the customer is required to complete the field. Defaults to false */
  optional?: boolean;
  /** Configuration for text field type */
  text?: Text;
  /** Configuration for checkbox field type */
  checkbox?: Checkbox;
}

/**
 * Checkout status
 */
export type CheckoutStatus = "pending" | "processing" | "completed" | "expired";

/**
 * Checkout entity
 */
export interface Checkout extends BaseEntity {
  /** String representing the object's type */
  object: "checkout";
  /** Status of the checkout */
  status: CheckoutStatus;
  /** Request ID to identify and track each checkout request */
  requestId?: string;
  /** The product associated with the checkout session */
  product: Product | string;
  /** The number of units for the product */
  units: number;
  /** The order associated with the checkout session */
  order?: Order;
  /** The subscription associated with the checkout session */
  subscription?: Subscription | string;
  /** The customer associated with the checkout session */
  customer?: Customer | string;
  /** Additional information collected during checkout */
  customFields?: CustomField[];
  /** The URL to complete the payment */
  checkoutUrl?: string;
  /** The URL to redirect after checkout is completed */
  successUrl?: string;
  /** Features issued for the order */
  feature?: ProductFeature[];
  /** Metadata for the checkout */
  metadata?: Metadata;
}

/**
 * Subscription entity as nested in checkout.completed events.
 * Note: In checkout events, the nested subscription has product/customer as ID strings.
 */
export interface NestedSubscriptionInCheckout extends Omit<Subscription, "product" | "customer"> {
  /** The product ID (string, not expanded in nested subscription) */
  product: string;
  /** The customer ID (string, not expanded in nested subscription) */
  customer: string;
}

/**
 * Checkout entity as returned in checkout.completed webhook events.
 * Product and customer are always expanded.
 * Subscription is also expanded but has product/customer as strings inside it.
 */
export interface NormalizedCheckout extends Omit<
  Checkout,
  "product" | "customer" | "subscription"
> {
  /** The product associated with the checkout (always expanded in webhooks) */
  product: Product;
  /** The customer associated with the checkout (always expanded in webhooks) */
  customer?: Customer;
  /** The subscription associated with the checkout (expanded, but nested fields are IDs) */
  subscription?: NestedSubscriptionInCheckout;
}

/**
 * Customer information for checkout creation
 */
export interface CheckoutCustomer {
  /** Unique identifier of the customer. You may specify only one of these parameters: id or email. */
  id?: string;
  /** Customer email address. You may only specify one of these parameters: id, email. */
  email?: string;
}

/**
 * Request payload for creating a checkout session
 */
export interface CreateCheckoutRequest {
  /** Idempotency key to prevent duplicate checkouts */
  requestId?: string;
  /** The Creem product ID to checkout */
  productId: string;
  /** Number of units to purchase. Defaults to 1 if not provided */
  units?: number;
  /** Discount code to apply to the checkout */
  discountCode?: string;
  /** Customer information for the checkout */
  customer?: CheckoutCustomer;
  /** Custom fields to include with the checkout (max 3) */
  customFields?: CustomField[];
  /**
   * @deprecated Use `customFields` instead
   */
  customField?: CustomField[];
  /** URL to redirect to after successful checkout */
  successUrl?: string;
  /** Additional metadata to store with the checkout */
  metadata?: Metadata;
}

/**
 * Request payload for retrieving a checkout session
 */
export interface GetCheckoutRequest {
  /** The checkout ID to retrieve */
  checkoutId: string;
}
