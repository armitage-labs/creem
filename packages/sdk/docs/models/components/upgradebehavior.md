# UpgradeBehavior

How a switch between the products of this group is billed. On an existing group (by `external_id`), send `null` to clear it.

## Example Usage

```typescript
import { UpgradeBehavior } from "creem/models/components";

let value: UpgradeBehavior = "proration-charge";
```

## Values

```typescript
"proration-charge-immediately" | "proration-charge" | "proration-none"
```