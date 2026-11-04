---
"@creem_io/better-auth": major
---

The plugin now uses `creem` 2. Its options, endpoints, hooks and responses don't change, but `createCreemClient()` returns a `creem` 2 client, whose methods take one request object: `createCreemClient(config).subscriptions.get({ subscriptionId: "sub_123" })` instead of `.subscriptions.get("sub_123")`. If you call the SDK through `createCreemClient()`, update those calls as listed in `creem`'s [migration guide](https://github.com/armitage-labs/creem/blob/main/packages/sdk/MIGRATION.md).
