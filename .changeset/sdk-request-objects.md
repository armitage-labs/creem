---
"creem": major
"@creem_io/cli": patch
"@creem_io/convex": major
---

Every SDK method now takes one request object, then the optional `RequestOptions`: `creem.products.update({ id, updateProductRequestEntity }, options)` instead of `creem.products.update(id, body, options)`. The HTTP API doesn't change. Why: with positional arguments, a new optional API parameter was inserted before `options`, so existing calls stopped compiling (and in JavaScript sent the options object as that parameter). With a request object, a new parameter of an operation that already has one is a new optional property and no call changes, so upcoming parameters such as `dry_run`, `If-None-Match` and `If-Match` on those operations arrive in minor releases. The 19 methods that take only a body keep taking it; the migration guide says what changes if one of them gains a parameter.

- A method whose parameters are all optional still takes the object: `creem.products.search()` becomes `creem.products.search({})`.
- The bundled MCP server's tools take the same request object (`{ "request": { … } }`).
- The CLI moves to the new signatures; its commands and flags don't change. `subscriptions list --status` accepts any status, and a billing type the CLI doesn't know is shown as it is instead of as recurring.
- Response enums are open: a value the API adds later comes through as a string instead of failing the response. The same holds for webhook payloads parsed with `parseWebhookEventEntity` / `constructWebhookEventEntity`, and an unknown event type comes back as the unknown variant (`eventType: "UNKNOWN"`, the payload in `raw`) instead of throwing. So new values and new webhook event types are minor releases from now on. A `switch` over every known value needs a `default` branch.
- `@creem_io/convex` calls the new signatures and now needs `creem` 2 as its peer dependency (`^2.0.0`); its component API doesn't change, except that a credit entry's `side` is typed as a string, because the SDK now passes a side the API adds later through. The webhook route acknowledges an event type it doesn't know with `202` instead of answering `400`, so Creem stops retrying it.

`packages/sdk/MIGRATION.md` lists every changed method next to its new form.
