/**
 * Creem Webhook Entity Types
 *
 * Merged from betterauth and nextjs-adaptor webhook types.
 * This is the single source of truth for all Creem webhook entity definitions.
 */

// ============================================================================
// Base Types
// ============================================================================

export type Metadata = Record<string, string | number | null>;

/**
 * A value field Creem may add values to: one of the values this version knows,
 * or any other string. Creem's payload is passed through unchanged, so a value
 * added after this version reaches your handler as it is; a `switch` over the
 * known values needs a `default` branch. Comparisons with a known value still
 * compile, and editors still suggest the known values.
 *
 * Fields that identify an event (`eventType`) or an object (`object`) stay
 * closed: they select the payload's shape.
 */
export type OpenValue<Known extends string> = Known | (string & {});

export interface BaseEntity {
  id: string;
  mode: OpenValue<"test" | "prod" | "sandbox">;
}

// ============================================================================
// Custom Field Types
// ============================================================================

export interface Text {
  max_length?: number;
  minimum_length?: number;
  value?: string;
}

export interface Checkbox {
  label?: string;
  value?: boolean;
}

export interface CustomField {
  type: OpenValue<"text" | "checkbox">;
  key: string;
  label: string;
  optional?: boolean;
  text?: Text;
  checkbox?: Checkbox;
}

// ============================================================================
// Customer Entity
// ============================================================================

export interface CustomerEntity extends BaseEntity {
  object: "customer";
  email: string;
  name?: string;
  country: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Product Entity
// ============================================================================

export interface FeatureEntity {
  id: string;
  /** Union of all known feature types from both adapters */
  type: OpenValue<
    "custom" | "file" | "licenseKey" | "github-repo" | "discord" | "link" | "licence-key"
  >;
  description: string;
}

export interface ProductEntity extends BaseEntity {
  object: "product";
  name: string;
  description: string;
  image_url?: string;
  features?: FeatureEntity[];
  price: number;
  currency: string;
  /** Union of both spelling variants: betterauth uses "onetime", nextjs uses "one-time" */
  billing_type: OpenValue<"recurring" | "onetime" | "one-time">;
  billing_period: OpenValue<
    "every-month" | "every-three-months" | "every-six-months" | "every-year" | "once"
  >;
  status: OpenValue<"active" | "archived">;
  tax_mode: OpenValue<"inclusive" | "exclusive">;
  tax_category: OpenValue<"saas" | "digital-goods-service" | "ebooks">;
  product_url?: string;
  default_success_url?: string;
  custom_fields?: CustomField[] | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Transaction Entity
// ============================================================================

export interface TransactionEntity extends BaseEntity {
  object: "transaction";
  amount: number;
  amount_paid?: number;
  discount_amount?: number;
  currency: string;
  type: OpenValue<"payment" | "invoice">;
  tax_country?: string;
  tax_amount?: number;
  status: OpenValue<
    | "pending"
    | "paid"
    | "refunded"
    | "partialRefund"
    | "chargedBack"
    | "uncollectible"
    | "declined"
    | "void"
  >;
  refunded_amount?: number | null;
  order?: string;
  subscription?: string;
  customer?: string;
  description?: string;
  period_start?: number;
  period_end?: number;
  created_at: number;
}

// ============================================================================
// Order Entity
// ============================================================================

export interface OrderEntity extends BaseEntity {
  object: "order";
  customer?: string;
  product: string;
  transaction?: string;
  discount?: string;
  amount: number;
  sub_total?: number;
  tax_amount?: number;
  discount_amount?: number;
  amount_due?: number;
  amount_paid?: number;
  currency: string;
  fx_amount?: number;
  fx_currency?: string;
  fx_rate?: number;
  status: OpenValue<"pending" | "paid">;
  type: OpenValue<"recurring" | "onetime">;
  affiliate?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Discount Entity
// ============================================================================

export type DiscountStatus = OpenValue<"deleted" | "active" | "draft" | "expired" | "scheduled">;
export type DiscountType = OpenValue<"percentage" | "fixed">;
export type DiscountDuration = OpenValue<"forever" | "once" | "repeating">;

export interface DiscountEntity extends BaseEntity {
  object: "discount";
  status: DiscountStatus;
  name: string;
  code: string;
  type: DiscountType;
  amount?: number;
  currency?: string;
  percentage?: number;
  expiry_date?: Date;
  max_redemptions?: number;
  duration?: DiscountDuration;
  duration_in_months?: number;
  applies_to_products?: string[];
  redeem_count?: number;
}

// ============================================================================
// License Entities
// ============================================================================

export interface LicenseInstanceEntity extends BaseEntity {
  object: "license-instance";
  name: string;
  status: OpenValue<"active" | "deactivated">;
  created_at: Date;
}

export interface LicenseEntity extends BaseEntity {
  object: "license";
  status: OpenValue<"inactive" | "active" | "expired" | "disabled">;
  key: string;
  activation: number;
  activation_limit: number | null;
  expires_at: Date | null;
  created_at: Date;
  instance?: LicenseInstanceEntity | null;
}

export interface ProductFeatureEntity {
  id?: string | null;
  description?: string | null;
  type?: OpenValue<"custom" | "file" | "licenseKey"> | null;
  private_note?: string | null;
  file?: {
    files: { id: string; file_name: string; url: string; type: string; size: number }[];
  } | null;
  license_key?: LicenseEntity | null;
  /**
   * @deprecated Use `license_key` instead
   */
  license?: LicenseEntity | null;
}

// ============================================================================
// Subscription Entities
// ============================================================================

export interface SubscriptionItemEntity extends BaseEntity {
  object: "subscription_item";
  product_id?: string;
  price_id?: string;
  units?: number;
  created_at?: Date;
  updated_at?: Date;
}

export type SubscriptionStatus = OpenValue<
  | "active"
  | "canceled"
  | "expired"
  | "past_due"
  | "unpaid"
  | "paused"
  | "trialing"
  | "scheduled_cancel"
>;

export interface SubscriptionEntity extends BaseEntity {
  object: "subscription";
  product: ProductEntity | string;
  customer: CustomerEntity | string;
  items?: SubscriptionItemEntity[];
  collection_method: OpenValue<"charge_automatically">;
  status: SubscriptionStatus;
  last_transaction_id?: string;
  last_transaction?: TransactionEntity;
  last_transaction_date?: Date;
  next_transaction_date?: Date;
  current_period_start_date: Date;
  current_period_end_date: Date;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata?: Metadata;
}

// ============================================================================
// Checkout Entity
// ============================================================================

export type CheckoutStatus = OpenValue<"pending" | "processing" | "completed" | "expired">;

export interface CheckoutEntity extends BaseEntity {
  object: "checkout";
  status: CheckoutStatus;
  request_id?: string;
  product: ProductEntity | string;
  units: number;
  order?: OrderEntity;
  subscription?: SubscriptionEntity | string;
  customer?: CustomerEntity | string;
  custom_fields?: CustomField[];
  checkout_url?: string;
  success_url?: string;
  feature?: ProductFeatureEntity[];
  metadata?: Metadata;
}

// ============================================================================
// Refund Entity
// ============================================================================

export interface RefundEntity extends BaseEntity {
  object: "refund";
  status: OpenValue<"pending" | "succeeded" | "canceled" | "failed">;
  refund_amount: number;
  refund_currency: string;
  reason: OpenValue<"duplicate" | "fraudulent" | "requested_by_customer" | "other">;
  transaction: TransactionEntity;
  checkout?: CheckoutEntity | string;
  order?: OrderEntity | string;
  subscription?: SubscriptionEntity | string;
  customer?: CustomerEntity | string;
  created_at: number;
}

// ============================================================================
// Dispute Entity
// ============================================================================

export interface DisputeEntity extends BaseEntity {
  object: "dispute";
  amount: number;
  currency: string;
  transaction: TransactionEntity;
  checkout?: CheckoutEntity | string;
  order?: OrderEntity | string;
  subscription?: SubscriptionEntity | string;
  customer?: CustomerEntity | string;
  created_at: number;
}
