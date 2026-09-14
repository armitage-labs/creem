# CreateMeterApiRequestDto

## Example Usage

```typescript
import { CreateMeterApiRequestDto } from "creem/models/components";

let value: CreateMeterApiRequestDto = {
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
};
```

## Fields

| Field                                                                                                            | Type                                                                                                             | Required                                                                                                         | Description                                                                                                      | Example                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`                                                                                                           | *string*                                                                                                         | :heavy_check_mark:                                                                                               | Human-readable meter name, unique within your store                                                              | Image generations                                                                                                |
| `eventName`                                                                                                      | *string*                                                                                                         | :heavy_check_mark:                                                                                               | The usage event name this meter consumes                                                                         | image.generated                                                                                                  |
| `aggregation`                                                                                                    | [components.Aggregation](../../models/components/aggregation.md)                                                 | :heavy_check_mark:                                                                                               | Aggregation applied to the matching events                                                                       | sum                                                                                                              |
| `aggregationProperty`                                                                                            | *string*                                                                                                         | :heavy_minus_sign:                                                                                               | Event property the aggregation reduces. Required for every aggregation except "count", which ignores it.         | tokens                                                                                                           |
| `filter`                                                                                                         | [components.MeterFilterApiRequestDto](../../models/components/meterfilterapirequestdto.md)                       | :heavy_minus_sign:                                                                                               | Optional filter narrowing which events the meter counts. Omitted means "count every event with this event name". |                                                                                                                  |
| `unitLabel`                                                                                                      | *string*                                                                                                         | :heavy_check_mark:                                                                                               | Display unit for the metered quantity. Also names the customer-credits bucket the meter settles into.            | images                                                                                                           |