# StatsMetricPeriodEntity

## Example Usage

```typescript
import { StatsMetricPeriodEntity } from "creem/models/components";

let value: StatsMetricPeriodEntity = {
  timestamp: 1765152000000,
  grossRevenue: 125958,
  netRevenue: 122173,
};
```

## Fields

| Field                                                                                                   | Type                                                                                                    | Required                                                                                                | Description                                                                                             | Example                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `timestamp`                                                                                             | *number*                                                                                                | :heavy_check_mark:                                                                                      | Start of the period as a Unix timestamp in milliseconds (e.g. Monday of that week for weekly intervals) | 1765152000000                                                                                           |
| `grossRevenue`                                                                                          | *number*                                                                                                | :heavy_check_mark:                                                                                      | Gross revenue in cents for this period                                                                  | 125958                                                                                                  |
| `netRevenue`                                                                                            | *number*                                                                                                | :heavy_check_mark:                                                                                      | Net revenue in cents for this period (after fees and taxes)                                             | 122173                                                                                                  |