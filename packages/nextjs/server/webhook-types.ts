/**
 * Creem Webhook Types
 *
 * This file contains all the TypeScript types needed to work with Creem webhooks.
 * It's designed to be standalone and can be copied to external projects.
 *
 * No external dependencies required - just TypeScript!
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * Metadata type for storing arbitrary key-value pairs
 */
export type Metadata = Record<string, string | number | null>;

/**
 * Base entity interface that all webhook objects extend
 */
export interface BaseEntity {
  /** Unique identifier for the object */
  id: string;
  /** Environment mode: test, prod, or sandbox */
  mode: "test" | "prod" | "sandbox";
}

// ============================================================================
// Custom Field Types
// ============================================================================

export interface Text {
  /** Maximum character length constraint for the input */
  max_length?: number;
  /** Minimum character length requirement for the input */
  minimum_length?: number;
  /** The value of the input */
  value?: string;
}

export interface Checkbox {
  /** The markdown text to display for the checkbox */
  label?: string;
  /** The value of the checkbox (checked or not) */
  value?: boolean;
}

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

// ============================================================================
// Customer Entity
// ============================================================================

export interface CustomerEntity extends BaseEntity {
  /** String representing the object's type */
  object: "customer";
  /** Customer email address */
  email: string;
  /** Customer name */
  name?: string;
  /** The ISO alpha-2 country code for the customer */
  country: string;
  /** Creation date of the customer */
  created_at: Date;
  /** Last updated date of the customer */
  updated_at: Date;
}

// ============================================================================
// Product Entity
// ============================================================================

export interface FeatureEntity {
  /** Unique identifier for the feature */
  id: string;
  /** The feature type */
  type: "custom" | "github-repo" | "discord" | "file" | "link" | "licence-key";
  /** A brief description of the feature */
  description: string;
}

export interface ProductEntity extends BaseEntity {
  /** String representing the object's type */
  object: "product";
  /** The name of the product */
  name: string;
  /** A brief description of the product */
  description: string;
  /** URL of the product image. Only png and jpg are supported */
  image_url?: string;
  /** Features of the product */
  features?: FeatureEntity[];
  /** The price of the product in cents. 1000 = $10.00 */
  price: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** Billing method: recurring or one-time */
  billing_type: "recurring" | "one-time";
  /** Billing period */
  billing_period:
    | "every-month"
    | "every-three-months"
    | "every-six-months"
    | "every-year"
    | "once";
  /** Status of the product */
  status: "active" | "archived";
  /** Tax calculation mode */
  tax_mode: "inclusive" | "exclusive";
  /** Tax category for the product */
  tax_category: "saas" | "digital-goods-service" | "ebooks";
  /** The product page URL for express checkout */
  product_url?: string;
  /** The URL to redirect after successful payment */
  default_success_url?: string;
  /** Creation date of the product */
  created_at: Date;
  /** Last updated date of the product */
  updated_at: Date;
}

// ============================================================================
// Transaction Entity
// ============================================================================

export interface TransactionEntity extends BaseEntity {
  /** String representing the object's type */
  object: "transaction";
  /** The transaction amount in cents. 1000 = $10.00 */
  amount: number;
  /** The amount the customer paid in cents. 1000 = $10.00 */
  amount_paid?: number;
  /** The discount amount in cents. 1000 = $10.00 */
  discount_amount?: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** The type of transaction: payment (one time) or invoice (subscription) */
  type: "payment" | "invoice";
  /** The ISO alpha-2 country code where tax is collected */
  tax_country?: string;
  /** The sale tax amount in cents. 1000 = $10.00 */
  tax_amount?: number;
  /** Status of the transaction */
  status:
    | "pending"
    | "paid"
    | "refunded"
    | "partialRefund"
    | "chargedBack"
    | "uncollectible"
    | "declined"
    | "void";
  /** The amount that has been refunded in cents. 1000 = $10.00 */
  refunded_amount?: number | null;
  /** The order ID associated with the transaction */
  order?: string;
  /** The subscription ID associated with the transaction */
  subscription?: string;
  /** The customer ID associated with the transaction */
  customer?: string;
  /** The description of the transaction */
  description: string;
  /** Start period for the invoice as timestamp */
  period_start?: number;
  /** End period for the invoice as timestamp */
  period_end?: number;
  /** Creation date of the transaction as timestamp */
  created_at: number;
}

// ============================================================================
// Order Entity
// ============================================================================

export interface OrderEntity extends BaseEntity {
  /** String representing the object's type */
  object: "order";
  /** The customer ID who placed the order */
  customer?: string;
  /** The product ID associated with the order */
  product: string;
  /** The transaction ID of the order */
  transaction?: string;
  /** The discount ID of the order */
  discount?: string;
  /** The total amount of the order in cents. 1000 = $10.00 */
  amount: number;
  /** The subtotal of the order in cents. 1000 = $10.00 */
  sub_total?: number;
  /** The tax amount of the order in cents. 1000 = $10.00 */
  tax_amount?: number;
  /** The discount amount of the order in cents. 1000 = $10.00 */
  discount_amount?: number;
  /** The amount due for the order in cents. 1000 = $10.00 */
  amount_due?: number;
  /** The amount paid for the order in cents. 1000 = $10.00 */
  amount_paid?: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** The amount in the foreign currency, if applicable */
  fx_amount?: number;
  /** Three-letter ISO code of the foreign currency, if applicable */
  fx_currency?: string;
  /** The exchange rate used for converting between currencies */
  fx_rate?: number;
  /** Current status of the order */
  status: "pending" | "paid";
  /** The type of order */
  type: "recurring" | "onetime";
  /** The affiliate ID associated with the order, if applicable */
  affiliate?: string;
  /** Creation date of the order */
  created_at: Date;
  /** Last updated date of the order */
  updated_at: Date;
}

// ============================================================================
// License Entities
// ============================================================================

export interface LicenseInstanceEntity extends BaseEntity {
  /** String representing the object's type */
  object: "license-instance";
  /** The name of the license instance */
  name: string;
  /** The status of the license instance */
  status: "active" | "deactivated";
  /** The creation date of the license instance */
  created_at: Date;
}

export interface LicenseEntity extends BaseEntity {
  /** String representing the object's type */
  object: "license";
  /** The current status of the license key */
  status: "inactive" | "active" | "expired" | "disabled";
  /** The license key */
  key: string;
  /** The number of instances that this license key was activated */
  activation: number;
  /** The activation limit. Null if activations are unlimited */
  activation_limit: number | null;
  /** The date the license key expires. Null if no expiration */
  expires_at: Date | null;
  /** The creation date of the license key */
  created_at: Date;
  /** Associated license instance */
  instance?: LicenseInstanceEntity | null;
}

export interface ProductFeatureEntity {
  /** License key issued for the order */
  license?: LicenseEntity;
}

// ============================================================================
// Subscription Entities
// ============================================================================

export interface SubscriptionItemEntity extends BaseEntity {
  /** String representing the object's type */
  object: "subscription_item";
  /** The product ID associated with the subscription item */
  product_id: string;
  /** The price ID associated with the subscription item */
  price_id: string;
  /** The number of units for the subscription item */
  units?: number;
  /** The creation date of the subscription item */
  created_at: Date;
  /** The last updated date of the subscription item */
  updated_at: Date;
}

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "unpaid"
  | "paused"
  | "trialing";

export interface SubscriptionEntity extends BaseEntity {
  /** String representing the object's type */
  object: "subscription";
  /** The product associated with the subscription */
  product: ProductEntity | string;
  /** The customer who owns the subscription */
  customer: CustomerEntity | string;
  /** Subscription items */
  items?: SubscriptionItemEntity[];
  /** The method used for collecting payments */
  collection_method: "charge_automatically";
  /** The current status of the subscription */
  status: SubscriptionStatus;
  /** The ID of the last paid transaction */
  last_transaction_id?: string;
  /** The last paid transaction */
  last_transaction?: TransactionEntity;
  /** The date of the last paid transaction */
  last_transaction_date?: Date;
  /** The date when the next subscription transaction will be charged */
  next_transaction_date?: Date;
  /** The start date of the current subscription period */
  current_period_start_date: Date;
  /** The end date of the current subscription period */
  current_period_end_date: Date;
  /** The date when the subscription was canceled, if applicable */
  canceled_at: Date | null;
  /** The date when the subscription was created */
  created_at: Date;
  /** The date when the subscription was last updated */
  updated_at: Date;
  /** Optional metadata */
  metadata?: Metadata;
}

// ============================================================================
// Checkout Entity
// ============================================================================

export type CheckoutStatus = "pending" | "processing" | "completed" | "expired";

export interface CheckoutEntity extends BaseEntity {
  /** String representing the object's type */
  object: "checkout";
  /** Status of the checkout */
  status: CheckoutStatus;
  /** Request ID to identify and track each checkout request */
  request_id: string;
  /** The product associated with the checkout session */
  product: ProductEntity | string;
  /** The number of units for the product */
  units: number;
  /** The order associated with the checkout session */
  order?: OrderEntity;
  /** The subscription associated with the checkout session */
  subscription?: SubscriptionEntity | string;
  /** The customer associated with the checkout session */
  customer?: CustomerEntity | string;
  /** Additional information collected during checkout */
  custom_fields?: CustomField[];
  /** The URL to complete the payment */
  checkout_url?: string;
  /** The URL to redirect after checkout is completed */
  success_url?: string;
  /** Features issued for the order */
  feature?: ProductFeatureEntity;
  /** Metadata for the checkout */
  metadata?: Metadata;
}

// ============================================================================
// Refund Entity
// ============================================================================

export interface RefundEntity extends BaseEntity {
  /** String representing the object's type */
  object: "refund";
  /** Status of the refund */
  status: "pending" | "succeeded" | "canceled" | "failed";
  /** The refunded amount in cents. 1000 = $10.00 */
  refund_amount: number;
  /** Three-letter ISO currency code, in uppercase */
  refund_currency: string;
  /** Reason for the refund */
  reason: "duplicate" | "fraudulent" | "requested_by_customer" | "other";
  /** The transaction associated with the refund */
  transaction: TransactionEntity;
  /** The checkout associated with the refund */
  checkout?: CheckoutEntity | string;
  /** The order associated with the refund */
  order?: OrderEntity | string;
  /** The subscription associated with the refund */
  subscription?: SubscriptionEntity | string;
  /** The customer associated with the refund */
  customer?: CustomerEntity | string;
  /** Creation date as timestamp */
  created_at: number;
}

// ============================================================================
// Dispute Entity
// ============================================================================

export interface DisputeEntity extends BaseEntity {
  /** String representing the object's type */
  object: "dispute";
  /** The disputed amount in cents. 1000 = $10.00 */
  amount: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** The transaction associated with the dispute */
  transaction: TransactionEntity;
  /** The checkout associated with the dispute */
  checkout?: CheckoutEntity | string;
  /** The order associated with the dispute */
  order?: OrderEntity | string;
  /** The subscription associated with the dispute */
  subscription?: SubscriptionEntity | string;
  /** The customer associated with the dispute */
  customer?: CustomerEntity | string;
  /** Creation date as timestamp */
  created_at: number;
}

// ============================================================================
// Webhook Event Types
// ============================================================================

/**
 * All possible webhook event types in Creem
 */
export type WebhookEventType =
  | "checkout.completed"
  | "refund.created"
  | "dispute.created"
  | "subscription.active"
  | "subscription.trialing"
  | "subscription.canceled"
  | "subscription.paid"
  | "subscription.expired"
  | "subscription.unpaid"
  | "subscription.update"
  | "subscription.past_due"
  | "subscription.paused";

/**
 * Main webhook event structure (generic)
 */
export interface WebhookEventEntity {
  /** The event name */
  eventType: WebhookEventType;
  /** Unique identifier for the event */
  id: string;
  /** Creation date of the event as timestamp */
  created_at: number;
  /** Object related to the event */
  object:
    | CheckoutEntity
    | CustomerEntity
    | OrderEntity
    | ProductEntity
    | SubscriptionEntity
    | RefundEntity
    | DisputeEntity
    | TransactionEntity;
}

// ============================================================================
// Normalized/Expanded Types for Webhook Events (Developer-Friendly)
// ============================================================================

/**
 * Subscription entity as returned in subscription webhook events.
 * The product and customer are always expanded (full objects, never just IDs).
 */
export interface NormalizedSubscriptionEntity
  extends Omit<SubscriptionEntity, "product" | "customer"> {
  /** The product associated with the subscription (always expanded in webhooks) */
  product: ProductEntity;
  /** The customer who owns the subscription (always expanded in webhooks) */
  customer: CustomerEntity;
}

/**
 * Subscription entity as nested in checkout.completed events.
 * Note: In checkout events, the nested subscription has product/customer as ID strings.
 */
export interface NestedSubscriptionInCheckout
  extends Omit<SubscriptionEntity, "product" | "customer"> {
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
export interface NormalizedCheckoutEntity
  extends Omit<CheckoutEntity, "product" | "customer" | "subscription"> {
  /** The product associated with the checkout (always expanded in webhooks) */
  product: ProductEntity;
  /** The customer associated with the checkout (always expanded in webhooks) */
  customer?: CustomerEntity;
  /** The subscription associated with the checkout (expanded, but nested fields are IDs) */
  subscription?: NestedSubscriptionInCheckout;
}

/**
 * Refund entity as returned in refund.created webhook events.
 */
export interface NormalizedRefundEntity extends RefundEntity {
  /** The transaction is always expanded */
  transaction: TransactionEntity;
}

/**
 * Dispute entity as returned in dispute.created webhook events.
 */
export interface NormalizedDisputeEntity extends DisputeEntity {
  /** The transaction is always expanded */
  transaction: TransactionEntity;
}

// ============================================================================
// Normalized Webhook Event Types
// ============================================================================

/**
 * Checkout completed event with normalized/expanded objects.
 */
export interface NormalizedCheckoutCompletedEvent {
  eventType: "checkout.completed";
  id: string;
  created_at: number;
  object: NormalizedCheckoutEntity;
}

/**
 * Refund created event with normalized/expanded objects.
 */
export interface NormalizedRefundCreatedEvent {
  eventType: "refund.created";
  id: string;
  created_at: number;
  object: NormalizedRefundEntity;
}

/**
 * Dispute created event with normalized/expanded objects.
 */
export interface NormalizedDisputeCreatedEvent {
  eventType: "dispute.created";
  id: string;
  created_at: number;
  object: NormalizedDisputeEntity;
}

/**
 * Subscription active event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionActiveEvent {
  eventType: "subscription.active";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription trialing event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionTrialingEvent {
  eventType: "subscription.trialing";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription canceled event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionCanceledEvent {
  eventType: "subscription.canceled";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription paid event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionPaidEvent {
  eventType: "subscription.paid";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription expired event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionExpiredEvent {
  eventType: "subscription.expired";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription unpaid event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionUnpaidEvent {
  eventType: "subscription.unpaid";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription update event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionUpdateEvent {
  eventType: "subscription.update";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription past due event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionPastDueEvent {
  eventType: "subscription.past_due";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Subscription paused event with normalized/expanded objects.
 */
export interface NormalizedSubscriptionPausedEvent {
  eventType: "subscription.paused";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

/**
 * Discriminated union of all normalized webhook events.
 */
export type NormalizedWebhookEvent =
  | NormalizedCheckoutCompletedEvent
  | NormalizedRefundCreatedEvent
  | NormalizedDisputeCreatedEvent
  | NormalizedSubscriptionActiveEvent
  | NormalizedSubscriptionTrialingEvent
  | NormalizedSubscriptionCanceledEvent
  | NormalizedSubscriptionPaidEvent
  | NormalizedSubscriptionExpiredEvent
  | NormalizedSubscriptionUnpaidEvent
  | NormalizedSubscriptionUpdateEvent
  | NormalizedSubscriptionPastDueEvent
  | NormalizedSubscriptionPausedEvent;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Union type of all webhook entities
 */
export type WebhookEntity =
  | CheckoutEntity
  | CustomerEntity
  | OrderEntity
  | ProductEntity
  | SubscriptionEntity
  | RefundEntity
  | DisputeEntity
  | TransactionEntity;

/**
 * Type guard to check if an object is a valid webhook entity
 */
export function isWebhookEntity(obj: unknown): obj is WebhookEntity {
  if (!obj || typeof obj !== "object") return false;
  const entity = obj as Record<string, unknown>;
  return (
    typeof entity.object === "string" &&
    [
      "checkout",
      "customer",
      "order",
      "product",
      "subscription",
      "refund",
      "dispute",
      "transaction",
    ].includes(entity.object)
  );
}

/**
 * Type guard to check if an object is a valid webhook event entity
 */
export function isWebhookEventEntity(obj: unknown): obj is WebhookEventEntity {
  if (!obj || typeof obj !== "object") return false;
  const event = obj as Record<string, unknown>;
  return (
    typeof event.eventType === "string" &&
    typeof event.id === "string" &&
    typeof event.created_at === "number" &&
    "object" in event &&
    isWebhookEntity(event.object)
  );
}
