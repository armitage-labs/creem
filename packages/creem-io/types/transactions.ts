import { BaseEntity, Pagination } from "./general";

/**
 * Transaction entity
 */
export interface Transaction extends BaseEntity {
  /** String representing the object's type */
  object: "transaction";
  /** The transaction amount in cents. 1000 = $10.00 */
  amount: number;
  /** The amount the customer paid in cents. 1000 = $10.00 */
  amountPaid?: number;
  /** The discount amount in cents. 1000 = $10.00 */
  discountAmount?: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** The type of transaction: payment (one time) or invoice (subscription) */
  type: "payment" | "invoice";
  /** The ISO alpha-2 country code where tax is collected */
  taxCountry?: string;
  /** The sale tax amount in cents. 1000 = $10.00 */
  taxAmount?: number;
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
  refundedAmount?: number | null;
  /** The order ID associated with the transaction */
  order?: string;
  /** The subscription ID associated with the transaction */
  subscription?: string;
  /** The customer ID associated with the transaction */
  customer?: string;
  /** The description of the transaction */
  description?: string;
  /** Start period for the invoice as timestamp */
  periodStart?: number;
  /** End period for the invoice as timestamp */
  periodEnd?: number;
  /** Creation date of the transaction as timestamp */
  createdAt: number;
}

/**
 * Order entity
 */
export interface Order extends BaseEntity {
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
  subTotal?: number;
  /** The tax amount of the order in cents. 1000 = $10.00 */
  taxAmount?: number;
  /** The discount amount of the order in cents. 1000 = $10.00 */
  discountAmount?: number;
  /** The amount due for the order in cents. 1000 = $10.00 */
  amountDue?: number;
  /** The amount paid for the order in cents. 1000 = $10.00 */
  amountPaid?: number;
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** The amount in the foreign currency, if applicable */
  fxAmount?: number;
  /** Three-letter ISO code of the foreign currency, if applicable */
  fxCurrency?: string;
  /** The exchange rate used for converting between currencies */
  fxRate?: number;
  /** Current status of the order */
  status: "pending" | "paid";
  /** The type of order */
  type: "recurring" | "onetime";
  /** The affiliate ID associated with the order, if applicable */
  affiliate?: string;
  /** Creation date of the order */
  createdAt: Date;
  /** Last updated date of the order */
  updatedAt: Date;
}

/**
 * Transaction list response
 */
export interface TransactionList {
  /** List of transactions */
  items: Transaction[];
  /** Pagination details */
  pagination: Pagination;
}

/**
 * Request payload for retrieving a transaction
 */
export interface GetTransactionRequest {
  /** The transaction ID to retrieve */
  transactionId: string;
}

/**
 * Request payload for searching transactions
 */
export interface SearchTransactionsRequest {
  /** Search query string */
  query?: string;
  /** Filter by customer ID */
  customerId?: string;
  /** Filter by order ID */
  orderId?: string;
  /** Filter by product ID */
  productId?: string;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Request payload for listing transactions
 */
export interface ListTransactionsRequest {
  /** Filter by customer ID */
  customerId?: string;
  /** Filter by order ID */
  orderId?: string;
  /** Filter by product ID */
  productId?: string;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
}
