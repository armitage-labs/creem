import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import {
  // Import normalized entity types for flattening
  NormalizedCheckoutEntity,
  NormalizedRefundEntity,
  NormalizedDisputeEntity,
  NormalizedSubscriptionEntity,
} from "./webhook-types";

// ============================================================================
// Flattened Callback Types (for better developer experience)
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
 * All properties are at the top level for easy destructuring.
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
 * All properties are at the top level for easy destructuring.
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
 * All properties are at the top level for easy destructuring.
 */
export type FlatSubscriptionEvent<T extends string> = {
  /** Webhook event type identifier */
  webhookEventType: T;
  /** Unique webhook event ID */
  webhookId: string;
  /** Webhook event creation timestamp */
  webhookCreatedAt: number;
} & NormalizedSubscriptionEntity;

// ============================================================================
// Grant/Revoke Access Types
// ============================================================================

export type GrantAccessReason =
  | "subscription_active"
  | "subscription_trialing"
  | "subscription_paid";

export type RevokeAccessReason = "subscription_paused" | "subscription_expired";

export type AccessChangeReason = GrantAccessReason | RevokeAccessReason;

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

export interface CreemOptions {
  /**
   * Creem API Key
   */
  apiKey: string;
  /**
   * Creem Webhook Secret (for signature verification)
   */
  webhookSecret?: string;
  /**
   * Test mode
   */
  testMode?: boolean;
  /**
   * Base URL
   */
  baseUrl?: string;
  /**
   * Default success URL
   */
  defaultSuccessUrl?: string;
  /**
   * Whether to persist subscription data to the database.
   * When enabled (default: true), the plugin will:
   * - Create/update subscription records in the database
   * - Add subscription and user schema tables
   * - Automatically sync subscription data from Creem webhooks
   *
   * When disabled (false):
   * - No database operations will be performed
   * - No schema tables will be created
   * - You must handle all subscription data management yourself
   *
   * @default true
   */
  persistSubscriptions?: boolean;
  schema?: BetterAuthPluginDBSchema;
  /**
   * Called when a checkout is completed.
   * All properties are flattened for easy destructuring:
   * { webhookEventType, webhookId, webhookCreatedAt, order, product, customer, subscription, status, ... }
   *
   * @example
   * onCheckoutCompleted: async ({ webhookEventType, product, customer, order, subscription }) => {
   *   console.log(`Checkout completed: ${customer?.email} purchased ${product.name}`);
   * }
   */
  onCheckoutCompleted?: (data: FlatCheckoutCompleted) => void;

  /**
   * Called when a refund is created.
   * All properties are flattened for easy destructuring.
   */
  onRefundCreated?: (data: FlatRefundCreated) => void;

  /**
   * Called when a dispute is created.
   * All properties are flattened for easy destructuring.
   */
  onDisputeCreated?: (data: FlatDisputeCreated) => void;

  /**
   * Called when a subscription becomes active.
   * All properties are flattened for easy destructuring:
   * { webhookEventType, webhookId, webhookCreatedAt, product, customer, status, metadata, ... }
   *
   * @example
   * onSubscriptionActive: async ({ product, customer, status }) => {
   *   console.log(`${customer.email} subscribed to ${product.name}`);
   * }
   */
  onSubscriptionActive?: (data: FlatSubscriptionEvent<"subscription.active">) => void;

  /**
   * Called when a subscription is in trialing state.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionTrialing?: (data: FlatSubscriptionEvent<"subscription.trialing">) => void;

  /**
   * Called when a subscription is canceled.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionCanceled?: (data: FlatSubscriptionEvent<"subscription.canceled">) => void;

  /**
   * Called when a subscription is paid.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionPaid?: (data: FlatSubscriptionEvent<"subscription.paid">) => void;

  /**
   * Called when a subscription has expired.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionExpired?: (data: FlatSubscriptionEvent<"subscription.expired">) => void;

  /**
   * Called when a subscription is unpaid.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionUnpaid?: (data: FlatSubscriptionEvent<"subscription.unpaid">) => void;

  /**
   * Called when a subscription is updated.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionUpdate?: (data: FlatSubscriptionEvent<"subscription.update">) => void;

  /**
   * Called when a subscription is past due.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionPastDue?: (data: FlatSubscriptionEvent<"subscription.past_due">) => void;

  /**
   * Called when a subscription is paused.
   * All properties are flattened for easy destructuring.
   */
  onSubscriptionPaused?: (data: FlatSubscriptionEvent<"subscription.paused">) => void;

  /**
   * Called when a user should be granted access to the platform.
   * This is triggered for: active, trialing, and paid subscriptions.
   *
   * All subscription properties are flattened for easy destructuring:
   * { reason, product, customer, status, metadata, current_period_end_date, ... }
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
   * All subscription properties are flattened for easy destructuring:
   * { reason, product, customer, status, metadata, ... }
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
