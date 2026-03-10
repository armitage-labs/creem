/**
 * Totals for key business metrics
 */
export interface StatsMetricTotals {
  /** Total number of products */
  totalProducts: number;
  /** Total number of subscriptions */
  totalSubscriptions: number;
  /** Total number of customers */
  totalCustomers: number;
  /** Total number of payments */
  totalPayments: number;
  /** Number of active subscriptions */
  activeSubscriptions: number;
  /** Total revenue in cents */
  totalRevenue: number;
  /** Total net revenue in cents */
  totalNetRevenue: number;
  /** Net monthly recurring revenue in cents */
  netMonthlyRecurringRevenue: number;
  /** Monthly recurring revenue in cents */
  monthlyRecurringRevenue: number;
}

/**
 * Time-series data point for a period
 */
export interface StatsMetricPeriod {
  /** Timestamp for the period */
  timestamp: number;
  /** Gross revenue in cents for the period */
  grossRevenue: number;
  /** Net revenue in cents for the period */
  netRevenue: number;
}

/**
 * Stats summary response
 */
export interface StatsSummary {
  /** Aggregate totals */
  totals: StatsMetricTotals;
  /** Optional time-series data points */
  periods?: StatsMetricPeriod[];
}

/**
 * Interval for time-series grouping
 */
export type StatsInterval = "day" | "week" | "month";

/**
 * Request payload for retrieving stats summary
 */
export interface GetStatsSummaryRequest {
  /** Three-letter ISO currency code, in uppercase */
  currency: string;
  /** Start date as unix timestamp */
  startDate?: number;
  /** End date as unix timestamp */
  endDate?: number;
  /** Grouping interval for time-series data */
  interval?: StatsInterval;
}
