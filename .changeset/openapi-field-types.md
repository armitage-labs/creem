---
"creem": patch
"@creem_io/cli": patch
---

Fix four OpenAPI field types that made the generated SDK reject valid responses or strip a request body: customers with an `external_id` no longer fail `customers get/list/create/update` or `checkouts get`; usage event `properties` are sent intact instead of `{}`; `events preview` parses; `checkouts get` works for license-key products.
