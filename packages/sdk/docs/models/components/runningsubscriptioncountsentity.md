# RunningSubscriptionCountsEntity

## Example Usage

```typescript
import { RunningSubscriptionCountsEntity } from "creem/models/components";

let value: RunningSubscriptionCountsEntity = {
  total: 7649.88,
  byStatus: {
    active: 9,
    trialing: 1,
    pastDue: 1,
    scheduledCancel: 0,
    paused: 1,
    unpaid: 0,
  },
};
```

## Fields

| Field                                                                                                                | Type                                                                                                                 | Required                                                                                                             | Description                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `total`                                                                                                              | *number*                                                                                                             | :heavy_check_mark:                                                                                                   | Running subscriptions. Canceled, expired, incomplete and error ones are not counted.                                 |
| `byStatus`                                                                                                           | [components.RunningSubscriptionStatusCountsEntity](../../models/components/runningsubscriptionstatuscountsentity.md) | :heavy_check_mark:                                                                                                   | Per status; all six are always present.                                                                              |