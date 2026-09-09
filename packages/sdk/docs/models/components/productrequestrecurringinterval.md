# ProductRequestRecurringInterval

Unit of a custom billing period. Required when `billing_period` is `custom`; must be omitted for preset billing periods.

## Example Usage

```typescript
import { ProductRequestRecurringInterval } from "creem/models/components";

let value: ProductRequestRecurringInterval = "day";
```

## Values

```typescript
"day" | "week" | "month" | "year"
```