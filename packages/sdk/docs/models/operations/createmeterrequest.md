# CreateMeterRequest

## Example Usage

```typescript
import { CreateMeterRequest } from "creem/models/operations";

let value: CreateMeterRequest = {
  createMeterApiRequestDto: {
    name: "Image generations",
    eventName: "image.generated",
    aggregation: "sum",
    aggregationProperty: "tokens",
    filter: {
      conjunction: "and",
      clauses: [],
    },
    unitLabel: "images",
    externalId: "image-generations",
  },
};
```

## Fields

| Field                                                                                                                                                                                                                                                                                 | Type                                                                                                                                                                                                                                                                                  | Required                                                                                                                                                                                                                                                                              | Description                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotencyKey`                                                                                                                                                                                                                                                                      | *string*                                                                                                                                                                                                                                                                              | :heavy_minus_sign:                                                                                                                                                                                                                                                                    | Optional key that makes retries return the originally created meter instead of creating a duplicate. Reusing a key with a different body returns the first result, and a key lasts 24 hours. After a failed create whose outcome is unclear, the key answers 429 for up to 5 minutes. |
| `createMeterApiRequestDto`                                                                                                                                                                                                                                                            | [components.CreateMeterApiRequestDto](../../models/components/createmeterapirequestdto.md)                                                                                                                                                                                            | :heavy_check_mark:                                                                                                                                                                                                                                                                    | N/A                                                                                                                                                                                                                                                                                   |