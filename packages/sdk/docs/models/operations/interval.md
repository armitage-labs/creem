# Interval

Groups time-series data into buckets of this size. Requires startDate and endDate. Returns a periods array with one entry per bucket containing grossRevenue and netRevenue.

## Example Usage

```typescript
import { Interval } from "creem/models/operations";

let value: Interval = "month";
```

## Values

```typescript
"day" | "week" | "month"
```