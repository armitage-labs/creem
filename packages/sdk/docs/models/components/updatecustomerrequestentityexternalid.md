# UpdateCustomerRequestEntityExternalId

Your own id for this customer. Unique per store; usage ingestion resolves `external_customer_id` against it. Omit to leave unchanged; send `null` to clear it. Trimmed; letters, digits, `_` and `-` only; at most 255 characters.

## Example Usage

```typescript
import { UpdateCustomerRequestEntityExternalId } from "creem/models/components";

let value: UpdateCustomerRequestEntityExternalId = {};
```

## Fields

| Field       | Type        | Required    | Description |
| ----------- | ----------- | ----------- | ----------- |