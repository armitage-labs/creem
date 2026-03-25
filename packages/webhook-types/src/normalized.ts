import type {
  CheckoutEntity,
  CustomerEntity,
  ProductEntity,
  SubscriptionEntity,
  RefundEntity,
  DisputeEntity,
  TransactionEntity,
} from "./entities.js";

// ============================================================================
// Normalized/Expanded Types for Webhook Events
// ============================================================================

export interface NormalizedSubscriptionEntity extends Omit<
  SubscriptionEntity,
  "product" | "customer"
> {
  product: ProductEntity;
  customer: CustomerEntity;
}

export interface NestedSubscriptionInCheckout extends Omit<
  SubscriptionEntity,
  "product" | "customer"
> {
  product: string;
  customer: string;
}

export interface NormalizedCheckoutEntity extends Omit<
  CheckoutEntity,
  "product" | "customer" | "subscription"
> {
  product: ProductEntity;
  customer?: CustomerEntity;
  subscription?: NestedSubscriptionInCheckout;
}

export interface NormalizedRefundEntity extends RefundEntity {
  transaction: TransactionEntity;
}

export interface NormalizedDisputeEntity extends DisputeEntity {
  transaction: TransactionEntity;
}

// ============================================================================
// Normalized Webhook Event Types
// ============================================================================

export interface NormalizedCheckoutCompletedEvent {
  eventType: "checkout.completed";
  id: string;
  created_at: number;
  object: NormalizedCheckoutEntity;
}

export interface NormalizedRefundCreatedEvent {
  eventType: "refund.created";
  id: string;
  created_at: number;
  object: NormalizedRefundEntity;
}

export interface NormalizedDisputeCreatedEvent {
  eventType: "dispute.created";
  id: string;
  created_at: number;
  object: NormalizedDisputeEntity;
}

export interface NormalizedSubscriptionActiveEvent {
  eventType: "subscription.active";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionTrialingEvent {
  eventType: "subscription.trialing";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionCanceledEvent {
  eventType: "subscription.canceled";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionPaidEvent {
  eventType: "subscription.paid";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionExpiredEvent {
  eventType: "subscription.expired";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionUnpaidEvent {
  eventType: "subscription.unpaid";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionUpdateEvent {
  eventType: "subscription.update";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionPastDueEvent {
  eventType: "subscription.past_due";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionPausedEvent {
  eventType: "subscription.paused";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

export interface NormalizedSubscriptionScheduledCancelEvent {
  eventType: "subscription.scheduled_cancel";
  id: string;
  created_at: number;
  object: NormalizedSubscriptionEntity;
}

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
  | NormalizedSubscriptionPausedEvent
  | NormalizedSubscriptionScheduledCancelEvent;
