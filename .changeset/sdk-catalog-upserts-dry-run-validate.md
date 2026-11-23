---
"creem": minor
---

The SDK follows the catalog-as-code API: keyed upserts, the dry run and batch validation.

- `products.create`, `discounts.create` and `meters.createMeter` are upserts when the body carries an `externalId`: a new key creates the object, a key the store already has updates it with only the fields sent. They take `ifNoneMatch: "*"` to create only (a held key answers `412` `precondition_failed`). Because an upsert may name only the fields to change, `name`, `price`, `currency` and the other create fields are optional in `CreateProductRequestEntity`; a create without them still answers `400`.
- Every create and update of products, discounts, meters and product groups takes `dryRun: true`: the request runs as it would and is rolled back, and the response's `writeResult.dryRun` is `true`. `discounts.create`, `discounts.update`, `meters.createMeter` and `meters.updateMeter` return the object with `writeResult` (`DiscountWriteResponseEntity`, `MeterWriteApiResponseDto`), and `writeResult` on products gains `result` (`created`, `updated`, `unchanged`), `dryRun`, `changes` and `priceVersion`.
- New methods: `productGroups.create` (an upsert by `externalId`), `productGroups.update`, `productGroups.delete`, `productGroups.addProduct` and `productGroups.removeProduct` write product groups, and `catalog.validate({ items })` checks a batch of up to 100 meter and product writes in one rolled-back transaction and answers one result per item.
