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
   * @optional
   * @example "cust_abc123"
   */
  customerId?: string;

  /**
   * Page number for pagination.
   * Must be at least 1.
   *
   * @optional
   * @default 1
   * @example 2
   */
  pageNumber?: number;

  /**
   * Number of transactions to return per page.
   * Must be a positive number.
   *
   * @optional
   * @default 20
   * @example 50
   */
  pageSize?: number;

  /**
   * Product ID to filter transactions by.
   *
   * @optional
   * @example "prod_abc123"
   */
  productId?: string;

  /**
   * Order ID to filter transactions by.
   *
   * @optional
   * @example "ord_abc123"
   */
  orderId?: string;
}

/**
 * A single transaction object from Creem.
 */
export interface TransactionData {
  /**
   * Unique transaction identifier
   */
  id: string;

  /**
   * Transaction type
   * @example "payment", "refund"
   */
  type: string;

  /**
   * Transaction status
   * @example "succeeded", "failed", "pending"
   */
  status: string;

  /**
   * Transaction amount
   */
  amount: number;

  /**
   * Currency code
   * @example "USD", "EUR"
   */
  currency: string;

  /**
   * Customer information
   */
  customer: {
    id: string;
    email: string;
    name?: string;
  };

  /**
   * Product information (if applicable)
   */
  product?: {
    id: string;
    name: string;
  };

  /**
   * Order ID associated with this transaction
   */
  order_id?: string;

  /**
   * Transaction creation date (Unix timestamp)
   */
  created_at: number;

  /**
   * Custom metadata stored with the transaction
   */
  metadata?: Record<string, unknown>;

  /**
   * Additional transaction properties from Creem API
   */
  [key: string]: unknown;
}

/**
 * Response from searching transactions.
 */
export interface SearchTransactionsResponse {
  /**
   * Array of transaction objects
   */
  transactions: TransactionData[];

  /**
   * Total number of transactions matching the query
   */
  total?: number;

  /**
   * Current page number
   */
  page?: number;

  /**
   * Additional pagination or response data from Creem API
   */
  [key: string]: unknown;
}
