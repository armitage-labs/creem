# ProductWriteSubscriptionCountsEntity

## Example Usage

```typescript
import { ProductWriteSubscriptionCountsEntity } from "creem/models/components";

let value: ProductWriteSubscriptionCountsEntity = {
  total: 12,
  byStatus: {
    "active": 9,
    "trialing": 1,
    "past_due": 1,
    "scheduled_cancel": 0,
    "paused": 1,
    "unpaid": 0,
  },
};
```

## Fields

| Field                                                                                                                       | Type                                                                                                                        | Required                                                                                                                    | Description                                                                                                                 | Example                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `total`                                                                                                                     | *number*                                                                                                                    | :heavy_check_mark:                                                                                                          | Running subscriptions, the sum of `by_status`.                                                                              | 12                                                                                                                          |
| `byStatus`                                                                                                                  | Record<string, *number*>                                                                                                    | :heavy_check_mark:                                                                                                          | Running subscriptions per status. Always lists `active`, `trialing`, `past_due`, `scheduled_cancel`, `paused` and `unpaid`. | {<br/>"active": 9,<br/>"trialing": 1,<br/>"past_due": 1,<br/>"scheduled_cancel": 0,<br/>"paused": 1,<br/>"unpaid": 0<br/>}  |