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
