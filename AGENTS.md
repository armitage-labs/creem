# Repository instructions

This is Creem's public monorepo. Keep public package identity, release safety,
documentation, and generated-code boundaries intact.

## Repository map

```text
packages/
├── sdk/                  # generated `creem` SDK and MCP binary
├── cli/                  # public CLI
├── core/                 # reserved for future shared primitives
├── webhook-types/        # shared webhook contract; future core candidate
├── integrations/         # framework and platform integrations
├── ui/                   # framework-agnostic and framework UI packages
├── docs/                 # documentation application
├── examples/             # standalone, workspace-excluded examples
├── templates/            # future cloneable templates; workspace-excluded
└── creem-io/             # frozen deprecated SDK
```

`packages/creem-sdk`, `packages/better-auth`, and `packages/nextjs` are temporary
README-only compatibility landing paths. Do not add source or package manifests
to them. Their cleanup is tracked in
[OSS-51](https://linear.app/creem/issue/OSS-51/review-temporary-package-path-landing-pages).

## Package policy

Every source `package.json` below `packages/` must be registered in
[`package-policy.json`](./package-policy.json). Update the registry in the same
change that adds, moves, publishes, privatizes, or deprecates a package.

- Published libraries belong at `packages/<primitive>`,
  `packages/integrations/<slug>`, or `packages/ui/<slug>`.
- Published packages require complete npm metadata, `README.md`, an exact copy
  of the root `LICENSE`, `CHANGELOG.md`, build/typecheck/package-check scripts,
  public provenance publishing, and Changesets eligibility. Tests must exercise
  behavior; do not use import-only build smoke checks as substitutes for tests.
- The CLI also requires a declared binary and a `--help` smoke test.
- Apps and tools not published to npm require `private: true`, a README,
  validation scripts, and no public `publishConfig`.
- Standalone examples/templates require `private: true`, self-contained setup
  documentation, and deliberate workspace/release exclusion.
- `packages/creem-io` is frozen. Do not add features or return it to CI or
  Changesets; direct users to `creem`.

Run these checks after package-policy changes:

```bash
pnpm check:package-metadata
pnpm test:repository-contracts
pnpm check:repository-contracts
pnpm check:package-artifacts
```

Manypkg and npm-package-json-lint own general manifest consistency. Publint and
Are The Types Wrong validate publishable artifacts through each package's
`check:package` script. The custom repository-contract check is limited to
Creem-specific rules that those tools cannot express. Manypkg deliberately does
not unify external dependency ranges or mirror every peer into devDependencies;
the packages target different framework and compiler generations. It still
requires explicit workspace protocol references for internal dependencies.

Root `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, issue forms, and the
pull request template are canonical. Do not duplicate them into packages.

## Generated SDK boundary

`packages/sdk/src` and its generated support files come from the OpenAPI contract
and Speakeasy configuration. Do not hand-edit generated SDK source. Update
`packages/sdk/openapi.json` or `packages/sdk/.speakeasy/gen.yaml`, then run:

```bash
pnpm gen:sdk
```

Repository metadata and persistent hand-authored files must be represented in
the generator configuration and survive regeneration. Keep `RELEASES.md` as the
generation log and `CHANGELOG.md` as the human-facing release history. The SDK's
nested `.github/workflows` are inert generated artifacts, not repository
workflows. The deprecated SDK's nested workflows are frozen historical files.

## Validation

Use package filters while iterating, then run the relevant root gates:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Do not invent root commands such as `pnpm check` or `pnpm format --check`.
Package-scoped instructions may define additional commands; see
`packages/cli/AGENTS.md`, `packages/integrations/convex/AGENTS.md`, and the docs
instructions under `packages/docs/`.

## Releases and documentation

Add a changeset for user-visible behavior, APIs, types, CLI output, shipped
documentation, or package metadata. Repository-only policy, CI, unpublished app,
and example changes normally do not need one. Keep package versions unchanged in
ordinary feature pull requests; Changesets owns versioning.

Update current documentation and the root package catalog when a package moves
or changes status. Do not rewrite historical changelog or release-log links.
Never point current documentation at archived standalone repositories.
