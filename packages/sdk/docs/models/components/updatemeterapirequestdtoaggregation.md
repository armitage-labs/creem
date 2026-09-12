# UpdateMeterApiRequestDtoAggregation

New aggregation. Part of the meter definition, so it is only editable while the meter has processed no usage and has no associated purchase. Omit to leave unchanged; `null` is rejected.

## Example Usage

```typescript
import { UpdateMeterApiRequestDtoAggregation } from "creem/models/components";

let value: UpdateMeterApiRequestDtoAggregation = "sum";
```

## Values

```typescript
"count" | "sum" | "average" | "min" | "max" | "unique"
```