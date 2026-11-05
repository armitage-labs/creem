# InviteStatus

Invite lifecycle for email-type recipients that have not been accepted yet: `pending` (awaiting acceptance), `declined` (recipient declined) or `revoked` (merchant cancelled). Absent for resolved store/user recipients.

## Example Usage

```typescript
import { InviteStatus } from "creem/models/components";

let value: InviteStatus = "pending";

// Open enum: unrecognized values are captured as Unrecognized<string>
```

## Values

```typescript
"pending" | "declined" | "revoked" | Unrecognized<string>
```