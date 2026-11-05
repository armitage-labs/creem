# TaxCategory

Categorizes the type of product or service for tax purposes. This helps determine the applicable tax rules based on the nature of the item or service.

## Example Usage

```typescript
import { TaxCategory } from "creem/models/components";

let value: TaxCategory = "saas";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"saas" | "digital-goods-service" | "ebooks" | Unrecognized<string>
```