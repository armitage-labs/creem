# SearchTransactionsQueryParamStatus

Filter transactions by status. `chargeback` (the value responses return for a chargeback) and `chargedBack` are equivalent.

## Example Usage

```typescript
import { SearchTransactionsQueryParamStatus } from "creem/models/operations";

let value: SearchTransactionsQueryParamStatus = "declined";
```

## Values

```typescript
"pending" | "paid" | "refunded" | "partialRefund" | "chargedBack" | "uncollectible" | "declined" | "canceled" | "void" | "chargeback"
```