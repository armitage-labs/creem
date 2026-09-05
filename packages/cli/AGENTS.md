# CLI-specific instructions

Read the repository-level [`AGENTS.md`](../../AGENTS.md) first. These rules apply
only to `@creem_io/cli`.

- Put commands in `src/commands`, shared API/auth/config behavior in `src/lib`,
  terminal interaction in `src/tui`, and output formatting in `src/utils`.
- Treat command names, flags, exit codes, stdout JSON, configuration keys, and
  credential storage as public contracts. Document intentional changes and add
  a changeset.
- Never print or persist API keys outside the existing protected configuration
  flow. Redact secrets from errors and fixtures.
- Keep non-interactive behavior deterministic and machine-readable. Send errors
  to stderr and use a non-zero exit code for failures.
- Preserve the executable entrypoint and the `--help` package smoke test.

Validate CLI changes from the repository root:

```bash
pnpm --filter @creem_io/cli build
pnpm --filter @creem_io/cli typecheck
pnpm --filter @creem_io/cli test
```

## SDK parity maintenance

`src/operation-manifest.json` is the reviewed mapping for the generated SDK.
Resource registration and shared input/output/safety behavior live in
`src/commands/resource.ts`; typed SDK calls live in `src/commands/operations/`.
Validate schemas and exact SDK arguments when changing mappings. Do not replace
SDK calls with raw Creem HTTP requests. The external Lemon Squeezy migration
adapter is the sole external-API exception.

After updating mappings, run `node packages/cli/scripts/sync-reference.mjs` from
the repository root. Also run CLI `lint`, `parity:check --strict`, and
`test:packed`, in addition to build/typecheck/test. The packed check installs
both workspace SDK and CLI tarballs in an isolated temporary project, since
the stacked SDK may not yet be published. Node 22 and 24 run the same check in CI.

`TEST_API_KEY` enables the optional read-only API smoke test. Tests never
create remote resources. Publish the required workspace SDK version before
releasing a CLI that depends on it; npm and Homebrew have separate release steps.

## Documentation and command discovery

Keep the README as a short package overview and quick start linking to
[the canonical CLI docs](https://docs.creem.io/code/cli). Maintain usage details
in `packages/docs/code/cli.mdx` and the human/agent guides. The reference sync
script generates only `packages/docs/snippets/cli-reference.mdx`; the parity
check validates documented command coverage there. Keep SDK comparisons and
operation counts out of user-facing copy.

Discover commands and inputs with `creem --help`, `creem <resource> --help`,
and `creem <resource> <command> --help`. To inspect the local build, use
`node packages/cli/dist/index.js --help` from the repository root after building.
Do not duplicate the command inventory in this file or the README.
