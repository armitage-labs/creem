# UsagePriceTargetAccount

Credit bucket a prepaid charge debits: `shared` (the customer default wallet) or `per_unit` (a bucket named after the meter unit label, or `target_account_name`). Defaults to `shared`.

## Example Usage

```typescript
import { UsagePriceTargetAccount } from "creem/models/components";

let value: UsagePriceTargetAccount = "shared";
```

## Values

```typescript
"shared" | "per_unit"
```