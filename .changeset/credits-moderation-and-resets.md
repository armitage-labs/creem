---
"creem": minor
---

Regenerate from the current OpenAPI document.

- Customer credits: `customerCredits.debitAccount` takes an optional `moderationId`, required when debiting a `generation` account. `postTransaction` accepts it too, and transactions return it.
- Products: credit features accept `requiresModeration` and `resetsEachPeriod`. Products and meters accept `externalId`, and products accept `metadata`.
- Orders and subscriptions return `recovered`. Product, transaction and meter searches take new filters.
