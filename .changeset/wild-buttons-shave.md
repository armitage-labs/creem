---
"@creem_io/cli": patch
---

Fix test-environment requests being sent to the production API host. The CLI
selected its server with `serverIdx`, which was removed in `creem@1.5.0`
(renamed to `server`); with `creem` resolving to 1.5.x on fresh installs the
option was silently ignored and every request defaulted to `api.creem.io`,
so `creem_test_` keys always failed with `401 Invalid API Key`. The client is
now constructed with `serverURL`, which is stable across creem SDK versions.
