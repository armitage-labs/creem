# TransactionStatus

Status of the transaction.

## Example Usage

```typescript
import { TransactionStatus } from "creem/models/components";

let value: TransactionStatus = "declined";
```

## Values

```typescript
"pending" | "paid" | "refunded" | "partialRefund" | "chargedBack" | "uncollectible" | "declined" | "canceled" | "void"
```