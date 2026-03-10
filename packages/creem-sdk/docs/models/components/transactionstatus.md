# TransactionStatus

Status of the transaction.

## Example Usage

```typescript
import { TransactionStatus } from "creem/models/components";

let value: TransactionStatus = "uncollectible";
```

## Values

```typescript
"pending" | "paid" | "refunded" | "partialRefund" | "chargedBack" | "uncollectible" | "declined" | "void"
```