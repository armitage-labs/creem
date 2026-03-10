import {
  NormalizedCheckoutEntity,
  NormalizedRefundEntity,
  NormalizedDisputeEntity,
  NormalizedSubscriptionEntity,
} from "./server/webhook-types";

export interface CheckoutCustomer {
  /** Customer email address */
  email?: string;
  /** Customer name */
  name?: string;
}

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
   * If not provided, uses the authenticated user's email and name from the session.
   *
   * @optional
   * @example { email: "user@example.com", name: "John Doe" }
   */
  customer?: CheckoutCustomer;

  /**
   * Custom fields to include with the checkout.
   * Useful for storing additional information about the purchase.
   *
   * @optional
   * @example { custom_field_1: "value1", custom_field_2: "value2" }
   */
  customFields?: Record<string, unknown>;

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

  /**
   * User ID to associate with the checkout.
   * Automatically includes the authenticated user's ID as `referenceId` if available.
   *
   * @optional
   * @example "user123"
   */
  referenceId?: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Flattened checkout.completed callback parameter.
 * All properties are at the top level for easy destructuring.
 */
export type FlatCheckoutCompleted = {
  /** Webhook event type identifier */
  webhookEventType: "checkout.completed";
  /** Unique webhook event ID */
  webhookId: string;
  /** Webhook event creation timestamp */
  webhookCreatedAt: number;
} & NormalizedCheckoutEntity;

/**
 * Flattened refund.created callback parameter.
 */
export type FlatRefundCreated = {
  /** Webhook event type identifier */
  webhookEventType: "refund.created";
  /** Unique webhook event ID */
  webhookId: string;
  /** Webhook event creation timestamp */
  webhookCreatedAt: number;
} & NormalizedRefundEntity;

/**
 * Flattened dispute.created callback parameter.
 */
export type FlatDisputeCreated = {
  /** Webhook event type identifier */
  webhookEventType: "dispute.created";
  /** Unique webhook event ID */
  webhookId: string;
  /** Webhook event creation timestamp */
  webhookCreatedAt: number;
} & NormalizedDisputeEntity;

/**
 * Flattened subscription event callback parameter.
 */
export type FlatSubscriptionEvent<T extends string> = {
  /** Webhook event type identifier */
  webhookEventType: T;
  /** Unique webhook event ID */
  webhookId: string;
  /** Webhook event creation timestamp */
  webhookCreatedAt: number;
} & NormalizedSubscriptionEntity;

/**
 * Reasons for granting access
 */
export type GrantAccessReason =
  | "subscription_active"
  | "subscription_trialing"
  | "subscription_paid";

/**
 * Reasons for revoking access
 */
export type RevokeAccessReason = "subscription_paused" | "subscription_expired";

/**
 * Context passed to onGrantAccess callback.
 * All subscription properties are flattened for easy destructuring.
 */
export type GrantAccessContext = {
  /** The reason for granting access */
  reason: GrantAccessReason;
} & NormalizedSubscriptionEntity;

/**
 * Context passed to onRevokeAccess callback.
 * All subscription properties are flattened for easy destructuring.
 */
export type RevokeAccessContext = {
  /** The reason for revoking access */
  reason: RevokeAccessReason;
} & NormalizedSubscriptionEntity;

/**
 * Webhook configuration options
 */
export interface WebhookOptions {
  /**
   * Creem Webhook Secret (for signature verification)
   * @required
   */
  webhookSecret: string;

  /**
   * Called when a checkout is completed.
   * All properties are flattened for easy destructuring.
   *
   * @example
   * onCheckoutCompleted: async ({ webhookEventType, product, customer, order, subscription }) => {
   *   console.log(`Checkout completed: ${customer?.email} purchased ${product.name}`);
   * }
   */
  onCheckoutCompleted?: (data: FlatCheckoutCompleted) => void | Promise<void>;

  /**
   * Called when a refund is created.
   */
  onRefundCreated?: (data: FlatRefundCreated) => void | Promise<void>;

  /**
   * Called when a dispute is created.
   */
  onDisputeCreated?: (data: FlatDisputeCreated) => void | Promise<void>;

  /**
   * Called when a subscription becomes active.
   *
   * @example
   * onSubscriptionActive: async ({ product, customer, status }) => {
   *   console.log(`${customer.email} subscribed to ${product.name}`);
   * }
   */
  onSubscriptionActive?: (
    data: FlatSubscriptionEvent<"subscription.active">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is in trialing state.
   */
  onSubscriptionTrialing?: (
    data: FlatSubscriptionEvent<"subscription.trialing">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is canceled.
   */
  onSubscriptionCanceled?: (
    data: FlatSubscriptionEvent<"subscription.canceled">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is paid.
   */
  onSubscriptionPaid?: (
    data: FlatSubscriptionEvent<"subscription.paid">
  ) => void | Promise<void>;

  /**
   * Called when a subscription has expired.
   */
  onSubscriptionExpired?: (
    data: FlatSubscriptionEvent<"subscription.expired">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is unpaid.
   */
  onSubscriptionUnpaid?: (
    data: FlatSubscriptionEvent<"subscription.unpaid">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is updated.
   */
  onSubscriptionUpdate?: (
    data: FlatSubscriptionEvent<"subscription.update">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is past due.
   */
  onSubscriptionPastDue?: (
    data: FlatSubscriptionEvent<"subscription.past_due">
  ) => void | Promise<void>;

  /**
   * Called when a subscription is paused.
   */
  onSubscriptionPaused?: (
    data: FlatSubscriptionEvent<"subscription.paused">
  ) => void | Promise<void>;

  /**
   * Called when a user should be granted access to the platform.
   * This is triggered for: active, trialing, and paid subscriptions.
   *
   * NOTE: This may be called multiple times for the same user/subscription.
   * Implement this as an idempotent operation (safe to call repeatedly).
   *
   * @example
   * onGrantAccess: async ({ reason, product, customer, metadata }) => {
   *   const userId = metadata?.referenceId as string;
   *   console.log(`Granting ${reason} to ${customer.email} for ${product.name}`);
   *   // Your database logic here
   * }
   */
  onGrantAccess?: (context: GrantAccessContext) => void | Promise<void>;

  /**
   * Called when a user's access should be revoked.
   * This is triggered for: paused, expired, and canceled (after period ends) subscriptions.
   *
   * NOTE: This may be called multiple times for the same user/subscription.
   * Implement this as an idempotent operation (safe to call repeatedly).
   *
   * @example
   * onRevokeAccess: async ({ reason, product, customer, metadata }) => {
   *   const userId = metadata?.referenceId as string;
   *   console.log(`Revoking access (${reason}) from ${customer.email}`);
   *   // Your database logic here
   * }
   */
  onRevokeAccess?: (context: RevokeAccessContext) => void | Promise<void>;
}
