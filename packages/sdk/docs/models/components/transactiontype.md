# TransactionType

The type of transaction. payment(one time payments) and invoice(subscription)

## Example Usage

```typescript
import { TransactionType } from "creem/models/components";

let value: TransactionType = "payment";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"payment" | "invoice" | Unrecognized<string>
```