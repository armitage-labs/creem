# Duplicate

Advisory: would this event deduplicate against an already-stored event (or an earlier entry of this batch)? Null when the event is invalid. Racy by nature — a signal for debugging retries, not a guarantee.

## Example Usage

```typescript
import { Duplicate } from "creem/models/components";

let value: Duplicate = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |