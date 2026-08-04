# Developing guide

## Running locally

```sh
pnpm i
pnpm dev:svelte
pnpm dev:react
```

## Development setup

Create a demo user (since this example doesn't have real auth) with a real email
address to receive creems email:

```sh
npx convex env set TEST_USER_EMAIL="your@real.email"
```

```sh
npx convex run example:createDemoUser
```

Sync Creem products to the local Convex database:

```sh
npx convex run billing:syncBillingProducts
```

## Testing

```sh
pnpm clean
pnpm install --frozen-lockfile
pnpm build
pnpm pack:package
pnpm typecheck
pnpm lint
pnpm test
```

## Changesets

This project uses Changesets for versioning, changelogs, npm publishing, git
tags, and GitHub Releases.

For changes that affect the published package, add a changeset (run from the
monorepo root):

```sh
pnpm changeset
```

This package is still pre-1.0, so version bumps do not promise strict semver
compatibility yet. Use `patch` for fixes and small internal improvements, and
`minor` for notable features or breaking package changes before 1.0.

Documentation-only changes, tests, and internal maintenance usually do not need
a changeset.

Do not edit `CHANGELOG.md` for unreleased changes. The release workflow updates
it from merged changesets.

## Packaging notes

`pnpm check:package` runs
[`arethetypeswrong`](https://arethetypeswrong.github.io/) against the built
tarball. Two settings in `.attw.json` are deliberate:

- `excludeEntrypoints: ["./styles"]` — that entry is CSS, not types.
- `ignoreRules: ["internal-resolution-error"]` — the declarations emitted by
  `svelte-package` for `dist/svelte` import `.svelte` files, which attw cannot
  resolve. The rule is package-wide because attw has no per-entrypoint ignore,
  so it also suppresses genuine internal resolution errors in `dist/client` and
  `dist/react`. Those paths are covered instead by `pnpm typecheck`, which
  compiles the same sources under `module: NodeNext` and therefore validates
  import specifiers and extensions.

`dist/svelte` is produced solely by `svelte-package`; `tsconfig.build.json`
excludes `src/svelte` so tsc does not emit competing output there.

## Deploying

### Building a one-off package

```sh
pnpm clean
pnpm install --frozen-lockfile
pnpm pack:package
```

### Deploying a new version

Merging changesets to `main` triggers the release workflow. The workflow either
opens or updates a version pull request. Merging that version pull request
publishes the package to npm, pushes git tags, and creates GitHub Releases.

The npm package should be configured for Trusted Publishing from the monorepo
root `.github/workflows/release.yml`, using the `release` GitHub environment.
This avoids long-lived npm publish tokens and lets npm create provenance for
public releases.
