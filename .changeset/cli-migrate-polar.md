---
"@creem_io/cli": minor
---

New `creem migrate polar` copies a Polar organization's meters and products into a Creem store. You can run it again: every object is matched by its key.

- It reads the organization with an organization access token (`--polar-token` or `POLAR_ACCESS_TOKEN`) from `--polar-server production` (the default) or `sandbox`. It only reads from Polar, and the token is never sent to Creem.
- Every Creem object is keyed by its Polar id in `external_id`. A meter becomes a Creem meter: the top-level `name eq` clause of its filter becomes the event name and the other clauses become Creem filter clauses. A meter with nested clauses, or with no `name eq` clause, is skipped. Its unit label is Polar's custom label, or the meter's name, with a warning.
- A product with a fixed or pay-what-you-want price in USD or EUR becomes a product. Its metered prices become usage prices on their meters, settled `postpaid`. When the store doesn't have postpaid usage billing, Creem refuses the product, none of it is written, and the plan says to ask Creem support.
- Seat-based and tiered prices, products with only metered prices, free subscriptions, legacy products with a price per interval, other currencies and archived products are skipped, each with its reason. `--include-archived` writes archived products as archived. A product's benefits are listed on it as not migrated. Customers, subscriptions, orders, issued license keys, checkout links and webhooks are not migrated.
- It works like `creem migrate lemon-squeezy`: Creem checks the whole plan first (meters and products together with `POST /v1/catalog/validate`), every write runs as a dry run right before it, look-alike Creem products without a key are adopted only when you confirm, and the report and exit codes are the same. The report has a new item kind, `meter`.
