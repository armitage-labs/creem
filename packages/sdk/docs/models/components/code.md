# Code

Warning code. `no_matching_meter`: no meter consumes this event name. `meter_archived`: only archived meters match — unarchive one to resume aggregation. `timestamp_outside_late_window`: the billing period the timestamp falls in is finalized, so the event will never change its totals.

## Example Usage

```typescript
import { Code } from "creem/models/components";

let value: Code = "no_matching_meter";
```

## Values

```typescript
"no_matching_meter" | "meter_archived" | "timestamp_outside_late_window"
```