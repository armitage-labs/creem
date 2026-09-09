# StatsMetricTotalsEntity

## Example Usage

```typescript
import { StatsMetricTotalsEntity } from "creem/models/components";

let value: StatsMetricTotalsEntity = {
  totalProducts: 12,
  totalSubscriptions: 48,
  totalCustomers: 35,
  totalPayments: 62,
  activeSubscriptions: 21,
  totalRevenue: 553939,
  totalNetRevenue: 478094,
  netMonthlyRecurringRevenue: 89500,
  monthlyRecurringRevenue: 94200,
};
```

## Fields

| Field                                                                           | Type                                                                            | Required                                                                        | Description                                                                     | Example                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `totalProducts`                                                                 | *number*                                                                        | :heavy_check_mark:                                                              | Total number of products in the store                                           | 12                                                                              |
| `totalSubscriptions`                                                            | *number*                                                                        | :heavy_check_mark:                                                              | Total number of subscriptions within the queried date range                     | 48                                                                              |
| `totalCustomers`                                                                | *number*                                                                        | :heavy_check_mark:                                                              | Total number of customers within the queried date range                         | 35                                                                              |
| `totalPayments`                                                                 | *number*                                                                        | :heavy_check_mark:                                                              | Total number of payments within the queried date range                          | 62                                                                              |
| `activeSubscriptions`                                                           | *number*                                                                        | :heavy_check_mark:                                                              | Number of currently active subscriptions                                        | 21                                                                              |
| `totalRevenue`                                                                  | *number*                                                                        | :heavy_check_mark:                                                              | Total gross revenue in cents within the queried date range                      | 553939                                                                          |
| `totalNetRevenue`                                                               | *number*                                                                        | :heavy_check_mark:                                                              | Total net revenue in cents within the queried date range (after fees and taxes) | 478094                                                                          |
| `netMonthlyRecurringRevenue`                                                    | *number*                                                                        | :heavy_check_mark:                                                              | Net monthly recurring revenue in cents (after estimated fees)                   | 89500                                                                           |
| `monthlyRecurringRevenue`                                                       | *number*                                                                        | :heavy_check_mark:                                                              | Gross monthly recurring revenue in cents                                        | 94200                                                                           |