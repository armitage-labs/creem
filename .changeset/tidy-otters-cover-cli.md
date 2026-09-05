---
"@creem_io/cli": minor
---

Expand CLI commands and request inputs for product/customer/subscription updates, refunds, licenses, stats, moderation, customer credits, affiliate invitations, and revenue splits. Compile against the workspace SDK and enforce operation, input, command, and documentation parity in CI.

Add environment-key authentication, complete camelCase JSON/file/stdin request bodies, typed validation, page/cursor traversal, streaming NDJSON, global output options, structured trace-aware errors, and non-retrying writes. Preserve large credit amounts as strings.

Compatibility changes: subscription and discount lists now use the authoritative SDK search endpoints; subscription list JSON removes the old transaction-derived `note` field. Destructive commands (including updates and upgrades) require a TEST/LIVE confirmation interactively or `--yes` in automation and JSON/NDJSON modes. Existing command paths and aliases remain available.

Preserve the legacy `creem help [command]` path, list pagination defaults, immediate cancellation mode, and fixed-discount USD default. Allow migration previews without target credentials and scope-restricted API keys when login validation authenticates successfully but the validation probe is forbidden.

Restore Homebrew, npm, and npx installation choices in the docs. Keep the README focused on getting started and link to the canonical guides and command reference.
