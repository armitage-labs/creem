import type {
  CheckoutEntity,
  CustomerEntity,
  DiscountEntity,
  DisputeEntity,
  OrderEntity,
  ProductEntity,
  RefundEntity,
  SubscriptionEntity,
  TransactionEntity,
} from "./entities.js";
import type { WebhookEventEntity } from "./events.js";

export type WebhookEntity =
  | CheckoutEntity
  | CustomerEntity
  | OrderEntity
  | ProductEntity
  | SubscriptionEntity
  | RefundEntity
  | DisputeEntity
  | TransactionEntity
  | DiscountEntity;

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
      "discount",
    ].includes(entity.object)
  );
}

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

export function isCheckoutEntity(obj: unknown): obj is CheckoutEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "checkout";
}

export function isCustomerEntity(obj: unknown): obj is CustomerEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "customer";
}

export function isOrderEntity(obj: unknown): obj is OrderEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "order";
}

export function isProductEntity(obj: unknown): obj is ProductEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "product";
}

export function isSubscriptionEntity(obj: unknown): obj is SubscriptionEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "subscription";
}

export function isRefundEntity(obj: unknown): obj is RefundEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "refund";
}

export function isDisputeEntity(obj: unknown): obj is DisputeEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "dispute";
}

export function isTransactionEntity(obj: unknown): obj is TransactionEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "transaction";
}

export function isDiscountEntity(obj: unknown): obj is DiscountEntity {
  return obj !== null && typeof obj === "object" && "object" in obj && (obj as any).object === "discount";
}
