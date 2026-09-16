---
"creem": minor
"@creem_io/cli": minor
---

Products API: metered pricing and credit grants from code.

- `products.create` / `products.update` accept `usagePrices[]` (meter, tax-exclusive unit price in minor units per meter unit, free allowance, cap, settlement mode, target credit bucket, trial usage mode) and `features[]` of type `customerCredits` (a credit grant into a customer credit bucket). On update the arrays are the product's complete set: omit to leave untouched, `[]` to remove, include `id` to edit in place.
- Product responses (`get`, `search`, list) expose `usagePrices[]` and each credit feature's `customerCredits`.
- Regenerated from the current OpenAPI document, which also brings the product `trialPeriodDays` / `trialPrice` / `businessNetPricing` fields and `customers.update` `email` into the SDK types and the MCP tool schemas.
- CLI: `products create` and `products update` carry the new fields through `--data`; the parity gate covers them.
