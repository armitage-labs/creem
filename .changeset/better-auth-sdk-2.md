---
"@creem_io/better-auth": major
---

The plugin now uses `creem` 2. Its options, endpoints and hooks don't change, but `createCreemClient()` returns a `creem` 2 client, whose methods take one request object: `createCreemClient(config).subscriptions.get({ subscriptionId: "sub_123" })` instead of `.subscriptions.get("sub_123")`. If you call the SDK through `createCreemClient()`, update those calls as listed in `creem`'s [migration guide](https://github.com/armitage-labs/creem/blob/main/packages/sdk/MIGRATION.md).

`retrieveSubscription` and `searchTransactions` pass through values the API adds later, as `creem` 2 does: a subscription's `status`, `mode` and `collectionMethod`, and a transaction's `type`, `status` and `mode` are typed as their known values or any other string. A `switch` over every known value needs a `default` branch.
