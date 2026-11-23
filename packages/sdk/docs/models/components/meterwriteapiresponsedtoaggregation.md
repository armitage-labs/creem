# MeterWriteApiResponseDtoAggregation

Aggregation applied to matching events

## Example Usage

```typescript
import { MeterWriteApiResponseDtoAggregation } from "creem/models/components";

let value: MeterWriteApiResponseDtoAggregation = "sum";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"count" | "sum" | "average" | "min" | "max" | "unique" | Unrecognized<string>
```