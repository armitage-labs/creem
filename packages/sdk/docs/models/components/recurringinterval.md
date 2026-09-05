# RecurringInterval

The unit of the recurring billing interval (`day`, `week`, `month`, or `year`). Together with `recurring_interval_count` this is authoritative for renewal timing — a `billing_period` of `custom` cannot be interpreted without it. For presets it is derived from the cadence (e.g. `every-three-months` → `month`). `null` for one-time products.

## Example Usage

```typescript
import { RecurringInterval } from "creem/models/components";

let value: RecurringInterval = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |