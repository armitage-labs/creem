# Details

Structured, machine-readable context for errors that support an action, omitted entirely when there is none. Currently emitted for `meter_name_taken` when the colliding name is held by an ARCHIVED meter: `archived_holder` is true and `archived_holder_id` is that meter, which can be restored via POST /v1/meters/{id}/unarchive. Additive — treat unknown keys as ignorable.

## Example Usage

```typescript
import { Details } from "creem/models/components";

let value: Details = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |