# Convex-specific instructions

Read the repository-level [`AGENTS.md`](../../../AGENTS.md) first. These rules
apply only to `@creem_io/convex`.

- Keep the core component API framework-neutral. React and Svelte exports must
  remain in their respective entrypoints.
- Changes to Convex functions, schemas, generated component bindings, or public
  framework exports require matching tests and documentation.
- Do not commit credentials, deployment URLs, or generated local Convex state.
- `pnpm check` is a package-local alias for lint and typecheck; it is not a root
  monorepo command.

Validate from this package directory:

```bash
pnpm test
pnpm check
pnpm format
pnpm lint
timeout 30 npx convex dev --once 2>&1 || true
```
