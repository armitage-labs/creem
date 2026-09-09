# Contributing to the generated TypeScript SDK

Read the repository [contribution guide](../../CONTRIBUTING.md) first. The SDK
source is generated from [`openapi.json`](./openapi.json) and
[`.speakeasy/gen.yaml`](./.speakeasy/gen.yaml), so do not hand-edit generated
files under `src` or generated support files.

For API behavior or schema changes, update the upstream API annotations, refresh
`openapi.json`, and run `pnpm gen:sdk` from the repository root. Generator
configuration changes belong in `.speakeasy/gen.yaml`. Persistent hand-authored
metadata must be represented in the generator configuration or `.genignore` and
must survive regeneration.

Validate an SDK change from the repository root:

```bash
pnpm --filter creem build
pnpm --filter creem typecheck
pnpm --filter creem test
pnpm --filter creem lint
pnpm --filter creem check:package
```

For an SDK bug that cannot be fixed in this repository, open a reproducible bug
report so maintainers can correct the upstream contract or generator input.
