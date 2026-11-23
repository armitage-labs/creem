# Kind

The kind of resource the item writes. `meter` and `product` can be validated; `product_group` and `discount` answer `400` `dry_run_not_supported` until their writes support a dry run.

## Example Usage

```typescript
import { Kind } from "creem/models/components";

let value: Kind = "meter";
```

## Values

```typescript
"meter" | "product" | "product_group" | "discount"
```