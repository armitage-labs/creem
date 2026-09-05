# Creem CLI

The official `@creem_io/cli` exposes all 55 operations in the workspace `creem` TypeScript SDK, including every request input. Requires Node.js 22 or newer.

```sh
npm install -g @creem_io/cli
creem --version
creem --help
```

For local use, run `creem login` and enter your key in the masked prompt. For automation, provide `CREEM_API_KEY` through your environment or CI secret store:

```sh
export CREEM_API_KEY='creem_test_YOUR_KEY'
creem products list --json
```

Environment credentials take precedence over `~/.creem/config.json` and do not write to disk. Test/live mode is inferred from the key. An explicit `--environment test|live` must match the key. Login validates the key before saving; the configuration directory is mode `0700`, and the file is `0600`. `creem logout` removes the stored key; an environment key remains active. `login --api-key` remains available for compatibility, but environment secrets and masked login avoid keys in process arguments.

## Commands

Run any command with `--help` for its inputs. Existing aliases `cust`, `subs`, and `txn` remain supported; `credits` aliases `customer-credits`. Resource IDs are positional where shown. `customers get <email> --email` and `customers get --email <email>` both work.

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

Additional commands: `login`, `logout`, `whoami`, `config show|get|set|list`, `help`, and `migrate lemon-squeezy`. The migration adapter connects to Lemon Squeezy and is separate from SDK operation parity.

## Complete request bodies

Every body operation accepts SDK **camelCase** JSON, inline, from a file, or from stdin:

```sh
creem checkouts create --data '{"productId":"prod_123","units":2,"customer":{"email":"person@example.com"},"metadata":{"visits":42}}' --json
creem products create --data @product.json --idempotency-key product-import-1 --json
cat customer.json | creem customers update cust_123 --data - --yes --json
```

`--data` cannot be combined with body flags. Positional IDs, header/query flags, output options, and `--yes` remain allowed. A body ID must agree with a positional ID. Unknown fields, invalid types, empty updates, conflicting cursors, and invalid integers fail before an API request. Use JSON strings for credit amounts, including values larger than JavaScript's safe integer range. JSON is the escape hatch for all nested inputs; the deprecated `customField` has no typed flag—use `customFields`.

Repeat `--metadata key=value` for string metadata; the last duplicate key wins. Use `--data` for nested or numeric metadata. Repeat `--custom-field`, `--item`, and `--recipient` with one JSON object each. Repeat `--image-url` for ordered images; a single URL preserves the existing singular SDK field. Boolean flags accept optional `true` or `false` values. ISO dates are accepted for date flags; stats use Unix milliseconds.

Free products accept `--price 0`; paid products start at 100 cents. Custom billing requires `--billing-period custom`, `--recurring-interval day|week|month|year`, and `--recurring-interval-count`, with bounds 365/52/24/3 respectively. Pay-what-you-want and checkout custom prices require one-time products; the server validates the stored product when its billing type is not part of your request. Checkout custom prices range from 100 to 99999999 cents per unit.

## Pagination and output

`--json`, `--output table|json|ndjson`, `--no-color`, `--timeout <milliseconds>`, `--environment`, and `--yes` work before or after resource commands. Default request timeout is 30000 ms. Non-TTY output has no ANSI colors.

List commands return one SDK page by default. Numbered lists accept `--page` and `--limit`; credits use `--limit` plus either `--starting-after` or `--ending-before`. `--all` walks from the supplied page/cursor to the end, preserving filters and cursor direction.

```sh
creem subscriptions list --all --json
creem credits entries acc_123 --limit 100 --all --output ndjson
```

Single-page JSON is the SDK entity or the SDK page's `result`, without transport/iterator fields. `--all --json` combines items into a collection with recomputed pagination; credit collections use `data` and `hasMore: false`. NDJSON writes one item per line as pages arrive and does not buffer the whole collection. A later failure leaves earlier NDJSON records on stdout, emits an error on stderr, and exits nonzero; consumers must check the exit code. Non-list NDJSON writes one result line.

`subscriptions list --status` remains a client-side filter: it always scans every page and rejects explicit `--page`/`--limit`. Its JSON shape is `{ "items": [], "filter": { "status": "active", "scope": "client" }, "totalRecords": 0 }`.

## Errors and confirmations

JSON/NDJSON errors go to stderr as `{ "error": { "type", "message", "status", "traceId", "details", "cause", "suggestion", "retryAfter" } }`. API message arrays, trace IDs, and retry guidance are retained; API keys and submitted license keys are redacted. Successful JSON remains the SDK result, including license data; human output masks license keys.

| Exit | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Unexpected failure |
| 2 | CLI usage or input validation |
| 3 | Authentication or configuration |
| 4 | API response or response-validation failure |
| 5 | Network or timeout |

For an empty test store, `creem products list --json` returns this page shape (the server owns the pagination values):

```json
{"items":[],"pagination":{"currentPage":1,"totalPages":0,"totalRecords":0,"nextPage":0,"prevPage":0}}
```

Without credentials, the same command exits `3`, leaves stdout empty, and writes:

```json
{"error":{"type":"auth","message":"Not authenticated.","status":null,"traceId":null,"details":null,"cause":null,"suggestion":"Set CREEM_API_KEY or run creem login.","retryAfter":null}}
```

Archiving, deleting, refunding, updating, upgrading, pausing, immediate/default cancellation, deactivating licenses, freezing, debiting, reversing, and closing accounts require confirmation. Interactive confirmation identifies TEST or LIVE; non-TTY, JSON, and NDJSON require `--yes`. Scheduled cancellation does not prompt. Declining a confirmation exits `2` without calling the operation. Writes are never automatically retried, including those with an idempotency key; inspect ambiguous outcomes before retrying manually.

## Examples by resource

Replace IDs with resources from your test store. Write examples change test data; review their inputs first.

```sh
creem products create --name Free --description 'Free download' --price 0 --currency USD --billing-type onetime --json
creem checkouts create --product prod_123 --units 2 --customer-email person@example.com --json
creem customers create --email person@example.com --name Person --json
creem subscriptions list --all --json
creem discounts list --product prod_123 --status active --json
creem transactions get tran_123 --json
creem licenses instances lic_123 --json
creem stats summary --currency USD --json
creem moderation screen --prompt 'A sample prompt' --json
creem credits create --customer cust_123 --initial-balance '9007199254740993' --json
creem affiliates list --json
creem splits list --json
```

## Interactive browsing

Run `creem products`, `creem customers`, `creem subscriptions`, or `creem transactions` in a terminal to open the TUI. Browse with arrows or `j`/`k`, search with `/`, open details with Enter, and quit with `q`. Customer billing links and subscription actions remain available from the command bar. New resource operations are available as scriptable commands; use `--help` to discover them.

## Compatibility and scope

This release corrects `discounts list` to use SDK search and replaces transaction-derived `subscriptions list` with the authoritative subscription endpoint. The old subscription `note` field is removed. The confirmation policy is an intentional behavior change for scripts: add `--yes` after reviewing mutations. A minor Changeset marks these changes while the CLI is pre-1.0.

Parity follows the generated SDK, not dashboard-only capabilities. The current contract has 55 operations; the 11 metering operations remain outside the generated SDK and this release. Publishing this CLI requires publishing the stacked SDK changes first. npm and Homebrew distribution are separate release steps; this source branch does not publish either.

## Development

From the repository root:

```sh
pnpm --filter @creem_io/cli build
pnpm --filter @creem_io/cli typecheck
pnpm --filter @creem_io/cli lint
pnpm --filter @creem_io/cli test
pnpm --filter @creem_io/cli parity:check --strict
pnpm --filter @creem_io/cli test:packed
```

The manifest records operation, parameter, body schema, and command mappings. CI compares it against OpenAPI, generated SDK methods, executable handlers, Commander, and the shared docs reference. It rejects all drift and unfinished/excluded operations at this baseline. Update `src/operation-manifest.json` and typed handlers together, then run `node packages/cli/scripts/sync-reference.mjs`. `TEST_API_KEY` enables the optional read-only API smoke test. Tests never create remote resources.
