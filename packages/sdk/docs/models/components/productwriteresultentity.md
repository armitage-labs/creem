# ProductWriteResultEntity

## Example Usage

```typescript
import { ProductWriteResultEntity } from "creem/models/components";

let value: ProductWriteResultEntity = {
  warnings: [
    {
      code: "usage_prices_shared",
      path: "currency",
      impact: {
        total: 12,
        byStatus: {
          "active": 9,
          "trialing": 1,
          "past_due": 1,
          "scheduled_cancel": 0,
          "paused": 1,
          "unpaid": 0,
        },
      },
    },
  ],
};
```

## Fields

| Field                                                                                           | Type                                                                                            | Required                                                                                        | Description                                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `warnings`                                                                                      | [components.ProductWriteWarningEntity](../../models/components/productwritewarningentity.md)[]  | :heavy_check_mark:                                                                              | Things to know about this write. The write went through. Empty when there is nothing to report. |