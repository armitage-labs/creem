# Contributing to `@creem_io/better-auth`

Read the repository [contribution guide](../../../CONTRIBUTING.md) first. This
file contains only the development details specific to the Better Auth
integration.

## Package structure

- `src/index.ts` defines the server plugin and its public exports.
- `src/client.ts` defines the Better Auth client plugin.
- `src/creem-server.ts` contains server helpers that can be used without the
  plugin endpoints.
- Endpoint implementations and their public inputs live in the matching
  `<name>.ts` and `<name>-types.ts` files.
- `src/hooks.ts`, `src/webhook.ts`, and `src/schema.ts` own webhook behavior and
  persisted subscription state.
- `src/__tests__` contains unit tests; `src/__integration__` contains tests that
  can exercise the Creem test API.
- `examples` and `test/nextjs-app` provide local integration fixtures.
- `dist` is generated output and must not be edited directly.

Keep server-only code out of the client entrypoint. When changing a public
export, verify both ESM and CommonJS output and update the README when consumers
need new setup or migration instructions.

## Focused validation

Run package commands from the monorepo root:

```bash
pnpm --filter @creem_io/better-auth build
pnpm --filter @creem_io/better-auth typecheck
pnpm --filter @creem_io/better-auth test
pnpm --filter @creem_io/better-auth format:check
pnpm --filter @creem_io/better-auth check:package
```

Run the integration suite separately:

```bash
pnpm --filter @creem_io/better-auth test:integration
```

The integration configuration reads optional test credentials from
`packages/integrations/better-auth/.env.test`. Never commit that file or include
real credentials in fixtures, output, or issue reports. Tests that require the
Creem test API must use test-mode resources.

For a complete browser-level exercise, follow
[`test/nextjs-app/README.md`](./test/nextjs-app/README.md). The test application
is a development fixture and is not part of the published npm package.
