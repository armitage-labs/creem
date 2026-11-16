---
"creem": major
"@creem_io/cli": minor
---

`creem` 2.0 follows the current API:

- New methods: `productGroups.list({ limit, startingAfter, endingBefore, externalId })` and `productGroups.get({ id })` read product groups, and `products.listPrices({ id })` lists a product's price versions.
- `discounts.create` and `meters.createMeter` take an optional `idempotencyKey`, sent as the `Idempotency-Key` header. A create with a key that is still in progress, or failed with an unclear outcome less than 5 minutes ago, answers `429`: `discounts.create` throws `TooManyRequestsErrorEntity`, and `meters.createMeter` throws `UsageMeteringErrorApiResponseDto`. Because both methods gained a parameter, their body moves under its name: `discounts.create({ createDiscountRequestEntity, idempotencyKey })` and `meters.createMeter({ createMeterApiRequestDto, idempotencyKey })`. The migration guide lists them.
- Discounts can name their products by `external_id` (`appliesToProductExternalIds`) and carry their own `externalId`; `appliesToProducts` is no longer required when the other list names a product. Features carry an `externalId`, and products return `abandonedCartRecoveryEnabled`, which `products.update` also takes, along with `customFields`.
- The `credits.reversed` webhook event: `parseWebhookEventEntity` and `constructWebhookEventEntity` parse it into its own shape, with a `CustomerCreditsReversalEntity` as `object`.

The CLI's `discounts create` and `meters create` take `--idempotency-key`, and `discounts create` accepts a discount whose products are named only in `appliesToProductExternalIds`. New read-only commands: `product-groups list` (cursor pagination with `--limit`, `--starting-after`, `--ending-before` and `--all`, filtered by `--external-id`), `product-groups get <id>` and `products prices <id>`, which lists a product's price versions.
