---
"creem": minor
---

Customer credits: AI generation credits, moderation IDs on debits, and per-period credit resets.

- `customerCredits.debitAccount` takes an optional `moderationId` (new `DebitRequestDto`). It is required when debiting a `generation` account (AI generation credits) and is checked and linked on other accounts. `customerCredits.postTransaction` accepts `moderationId` too, and transaction responses return `moderationId`.
- Product credit features (`customerCredits`) accept `requiresModeration`, which grants into the customer's `generation` account, and `resetsEachPeriod`, which expires a subscription's unused credits at each paid period. Both are echoed on product responses.
- Regenerated from the current OpenAPI document, which also brings product and meter `externalId` / product `metadata`, the `recovered` flag on orders and subscriptions, and refreshed search filters into the SDK types.
