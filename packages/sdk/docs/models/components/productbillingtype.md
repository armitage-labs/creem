# ProductBillingType

Indicates the billing method for the customer. It can either be a `recurring` billing cycle or a `onetime` payment.

## Example Usage

```typescript
import { ProductBillingType } from "creem/models/components";

let value: ProductBillingType = "onetime";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"recurring" | "onetime" | Unrecognized<string>
```