# MeterApiResponseDtoAggregation

Aggregation applied to matching events

## Example Usage

```typescript
import { MeterApiResponseDtoAggregation } from "creem/models/components";

let value: MeterApiResponseDtoAggregation = "sum";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"count" | "sum" | "average" | "min" | "max" | "unique" | Unrecognized<string>
```