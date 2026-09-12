# UpdateMeterRequest

## Example Usage

```typescript
import { UpdateMeterRequest } from "creem/models/operations";

let value: UpdateMeterRequest = {
  id: "<id>",
  updateMeterApiRequestDto: {
    name: "Image generations (v2)",
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
  },
};
```

## Fields

| Field                                                                                      | Type                                                                                       | Required                                                                                   | Description                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `id`                                                                                       | *string*                                                                                   | :heavy_check_mark:                                                                         | N/A                                                                                        |
| `updateMeterApiRequestDto`                                                                 | [components.UpdateMeterApiRequestDto](../../models/components/updatemeterapirequestdto.md) | :heavy_check_mark:                                                                         | N/A                                                                                        |