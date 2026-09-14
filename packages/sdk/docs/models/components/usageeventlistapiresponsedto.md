# UsageEventListApiResponseDto

## Example Usage

```typescript
import { UsageEventListApiResponseDto } from "creem/models/components";

let value: UsageEventListApiResponseDto = {
  object: "list",
  data: [
    {
      id: "uev_abc123",
      customerId: "cust_abc123",
      eventId: "order-1234",
      name: "image.generated",
      properties: {},
      timestamp: "<value>",
      createdAt: "1712278866004",
      matchedMeters: [
        "mtr_abc123",
      ],
    },
  ],
  hasMore: false,
};
```

## Fields

| Field                                                                                        | Type                                                                                         | Required                                                                                     | Description                                                                                  | Example                                                                                      |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `object`                                                                                     | *string*                                                                                     | :heavy_check_mark:                                                                           | Object type                                                                                  | list                                                                                         |
| `data`                                                                                       | [components.UsageEventApiResponseDto](../../models/components/usageeventapiresponsedto.md)[] | :heavy_check_mark:                                                                           | Array of usage events                                                                        |                                                                                              |
| `hasMore`                                                                                    | *boolean*                                                                                    | :heavy_check_mark:                                                                           | Whether more items exist beyond this page                                                    |                                                                                              |