import type {
  CheckoutEntity,
  CustomerEntity,
  OrderEntity,
  ProductEntity,
  SubscriptionEntity,
  RefundEntity,
  DisputeEntity,
  TransactionEntity,
} from "./entities.js";

// ============================================================================
// Webhook Event Types
// ============================================================================

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
  | "subscription.paused"
  | "subscription.scheduled_cancel";

export interface WebhookEventEntity {
  eventType: WebhookEventType;
  id: string;
  created_at: number;
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
// Discriminated Union Types
// ============================================================================

export interface CheckoutCompletedEvent {
  eventType: "checkout.completed";
  id: string;
  created_at: number;
  object: CheckoutEntity;
}

export interface RefundCreatedEvent {
  eventType: "refund.created";
  id: string;
  created_at: number;
  object: RefundEntity;
}

export interface DisputeCreatedEvent {
  eventType: "dispute.created";
  id: string;
  created_at: number;
  object: DisputeEntity;
}

export interface SubscriptionActiveEvent {
  eventType: "subscription.active";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionTrialingEvent {
  eventType: "subscription.trialing";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionCanceledEvent {
  eventType: "subscription.canceled";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionPaidEvent {
  eventType: "subscription.paid";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionExpiredEvent {
  eventType: "subscription.expired";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionUnpaidEvent {
  eventType: "subscription.unpaid";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionUpdateEvent {
  eventType: "subscription.update";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionPastDueEvent {
  eventType: "subscription.past_due";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionPausedEvent {
  eventType: "subscription.paused";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export interface SubscriptionScheduledCancelEvent {
  eventType: "subscription.scheduled_cancel";
  id: string;
  created_at: number;
  object: SubscriptionEntity;
}

export type WebhookEvent =
  | CheckoutCompletedEvent
  | RefundCreatedEvent
  | DisputeCreatedEvent
  | SubscriptionActiveEvent
  | SubscriptionTrialingEvent
  | SubscriptionCanceledEvent
  | SubscriptionPaidEvent
  | SubscriptionExpiredEvent
  | SubscriptionUnpaidEvent
  | SubscriptionUpdateEvent
  | SubscriptionPastDueEvent
  | SubscriptionPausedEvent
  | SubscriptionScheduledCancelEvent;
