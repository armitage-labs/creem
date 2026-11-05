# UsagePriceSettlementMode

How the charge settles: `prepaid` debits the customer credit account as usage aggregates; `postpaid` bills at renewal where the store supports it.

## Example Usage

```typescript
import { UsagePriceSettlementMode } from "creem/models/components";

let value: UsagePriceSettlementMode = "postpaid";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"prepaid" | "postpaid" | Unrecognized<string>
```