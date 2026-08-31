# CreateAccountDto

## Example Usage

```typescript
import { CreateAccountDto } from "creem/models/components";

let value: CreateAccountDto = {
  customerId: "cust_abc123",
  initialBalance: "300",
};
```

## Fields

| Field                                                   | Type                                                    | Required                                                | Description                                             | Example                                                 |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `name`                                                  | *string*                                                | :heavy_minus_sign:                                      | Human-readable name for the account                     | default                                                 |
| `customerId`                                            | *string*                                                | :heavy_check_mark:                                      | The owner ID this account belongs to (e.g. customer ID) | cust_abc123                                             |
| `unitLabel`                                             | *string*                                                | :heavy_minus_sign:                                      | Label for the unit of currency/credits                  | credits                                                 |
| `initialBalance`                                        | *string*                                                | :heavy_minus_sign:                                      | Seed the account with this many credits on creation     | 300                                                     |