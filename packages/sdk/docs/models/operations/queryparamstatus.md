# QueryParamStatus

Filter transactions by status. `chargeback` (the value responses return for a chargeback) and `chargedBack` are equivalent.

## Example Usage

```typescript
import { QueryParamStatus } from "creem/models/operations";

let value: QueryParamStatus = "declined";
```

## Values

```typescript
"pending" | "paid" | "refunded" | "partialRefund" | "chargedBack" | "uncollectible" | "declined" | "canceled" | "void" | "chargeback"
```