---
"@creem_io/cli": minor
---

`creem migrate lemon-squeezy` writes through Creem's keyed upserts and has Creem check every write before the first one:

- Products, product groups and discounts are written with `POST` and their key in `external_id` (`ls_variant_<id>`, `ls_product_<id>`, `ls_discount_<id>`), which creates the object when the key is new and changes only the fields sent otherwise. Two runs at the same time can't create an object twice. Only two writes still go by ID: adopting an object without a key, and an update that clears a trial, a redemption limit or an expiry date, which the upsert can't send.
- Product groups are created now: one per Lemon Squeezy product with two or more subscription variants, with its products in Lemon Squeezy's order. If you already made the group in the dashboard, Creem refuses the new one and the plan names the command that gives yours the key.
- Before the first write, Creem checks the plan without writing anything: the products together with `POST /v1/catalog/validate`, and each product group and discount with `?dry_run=true`. The plan shows what Creem would do with each item. When Creem refuses an item, nothing is written, the item carries Creem's error and a hint, and the command exits with the new code `8`, also for `--dry-run` and a `--json` plan. `--force` writes the other items and leaves the refused ones out (exit `6`).
- During the run, each write runs as a dry run again right before it. When Creem answers a dry run without `write_result.dry_run: true`, the command stops and exits `1`.
- `--dry-run` is this check alone: it writes and uploads nothing.
- A store migrated by the previous version re-runs with every item unchanged; the only new writes are its product groups.
