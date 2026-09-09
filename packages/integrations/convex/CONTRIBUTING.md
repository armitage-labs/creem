# Contributing to `@creem_io/convex`

Read the repository [contribution guide](../../../CONTRIBUTING.md) first. This
file contains only the development details specific to the Convex integration.

## Run the examples locally

Start either frontend together with the local Convex backend and package build:

```bash
pnpm --filter @creem_io/convex dev:react
pnpm --filter @creem_io/convex dev:svelte
```

Create the example's demo user with a real address if you need to test email:

```bash
pnpm --filter @creem_io/convex exec convex env set TEST_USER_EMAIL="your@real.email"
pnpm --filter @creem_io/convex exec convex run example:createDemoUser
```

Sync Creem products before testing pricing or checkout UI:

```bash
pnpm --filter @creem_io/convex exec convex run billing:syncBillingProducts
```

See [`convex/README.md`](./convex/README.md) for the example backend's required
environment variables, exports, webhook route, and auth resolver. Use Creem
test-mode resources during development and never commit credentials.

## Focused validation

Run package commands from the monorepo root:

```bash
pnpm --filter @creem_io/convex build
pnpm --filter @creem_io/convex typecheck
pnpm --filter @creem_io/convex lint
pnpm --filter @creem_io/convex test
pnpm --filter @creem_io/convex check:package
```

`check:package` runs Publint and Are The Types Wrong against the package that
would be published. The settings in `.attw.json` are deliberate:

- `excludeEntrypoints: ["./styles"]` excludes the CSS-only entrypoint.
- `ignoreRules: ["internal-resolution-error"]` accommodates declarations emitted
  by `svelte-package`, which reference `.svelte` files that the checker cannot
  resolve. Because the ignore is package-wide, `typecheck` remains required to
  validate internal imports in the client and React outputs.

`dist/svelte` is produced only by `svelte-package`; `tsconfig.build.json`
excludes `src/svelte` so TypeScript does not emit competing output.

The package is pre-1.0. Follow the root Changesets policy, using a patch for
fixes and small improvements and a minor release for notable or breaking
package changes before 1.0. Do not manually bump the package version or edit
`CHANGELOG.md` in an ordinary feature pull request.

To inspect a one-off tarball without publishing:

```bash
pnpm --filter @creem_io/convex pack:package
```
