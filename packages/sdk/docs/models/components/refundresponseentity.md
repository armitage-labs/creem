# RefundResponseEntity

## Example Usage

```typescript
import { RefundResponseEntity } from "creem/models/components";

let value: RefundResponseEntity = {
  status: "succeeded",
};
```

## Fields

| Field                                                                                                   | Type                                                                                                    | Required                                                                                                | Description                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `status`                                                                                                | [components.RefundStatus](../../models/components/refundstatus.md)                                      | :heavy_check_mark:                                                                                      | Status of the refund. `pending` and `requiresAction` represent non-terminal provider processing states. |