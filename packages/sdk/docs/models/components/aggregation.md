# Aggregation

Aggregation applied to the matching events. Required when creating a meter. Part of the meter definition: on an existing meter (by `external_id`) a different value is accepted only while the meter is not locked.

## Example Usage

```typescript
import { Aggregation } from "creem/models/components";

let value: Aggregation = "sum";
```

## Values

```typescript
"count" | "sum" | "average" | "min" | "max" | "unique"
```