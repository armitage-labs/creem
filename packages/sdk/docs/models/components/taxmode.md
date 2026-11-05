# TaxMode

Specifies the tax calculation mode for the transaction. If set to "inclusive," the tax is included in the price. If set to "exclusive," the tax is added on top of the price.

## Example Usage

```typescript
import { TaxMode } from "creem/models/components";

let value: TaxMode = "inclusive";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"inclusive" | "exclusive" | Unrecognized<string>
```