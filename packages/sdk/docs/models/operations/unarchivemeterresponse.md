# UnarchiveMeterResponse

## Example Usage

```typescript
import { UnarchiveMeterResponse } from "creem/models/operations";

let value: UnarchiveMeterResponse = {
  headers: {
    "key": [
      "<value 1>",
      "<value 2>",
      "<value 3>",
    ],
    "key1": [
      "<value 1>",
      "<value 2>",
      "<value 3>",
    ],
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
    createdAt: "1710777847747",
    updatedAt: "1735687140563",
  },
};
```

## Fields

| Field                                                                            | Type                                                                             | Required                                                                         | Description                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `headers`                                                                        | Record<string, *string*[]>                                                       | :heavy_check_mark:                                                               | N/A                                                                              |
| `result`                                                                         | [components.MeterApiResponseDto](../../models/components/meterapiresponsedto.md) | :heavy_check_mark:                                                               | N/A                                                                              |