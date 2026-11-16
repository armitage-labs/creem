# Action

What is asked: a first key, a top-up of the account the grant names, or (after a refund or chargeback) a revoke: disable that account; revoke_credit: remove the credit of the order named here only, the account and the key stay.

## Example Usage

```typescript
import { Action } from "creem/models/components";

let value: Action = "revoke_credit";
```

## Values

```typescript
"provision" | "top_up" | "revoke" | "revoke_credit"
```