---
"@creem_io/cli": minor
---

The CLI follows the regenerated SDK:

- New commands: `product-groups create` (an upsert when `--external-id` is set), `product-groups update <id>`, `product-groups delete <id>`, `product-groups add-product <id>`, `product-groups remove-product <id> --product-id <id>` and `catalog validate --data <batch>`, which checks up to 100 meter and product writes together without writing anything.
- `products`, `discounts` and `meters` `create` and `update`, and `product-groups create` and `update`, take `--dry-run`, a switch: the API runs the write and rolls it back, and the answer's `writeResult.dryRun` is `true`. The creates take `--if-none-match '*'` to create only.
- `products create` no longer refuses a missing `--name`, `--description`, `--price`, `--currency` or `--billing-type` itself, because with `--external-id` it can update an existing product with only the fields sent; the API still answers `400` for a create without them.
- `subscriptions list` takes `--product-id`, `--price-id` and `--customer-id`, filtered by the API. `--status` still takes one status and reads every page; a status the API knows is now also sent as its filter, so fewer pages come back.
