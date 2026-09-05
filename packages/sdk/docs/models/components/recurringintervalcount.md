# RecurringIntervalCount

The number of `recurring_interval` units per billing cycle (e.g. `3` with a `month` interval bills every three months). Together with `recurring_interval` this is authoritative for renewal timing. For presets it is derived from the cadence. `null` for one-time products.

## Example Usage

```typescript
import { RecurringIntervalCount } from "creem/models/components";

let value: RecurringIntervalCount = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |