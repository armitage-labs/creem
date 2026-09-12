# PreviewMeterApiRequestDto

## Example Usage

```typescript
import { PreviewMeterApiRequestDto } from "creem/models/components";

let value: PreviewMeterApiRequestDto = {
  eventName: "image.generated",
  aggregation: "count",
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

| Field                                                                                                              | Type                                                                                                               | Required                                                                                                           | Description                                                                                                        | Example                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `eventName`                                                                                                        | *string*                                                                                                           | :heavy_check_mark:                                                                                                 | The usage event name the candidate meter would consume                                                             | image.generated                                                                                                    |
| `aggregation`                                                                                                      | [components.PreviewMeterApiRequestDtoAggregation](../../models/components/previewmeterapirequestdtoaggregation.md) | :heavy_check_mark:                                                                                                 | Aggregation to dry-run                                                                                             | count                                                                                                              |
| `aggregationProperty`                                                                                              | *string*                                                                                                           | :heavy_minus_sign:                                                                                                 | Event property the aggregation reduces. Required for every aggregation except "count".                             | tokens                                                                                                             |
| `filter`                                                                                                           | [components.MeterFilterApiRequestDto](../../models/components/meterfilterapirequestdto.md)                         | :heavy_minus_sign:                                                                                                 | Optional filter to dry-run alongside the aggregation                                                               |                                                                                                                    |
| `unitLabel`                                                                                                        | *string*                                                                                                           | :heavy_minus_sign:                                                                                                 | Display unit for the preview. Cosmetic (nothing is persisted); defaults to "units".                                | images                                                                                                             |