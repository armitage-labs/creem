---
"@creem_io/better-auth": major
---

Complete native Better Auth client inference and make checkout navigation explicit for 2.0.

- Raise the Better Auth peer requirement to `^1.5.6` so native inferred endpoint declarations resolve correctly. Upgrade Better Auth alongside the plugin.
- Checkout and portal now default to `redirect: false`. Add `redirect: true` to preserve automatic navigation, or navigate to the returned `data.url` yourself.
- Billing and access endpoint failures use Better Auth `APIError`, keeping their existing HTTP statuses. Browser clients receive `data: null` and an error with `message` and `status`; direct `auth.api` calls throw. HTTP error bodies (including `asResponse: true`) use `message` instead of the previous `error` field. Failed access checks no longer return an indeterminate success payload.
- Standard `createAuthClient` now infers successful responses and persisted Creem session fields. `createCreemAuthClient` remains exported but is deprecated; migrate to the standard client with `creemClient()` and narrow SDK ID/expanded object unions where needed. Dates received over HTTP remain serialized values.
- The Better Auth transaction search endpoint returns `{ items, pagination }` directly instead of the SDK iterator envelope. Update raw/native callers from `data.result.items` and `data.result.pagination` to `data.items` and `data.pagination`. The standalone server helper is unchanged.
- Preserve the full persistence opt-out: `persistSubscriptions: false` adds neither subscription models nor Creem user fields and skips their writes. Mirror it with `creemClient({ persistSubscriptions: false })` to get accurate session types.
- Correct `schema` typing to accept physical model and column name mappings for existing plugin fields. Replace field definition objects with string column names. Overrides apply only with persistence enabled and no longer leak between plugin instances. Unchanged default schemas need no database migration; review any renamed columns against the existing database.

See the 2.0 migration guide for upgrade examples and the related cancellation/access policy changes.
