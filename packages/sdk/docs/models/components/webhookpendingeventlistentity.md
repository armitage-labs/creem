# WebhookPendingEventListEntity

## Example Usage

```typescript
import { WebhookPendingEventListEntity } from "creem/models/components";

let value: WebhookPendingEventListEntity = {
  items: [],
};
```

## Fields

| Field                                                                                          | Type                                                                                           | Required                                                                                       | Description                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `items`                                                                                        | [components.WebhookPendingEventEntity](../../models/components/webhookpendingevententity.md)[] | :heavy_check_mark:                                                                             | Pending events, oldest first.                                                                  |