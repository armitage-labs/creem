# ProductRequestBillingPeriod

Billing interval. Required when `billing_type` is `recurring`. Use a preset for the common cadences, or `custom` together with `recurring_interval` + `recurring_interval_count` for anything else (e.g. weekly).

## Example Usage

```typescript
import { ProductRequestBillingPeriod } from "creem/models/components";

let value: ProductRequestBillingPeriod = "every-year";
```

## Values

```typescript
"once" | "every-day" | "every-month" | "every-three-months" | "every-six-months" | "every-year" | "custom"
```