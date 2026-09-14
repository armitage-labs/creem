# EventId

The idempotency key the event would be recorded under — your `event_id`, trimmed. Null when the event is invalid, and also null when you omitted `event_id`: ingest generates a fresh id at accept time, so previewing one would be misleading.

## Example Usage

```typescript
import { EventId } from "creem/models/components";

let value: EventId = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |