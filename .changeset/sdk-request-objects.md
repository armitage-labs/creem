---
"creem": major
"@creem_io/cli": patch
"@creem_io/better-auth": patch
"@creem_io/convex": major
---

Every SDK method now takes one request object, then the optional `RequestOptions`: `creem.products.update({ id, updateProductRequestEntity }, options)` instead of `creem.products.update(id, body, options)`. The HTTP API doesn't change. Why: with positional arguments, a new optional API parameter was inserted before `options`, so existing calls stopped compiling (and in JavaScript sent the options object as that parameter). With a request object, a new parameter is a new optional property and no call changes, so upcoming parameters such as `dry_run`, `If-None-Match` and `If-Match` arrive in minor releases.

- A method whose parameters are all optional still takes the object: `creem.products.search()` becomes `creem.products.search({})`.
- The bundled MCP server's tools take the same request object (`{ "request": { … } }`).
- The CLI and the Better Auth plugin move to the new signatures; their commands, flags, options and responses don't change.
- `@creem_io/convex` calls the new signatures and now needs `creem` 2 as its peer dependency (`^2.0.0`); its component API doesn't change.

`packages/sdk/MIGRATION.md` lists every changed method next to its new form.
