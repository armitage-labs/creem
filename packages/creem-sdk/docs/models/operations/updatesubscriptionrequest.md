# UpdateSubscriptionRequest

## Example Usage

```typescript
import { UpdateSubscriptionRequest } from "creem/models/operations";

let value: UpdateSubscriptionRequest = {
  id: "<id>",
  updateSubscriptionRequestEntity: {},
};
```

## Fields

| Field                                                                                                    | Type                                                                                                     | Required                                                                                                 | Description                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                     | *string*                                                                                                 | :heavy_check_mark:                                                                                       | The unique identifier of the subscription                                                                |
| `updateSubscriptionRequestEntity`                                                                        | [components.UpdateSubscriptionRequestEntity](../../models/components/updatesubscriptionrequestentity.md) | :heavy_check_mark:                                                                                       | Subscription update payload                                                                              |