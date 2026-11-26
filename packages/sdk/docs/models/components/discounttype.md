# DiscountType

The type of the discount. Fixed once the discount has been redeemed, or while a checkout confirmed with it in the last 7 days holds it (`409` `discount_redeemed`); the same applies to `amount`, `percentage`, `currency`, `duration` and `duration_in_months`. Changing it needs the new `amount` or `percentage`.

## Example Usage

```typescript
import { DiscountType } from "creem/models/components";

let value: DiscountType = "percentage";
```

## Values

```typescript
"percentage" | "fixed"
```