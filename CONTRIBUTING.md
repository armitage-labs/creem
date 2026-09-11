# Contributing to Creem

Thank you for contributing to Creem's public SDKs, integrations, UI packages,
CLI, documentation, and examples.

## Before you start

- Use Node.js 24 or newer.
- Use the pnpm version declared in the root `package.json`.
- Search existing issues before opening a new one.
- Report vulnerabilities privately according to [SECURITY.md](./SECURITY.md).
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Set up the monorepo

```bash
pnpm install --frozen-lockfile
```

Run the repository checks from the root:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm check:package-metadata
pnpm test:repository-contracts
pnpm check:repository-contracts
pnpm check:package-artifacts
```

For faster iteration, filter to the package you are changing:

```bash
pnpm --filter @creem_io/nextjs build
pnpm --filter @creem_io/nextjs typecheck
pnpm --filter @creem_io/nextjs test
```

Before opening a pull request, run the affected package checks followed by the
relevant root checks. CI may run a broader set based on the changed paths.

## Package-specific development

This file is the canonical contribution guide for the repository. Package
guides supplement it only with local architecture, setup, and validation:

- [Generated TypeScript SDK](./packages/sdk/CONTRIBUTING.md)
- [Better Auth integration](./packages/integrations/better-auth/CONTRIBUTING.md)
- [Convex integration](./packages/integrations/convex/CONTRIBUTING.md)

Start here, then follow the relevant package guide when changing one of those
areas. Consumer installation and usage instructions belong in package READMEs.

## Package and repository policy

Every source `package.json` under `packages/` must be classified in
[`package-policy.json`](./package-policy.json). New packages must follow the
directory and package-type rules in [`AGENTS.md`](./AGENTS.md), including public
metadata, package-local licensing, validation commands, and release eligibility.

The checks deliberately use established package tooling where possible:
Manypkg checks workspace consistency, npm-package-json-lint checks manifests,
and each published package runs Publint and Are The Types Wrong against what it
would publish. The repository-contract script covers only Creem-specific rules,
including package classification, exact license copies, Changesets eligibility,
and generated-SDK preservation.

Repository-level community files are canonical. Do not add package-local
security policies, codes of conduct, issue templates, or pull request templates.

## Changesets

Add a changeset for changes that alter a published package's API, behavior,
types, command output, documentation shipped in the package, or package
metadata:

```bash
pnpm changeset
```

Choose patch, minor, or major according to semantic versioning and write the
summary for package consumers. A changeset is normally unnecessary for apps not
published to npm, examples, tests, repository-only governance, or CI-only
changes that do not alter a published artifact.

## Generated SDK

[`packages/sdk`](./packages/sdk) is generated from
[`packages/sdk/openapi.json`](./packages/sdk/openapi.json) and
[`packages/sdk/.speakeasy/gen.yaml`](./packages/sdk/.speakeasy/gen.yaml).
Do not hand-edit generated SDK source. Make API changes in the source OpenAPI
contract and regenerate from the repository root:

```bash
pnpm gen:sdk
```

Hand-authored governance files and metadata must be represented in the generator
configuration and must survive regeneration.

Review the generated diff. If it changes the published SDK's API, behavior,
types, or shipped documentation, add a changeset:

```bash
pnpm changeset
```

`pnpm gen:sdk` does not create a changeset or bump the package version.
The release workflow applies Changesets and synchronizes SDK version metadata.
Keep package versions unchanged in feature PRs.

## Homebrew CLI releases

This tap distributes stable `X.Y.Z` CLI releases. Prerelease versions are not
supported; selecting one fails before a formula update can be created.

The `Release` workflow selects `@creem_io/cli` from Changesets' actual
`publishedPackages` output and calls `Update Homebrew` with that exact version.
SDK-only releases and version PR generation do not trigger a tap update.

The updater verifies npm package identity, version, tarball URL and SHA-512
integrity, then calculates SHA-256 and opens a PR in
[`armitage-labs/homebrew-creem`](https://github.com/armitage-labs/homebrew-creem).
The formula uses the published scoped npm tarball. There is no separate CLI
GitHub tarball or manual build step.

### One-time setup

1. Merge the tap's CI/automation implementation first. The initial tap PR also
   updates the stale formula to the already-published CLI 0.3.0.
2. Install a GitHub App on **only `armitage-labs/homebrew-creem`**, with repository
   **Contents: read and write** and **Pull requests: read and write** permissions.
   It does not need access to the monorepo; the monorepo uses its private key to
   mint a token scoped to the tap. A custom token is necessary so that the PR
   triggers the tap's CI.
3. In the monorepo's existing `release` environment, configure variable
   `HOMEBREW_APP_ID` and secret `HOMEBREW_APP_PRIVATE_KEY`.
4. In the tap, configure variable `HOMEBREW_RELEASE_BOT_LOGIN` to the App's exact
   login, including `[bot]`. Follow the
   [tap contribution guide](https://github.com/armitage-labs/homebrew-creem/blob/main/CONTRIBUTING.md#maintainer-setup)
   to configure required Homebrew checks, up-to-date branch enforcement, and
   protected workflow/script ownership before enabling automatic merging.
   Neither the App nor Actions should bypass those protections. Restrict the
   monorepo's `release` environment to the protected `main` branch.
5. Merge this implementation and use the manual recovery command below for
   `0.3.0` if the tap still needs updating. Future successful CLI publishes call
   the workflow automatically.

The App is used only to update the tap formula and open PRs. npm publishing keeps
its existing OIDC credentials. Both implementation PRs require human review;
only future formula-only PRs from the configured App are automatically merged.

The tap uses a custom CI-gated merge API call, not GitHub's separate "Allow
auto-merge" feature. Branch protection remains mandatory; the script does not
replace repository rules. npm integrity verification checks package identity
and bytes, not package safety or independent provenance. The npm publisher,
release App, and protected-branch maintainers remain trusted principals.

### Recovery and verification

The updater serializes runs, uses one PR branch per version, and skips equal or
newer formula versions. Registry reads retry briefly for propagation delays.
An unavailable package, invalid integrity or missing credentials fails the job
visibly; it never changes an npm release or silently declares Homebrew updated.

If npm succeeds but the Homebrew job fails, re-run **only the failed jobs** of
that release, or run the standalone workflow on `main`:

```sh
gh workflow run homebrew-release.yml --repo armitage-labs/creem --ref main -f version=0.3.0
```

This command does not publish npm packages. It can also recover a partial npm
release that did not reach the downstream job. Re-running the entire Changesets
release may have no newly published CLI output, so use this standalone recovery
when necessary. Existing open PRs are reused; if a maintainer deliberately closes
an update PR, inspect/reopen it before retrying.

The workflow summary links to the tap PR. The tap tests installation, `--version`,
`--help`, and the test-mode request destination without real API credentials on
macOS and Linux. Its merge workflow checks the author, changed files, current
head SHA, and version ordering before merging. Failed checks or branch rules
requiring approval leave the PR open for maintainers to resolve.
When `main` advances, the tap refreshes eligible release branches and dispatches
new CI before merging them, including when two releases arrive close together.

To test the updater locally (Node 24, no credentials required):

```sh
node --test scripts/update-homebrew.test.mjs
# Updates only a local formula file after validating the published artifact:
node scripts/update-homebrew.mjs 0.3.0 /path/to/homebrew-creem/Formula/creem.rb
```

## Pull requests

- Keep a pull request focused on one coherent change.
- Add or update tests for behavior changes.
- Update package documentation and changelogs when users need the information.
- Complete the pull request template, including testing and AI-assistance notes.
- Do not include secrets, credentials, production data, or vulnerability details.

Use the repository issue forms for confirmed bugs and documentation problems.
Submit feature requests and vote on existing ideas in
[Featurebase](https://creem.featurebase.app/).
For product support and usage questions, use the support routes in the
[Creem documentation](https://docs.creem.io).
