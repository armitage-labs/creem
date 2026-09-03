/**
 * Parameters for searching Creem transactions.
 *
 * @example
 * ```typescript
 * const { data, error } = await authClient.creem.searchTransactions({
 *   customerId: "cust_abc123",
 *   pageSize: 50
 * });
 * ```
 */
export interface SearchTransactionsInput {
  /**
   * Customer ID to filter transactions by.
   * If not provided, uses the authenticated user's Creem customer ID from session.
   *
   * @example "cust_abc123"
   */
  customerId?: string;

  /**
   * Page number for pagination.
   * Must be at least 1.
   *
   * Defaults to 1.
   *
   * @example 2
   */
  pageNumber?: number;

  /**
   * Number of transactions to return per page.
   * Must be a positive number.
   *
   * Defaults to 20.
   *
   * @example 50
   */
  pageSize?: number;

  /**
   * Product ID to filter transactions by.
   *
   * @example "prod_abc123"
   */
  productId?: string;

  /**
   * Order ID to filter transactions by.
   *
   * @example "ord_abc123"
   */
  orderId?: string;
}

/**
 * A single transaction object from Creem.
 */
export interface TransactionData {
  /** Unique transaction identifier */
  id: string;
  /** Environment mode */
  mode: "test" | "prod" | "sandbox";
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
 * Pagination details from Creem API.
 */
export interface TransactionPagination {
  /** Total number of records matching the query */
  totalRecords: number;
  /** Total number of pages available */
  totalPages: number;
  /** The current page number */
  currentPage: number;
  /** The next page number, or null if there is no next page */
  nextPage: number | null;
  /** The previous page number, or null if there is no previous page */
  prevPage: number | null;
}

/**
 * Response from searching transactions.
 */
export interface SearchTransactionsResponse {
  /**
   * Array of transaction objects
   */
  items: TransactionData[];

  /**
   * Pagination details
   */
  pagination: TransactionPagination;
}
