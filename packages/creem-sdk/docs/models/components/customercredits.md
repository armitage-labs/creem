# CustomerCredits

Customer credits feature data.

## Example Usage

```typescript
import { CustomerCredits } from "creem/models/components";

let value: CustomerCredits = {
  amount: "100",
  unitLabel: {},
};
```

## Fields

| Field                                                                | Type                                                                 | Required                                                             | Description                                                          | Example                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `amount`                                                             | *string*                                                             | :heavy_check_mark:                                                   | The number of credits to grant. String to preserve BigInt precision. | 100                                                                  |
| `unitLabel`                                                          | [components.UnitLabel](../../models/components/unitlabel.md)         | :heavy_minus_sign:                                                   | Optional label for the credit unit (e.g. "tokens", "credits").       | tokens                                                               |