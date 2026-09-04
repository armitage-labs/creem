# Better Auth package tests

There are two ways to test `@creem_io/better-auth` in this repository.

## Automated tests

Unit and integration tests live beside the package source in `src/__tests__` and
`src/__integration__`. Run them from the repository root:

```bash
pnpm --filter @creem_io/better-auth test
pnpm --filter @creem_io/better-auth test:integration
```

API-backed cases read optional Creem test credentials from `.env.test` and skip when no API key is
configured. See the [package contributing guide](../CONTRIBUTING.md#focused-validation) for the
supported variables and safety requirements.

## Manual Next.js test app

[`nextjs-app`](nextjs-app) is a repository-only application for maintainers who want to exercise
the full Better Auth integration in a browser: sign-up, checkout, webhook synchronization, access
checks, the customer portal, and transaction history.

It is deliberately separate from the published npm package. Follow its
[`README.md`](nextjs-app/README.md) to install and run it.

The repository also contains [`examples/nextjs`](../examples/nextjs), a smaller Better Auth +
Next.js example intended for package users. Use the
[public Better Auth guide](https://docs.creem.io/code/sdks/better-auth) for the complete API
documentation.
