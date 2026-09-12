# MeterApiResponseDto

## Example Usage

```typescript
import { MeterApiResponseDto } from "creem/models/components";

let value: MeterApiResponseDto = {
  id: "mtr_abc123",
  storeId: "sto_abc123",
  name: "Image generations",
  eventName: "image.generated",
  aggregation: "sum",
  aggregationProperty: "tokens",
  filter: {
    conjunction: "and",
    clauses: [
      {
        property: "tier",
        operator: "equals",
        value: "pro",
      },
    ],
  },
  unitLabel: "images",
  status: "active",
  createdAt: "1706752632385",
  updatedAt: "1735638930703",
};
```

## Fields

| Field                                                                                                  | Type                                                                                                   | Required                                                                                               | Description                                                                                            | Example                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `id`                                                                                                   | *string*                                                                                               | :heavy_check_mark:                                                                                     | Meter ID                                                                                               | mtr_abc123                                                                                             |
| `storeId`                                                                                              | *string*                                                                                               | :heavy_check_mark:                                                                                     | Store ID                                                                                               | sto_abc123                                                                                             |
| `name`                                                                                                 | *string*                                                                                               | :heavy_check_mark:                                                                                     | Meter name                                                                                             | Image generations                                                                                      |
| `eventName`                                                                                            | *string*                                                                                               | :heavy_check_mark:                                                                                     | Usage event name the meter consumes                                                                    | image.generated                                                                                        |
| `aggregation`                                                                                          | [components.MeterApiResponseDtoAggregation](../../models/components/meterapiresponsedtoaggregation.md) | :heavy_check_mark:                                                                                     | Aggregation applied to matching events                                                                 | sum                                                                                                    |
| `aggregationProperty`                                                                                  | *string*                                                                                               | :heavy_check_mark:                                                                                     | Property the aggregation reduces; null for "count"                                                     | tokens                                                                                                 |
| `filter`                                                                                               | [components.MeterFilterApiResponseDto](../../models/components/meterfilterapiresponsedto.md)           | :heavy_check_mark:                                                                                     | The meter filter; always present (empty clauses = match all)                                           |                                                                                                        |
| `unitLabel`                                                                                            | *string*                                                                                               | :heavy_check_mark:                                                                                     | Display unit                                                                                           | images                                                                                                 |
| `status`                                                                                               | [components.MeterApiResponseDtoStatus](../../models/components/meterapiresponsedtostatus.md)           | :heavy_check_mark:                                                                                     | Whether the meter is active or archived                                                                | active                                                                                                 |
| `createdAt`                                                                                            | *string*                                                                                               | :heavy_check_mark:                                                                                     | Creation timestamp (ISO 8601)                                                                          |                                                                                                        |
| `updatedAt`                                                                                            | *string*                                                                                               | :heavy_check_mark:                                                                                     | Last update timestamp (ISO 8601)                                                                       |                                                                                                        |