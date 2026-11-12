# DeadlineAt

ISO-8601 instant the answer is due; past it the order is refunded. null on a revoke or revoke_credit: they have no deadline.

## Example Usage

```typescript
import { DeadlineAt } from "creem/models/components";

let value: DeadlineAt = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |