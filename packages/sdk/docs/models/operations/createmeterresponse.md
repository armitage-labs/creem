# CreateMeterResponse

## Example Usage

```typescript
import { CreateMeterResponse } from "creem/models/operations";

let value: CreateMeterResponse = {
  headers: {
    "key": [],
  },
  result: {
    id: "mtr_abc123",
    storeId: "sto_abc123",
    name: "Image generations",
    eventName: "image.generated",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [],
    },
    unitLabel: "images",
    status: "active",
    externalId: "image-generations",
    locked: false,
    createdAt: "1732408886066",
    updatedAt: "1735664389161",
    writeResult: {
      result: "updated",
      dryRun: false,
      changes: [],
      warnings: [
        {
          code: "field_not_writable",
          path: "unit_label",
        },
      ],
    },
  },
};
```

## Fields

| Field                                                                                      | Type                                                                                       | Required                                                                                   | Description                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `headers`                                                                                  | Record<string, *string*[]>                                                                 | :heavy_check_mark:                                                                         | N/A                                                                                        |
| `result`                                                                                   | [components.MeterWriteApiResponseDto](../../models/components/meterwriteapiresponsedto.md) | :heavy_check_mark:                                                                         | N/A                                                                                        |