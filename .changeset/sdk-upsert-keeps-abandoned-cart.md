---
"creem": patch
---

`products.create` no longer sends `abandonedCartRecoveryEnabled: false` when the caller leaves it out. With an `externalId` the call is an upsert that changes only the fields sent, so the default switched abandoned cart recovery off on every upsert of a product that had it on. A create without the field still gets the API's default, off.
