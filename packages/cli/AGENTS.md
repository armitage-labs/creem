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

## Command inventory

<!-- CLI-REFERENCE:START -->
| Command | SDK method | Inputs |
| --- | --- | --- |
| `creem products list` | `products.search` | `--page`, `--limit`, `--status`, `--all` |
| `creem products create` | `products.create` | `--idempotency-key`, `--name`, `--description`, `--price`, `--currency`, `--billing-type`, `--billing-period`, `--recurring-interval`, `--recurring-interval-count`, `--tax-mode`, `--tax-category`, `--pay-what-you-want`, `--suggested-price`, `--success-url`, `--custom-field`, `--abandoned-cart-recovery`, `--image-url`, `--data` |
| `creem products get` | `products.get` | `<id>` |
| `creem products update` | `products.update` | `<id>`, `--name`, `--description`, `--success-url`, `--price`, `--currency`, `--billing-type`, `--billing-period`, `--recurring-interval`, `--recurring-interval-count`, `--tax-mode`, `--pay-what-you-want`, `--suggested-price`, `--image-url`, `--data`, `--yes` |
| `creem products archive` | `products.archive` | `<id>`, `--yes` |
| `creem customers list` | `customers.list` | `--page`, `--limit`, `--all` |
| `creem customers orders` | `customers.getOrders` | `<id>`, `--page`, `--limit`, `--all` |
| `creem customers subscriptions` | `customers.listSubscriptions` | `<id>`, `--page`, `--limit`, `--all` |
| `creem customers licenses` | `customers.listLicenses` | `<id>`, `--page`, `--limit`, `--all` |
| `creem customers get` | `customers.retrieve` | `[id]`, `--email` |
| `creem customers create` | `customers.create` | `--email`, `--name`, `--metadata`, `--data` |
| `creem customers update` | `customers.update` | `<id>`, `--name`, `--metadata`, `--data`, `--yes` |
| `creem customers billing` | `customers.generateBillingLinks` | `<id>`, `--data` |
| `creem subscriptions get` | `subscriptions.get` | `<id>` |
| `creem subscriptions list` | `subscriptions.search` | `--page`, `--limit`, `--all` |
| `creem subscriptions cancel` | `subscriptions.cancel` | `<id>`, `--mode`, `--on-execute`, `--data`, `--yes` |
| `creem subscriptions update` | `subscriptions.update` | `<id>`, `--item`, `--update-behavior`, `--data`, `--yes` |
| `creem subscriptions upgrade` | `subscriptions.upgrade` | `<id>`, `--product`, `--update-behavior`, `--data`, `--yes` |
| `creem subscriptions pause` | `subscriptions.pause` | `<id>`, `--yes` |
| `creem subscriptions resume` | `subscriptions.resume` | `<id>` |
| `creem checkouts get` | `checkouts.retrieve` | `<id>` |
| `creem checkouts create` | `checkouts.create` | `--request-id`, `--product`, `--units`, `--custom-price`, `--discount`, `--affiliate-code`, `--customer`, `--custom-field`, `--success-url`, `--metadata`, `--customer-email`, `--data` |
| `creem licenses activate` | `licenses.activate` | `--key`, `--instance-name`, `--data` |
| `creem licenses deactivate` | `licenses.deactivate` | `--key`, `--instance-id`, `--data`, `--yes` |
| `creem licenses validate` | `licenses.validate` | `--key`, `--instance-id`, `--data` |
| `creem licenses instances` | `licenses.listInstances` | `<id>`, `--page`, `--limit`, `--all` |
| `creem discounts list` | `discounts.search` | `--page`, `--limit`, `--product`, `--status`, `--type`, `--created-after`, `--created-before`, `--all` |
| `creem discounts get` | `discounts.get` | `[id]`, `--code` |
| `creem discounts create` | `discounts.create` | `--name`, `--code`, `--type`, `--amount`, `--currency`, `--percentage`, `--expires`, `--max-redemptions`, `--duration`, `--duration-months`, `--products`, `--data` |
| `creem discounts delete` | `discounts.delete` | `<id>`, `--yes` |
| `creem transactions get` | `transactions.getById` | `<id>` |
| `creem transactions list` | `transactions.search` | `--customer`, `--order`, `--product`, `--page`, `--limit`, `--all` |
| `creem stats summary` | `stats.getSummary` | `--start-date`, `--end-date`, `--interval`, `--currency` |
| `creem moderation screen` | `moderation.screenPrompt` | `--prompt`, `--external-id`, `--data` |
| `creem transactions refund` | `transactions.refund` | `<id>`, `--data`, `--yes` |
| `creem customer-credits create` | `customerCredits.createAccount` | `--name`, `--customer`, `--unit-label`, `--initial-balance`, `--data` |
| `creem customer-credits list` | `customerCredits.listAccounts` | `--limit`, `--customer`, `--starting-after`, `--ending-before`, `--all` |
| `creem customer-credits get` | `customerCredits.getAccount` | `<id>` |
| `creem customer-credits balance` | `customerCredits.getAccountBalance` | `<id>`, `--at` |
| `creem customer-credits entries` | `customerCredits.listEntries` | `<id>`, `--limit`, `--starting-after`, `--ending-before`, `--all` |
| `creem customer-credits freeze` | `customerCredits.freezeAccount` | `<id>`, `--yes` |
| `creem customer-credits unfreeze` | `customerCredits.unfreezeAccount` | `<id>` |
| `creem customer-credits credit` | `customerCredits.creditAccount` | `<id>`, `--amount`, `--reference`, `--idempotency-key`, `--data` |
| `creem customer-credits debit` | `customerCredits.debitAccount` | `<id>`, `--amount`, `--reference`, `--idempotency-key`, `--data`, `--yes` |
| `creem customer-credits reverse` | `customerCredits.reverseTransaction` | `<id>`, `--transaction`, `--data`, `--yes` |
| `creem customer-credits close` | `customerCredits.closeAccount` | `<id>`, `--yes` |
| `creem affiliates invites create` | `affiliates.createInvite` | `--email`, `--name`, `--program`, `--data` |
| `creem affiliates invites list` | `affiliates.listInvites` | `--page`, `--limit`, `--all` |
| `creem affiliates list` | `affiliates.list` | `--page`, `--limit`, `--all` |
| `creem affiliates get` | `affiliates.retrieve` | `<id>` |
| `creem affiliates commissions` | `affiliates.listCommissions` | `<id>`, `--status`, `--page`, `--limit`, `--all` |
| `creem splits create` | `splits.create` | `--description`, `--type`, `--type-reference`, `--recipient`, `--data` |
| `creem splits list` | `splits.list` | `--page`, `--limit`, `--all` |
| `creem splits get` | `splits.retrieve` | `<id>` |
| `creem splits delete` | `splits.delete` | `<id>`, `--yes` |
<!-- CLI-REFERENCE:END -->
