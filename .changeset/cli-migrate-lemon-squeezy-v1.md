---
"@creem_io/cli": minor
---

`creem migrate lemon-squeezy` can now run again safely. It keys every product by `ls_variant_<id>` and every discount by `ls_discount_<id>` in `external_id`, reads your Creem store first, and prints a plan of what it creates, updates, leaves unchanged and skips before the first write. A second run finds what the first one wrote and writes nothing when nothing changed.

- New mappings: free one-time products, pay-what-you-want one-time products with their suggested price, custom billing cycles (weekly and others), trials in days, the LS tax code, license key settings as a license key feature, and files as file downloads, uploaded through `POST /v1/files` and uploaded again only when their SHA-256 changed. Discount codes limited to some variants now apply to those products instead of being skipped; other codes apply to every migrated product, including products from earlier runs.
- Skipped with the reason in the plan: free subscriptions, usage-based and tiered prices, unsupported billing cycles, and the hidden default variant of a product with other variants. Product groups are listed for you to create in the dashboard.
- `--json` prints a versioned migration report (`schema: "creem.migration_report"`, `version: 1`). With `--yes` it runs the plan and prints the result. Exit code `4` means the Lemon Squeezy store couldn't be read completely and nothing was written; `6` means the run finished with failed items.
- New `--adopt` flag accepts proposals to give an existing Creem product or discount without a key its Lemon Squeezy key. In a terminal, the CLI asks about each proposal.
- The command no longer fetches Lemon Squeezy customers, and no longer says customers are migrated.
