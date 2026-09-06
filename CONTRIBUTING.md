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
