# CreateProductGroupRequestEntityUpgradeBehavior

How a switch between the products of this group is billed. On an existing group (by `external_id`), send `null` to clear it.

## Example Usage

```typescript
import { CreateProductGroupRequestEntityUpgradeBehavior } from "creem/models/components";

let value: CreateProductGroupRequestEntityUpgradeBehavior = "proration-charge";
```

## Values

```typescript
"proration-charge-immediately" | "proration-charge" | "proration-none"
```