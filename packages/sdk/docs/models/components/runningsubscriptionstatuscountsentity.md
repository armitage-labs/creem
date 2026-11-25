# RunningSubscriptionStatusCountsEntity

## Example Usage

```typescript
import { RunningSubscriptionStatusCountsEntity } from "creem/models/components";

let value: RunningSubscriptionStatusCountsEntity = {
  active: 9,
  trialing: 1,
  pastDue: 1,
  scheduledCancel: 0,
  paused: 1,
  unpaid: 0,
};
```

## Fields

| Field                                       | Type                                        | Required                                    | Description                                 | Example                                     |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `active`                                    | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `active`.           | 9                                           |
| `trialing`                                  | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `trialing`.         | 1                                           |
| `pastDue`                                   | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `past_due`.         | 1                                           |
| `scheduledCancel`                           | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `scheduled_cancel`. | 0                                           |
| `paused`                                    | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `paused`.           | 1                                           |
| `unpaid`                                    | *number*                                    | :heavy_check_mark:                          | Subscriptions in status `unpaid`.           | 0                                           |