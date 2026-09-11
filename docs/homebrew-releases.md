# Homebrew CLI releases

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

## One-time setup

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
   login, including `[bot]`. Follow the tap README to require Homebrew checks and
   permit its workflow to merge validated release PRs.
5. Merge this implementation and use the manual recovery command below for
   `0.3.0` if the tap still needs updating. Future successful CLI publishes call
   the workflow automatically.

The App is used only to update the tap formula and open PRs. npm publishing keeps
its existing OIDC credentials. Both implementation PRs require human review;
only future formula-only PRs from the configured App are automatically merged.

## Recovery and verification

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
