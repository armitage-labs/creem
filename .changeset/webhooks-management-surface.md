---
"creem": minor
"@creem_io/cli": minor
---

Expose the webhook endpoint management surface. The SDK gains `webhooks.list`, `webhooks.create`, `webhooks.get`, `webhooks.update`, `webhooks.delete` and `webhooks.getSecret`, the bundled MCP server gains the matching `webhooks-*` tools, and the CLI gains `creem webhooks …` commands (list, create, get, update, delete, secret). Deleting a webhook is a destructive operation and prompts for confirmation or requires `--yes`.
