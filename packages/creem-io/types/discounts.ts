/**
 * Discount status
 */
export type DiscountStatus = "active" | "draft" | "expired" | "scheduled";

/**
 * Discount type
 */
export type DiscountType = "percentage" | "fixed";

/**
 * Discount duration
 */
export type DiscountDuration = "forever" | "once" | "repeating";

/**
 * Discount entity
 */
export interface Discount {
  /** Unique identifier for the discount */
  id: string;
  /** Environment mode: test, prod, or sandbox */
  mode: "test" | "prod" | "sandbox";
  /** String representing the object's type */
  object: string;
  /** Status of the discount */
  status: DiscountStatus;
  /** Display name of the discount */
  name: string;
  /** The discount code customers will use */
  code: string;
  /** Type of discount: percentage or fixed amount */
  type: DiscountType;
  /** Fixed discount amount in cents (for fixed type). 1000 = $10.00 */
  amount?: number;
  /** Three-letter ISO currency code, in uppercase (for fixed type) */
  currency?: string;
  /** The percentage of the discount. Only applicable if type is "percentage". 25 = 25% off */
  percentage?: number;
  /** The date when the discount expires */
  expiryDate?: string;
  /** Maximum number of times this discount can be redeemed */
  maxRedemptions?: number;
  /** How long the discount applies to subscriptions */
  duration?: DiscountDuration;
  /** Number of months the discount applies (for repeating duration) */
  durationInMonths?: number;
  /** List of product IDs this discount applies to */
  appliesToProducts?: string[];
  /** Number of times this discount has been redeemed */
  redeemCount?: number;
}

/**
 * Request payload for creating a discount
 */
export interface CreateDiscountRequest {
  /** Display name of the discount */
  name: string;
  /** The discount code customers will use. Auto-generated if not provided */
  code?: string;
  /** Type of discount: percentage or fixed amount */
  type: DiscountType;
  /** Fixed discount amount in cents (required for fixed type) */
  amount?: number;
  /** Three-letter ISO currency code, in uppercase (required for fixed type) */
  currency?: string;
  /** The percentage of the discount. Only applicable if type is "percentage". 25 = 25% off */
  percentage?: number;
  /** The date when the discount expires */
  expiryDate?: string;
  /** Maximum number of times this discount can be redeemed */
  maxRedemptions?: number;
  /** How long the discount applies to subscriptions */
  duration: DiscountDuration;
  /** Number of months the discount applies (for repeating duration) */
  durationInMonths?: number;
  /** List of product IDs this discount applies to */
  appliesToProducts: string[];
}

/**
 * Request payload for retrieving a discount
 */
export interface GetDiscountRequest {
  /** The discount ID to retrieve */
  discountId?: string;
  /** The discount code to retrieve */
  discountCode?: string;
}

/**
 * Request payload for deleting a discount
 */
export interface DeleteDiscountRequest {
  /** The discount ID to delete */
  discountId: string;
}
