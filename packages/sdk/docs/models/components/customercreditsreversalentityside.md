# CustomerCreditsReversalEntitySide

Direction of the movement: `credit` raised the balance (for example a reversed debit), `debit` lowered it (for example a reversed grant or a refund clawback).

## Example Usage

```typescript
import { CustomerCreditsReversalEntitySide } from "creem/models/components";

let value: CustomerCreditsReversalEntitySide = "debit";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"credit" | "debit" | Unrecognized<string>
```