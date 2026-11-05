# Migrating to `creem` 2.0

`creem` 2.0 changes how every method takes its arguments. The HTTP API is the
same: requests and responses don't change, only the TypeScript signatures do.

## What changed

Each method now takes **one request object**, then the optional
`RequestOptions` as before. The path, query and header parameters are
properties of that object, and so is the request body, under the name it
already had in the types (for example `updateProductRequestEntity`).

```ts
// 1.x
await creem.products.update("prod_123", { name: "Pro" }, { retries });

// 2.0
await creem.products.update(
  { id: "prod_123", updateProductRequestEntity: { name: "Pro" } },
  { retries },
);
```

A method whose parameters are all optional still takes the object, so a call
without arguments becomes `({})`:

```ts
// 1.x
await creem.products.search();
await creem.transactions.search(undefined, undefined, undefined, 2, 50);

// 2.0
await creem.products.search({});
await creem.transactions.search({ pageNumber: 2, pageSize: 50 });
```

## Why

In 1.x every parameter was positional, and `options` came last. When the API
gained a new optional parameter, it was inserted before `options`, so existing
calls that passed `options` stopped compiling in TypeScript, and in JavaScript
the options object was sent as the new parameter. With one request object, a new parameter of an operation that already has
one is a new optional property: no existing call changes (see
[Methods that take only a body](#methods-that-take-only-a-body) for the rest). The parameters planned
for products and subscriptions (`dry_run`, `If-None-Match`, `If-Match`, new
search filters) therefore arrive in minor releases of 2.x.

## Every changed method

| 1.x | 2.0 |
| --- | --- |
| `creem.affiliates.list(pageNumber, pageSize)` | `creem.affiliates.list({ pageNumber, pageSize })` |
| `creem.affiliates.listCommissions(id, status, pageNumber, pageSize)` | `creem.affiliates.listCommissions({ id, status, pageNumber, pageSize })` |
| `creem.affiliates.listInvites(pageNumber, pageSize)` | `creem.affiliates.listInvites({ pageNumber, pageSize })` |
| `creem.affiliates.retrieve(id)` | `creem.affiliates.retrieve({ id })` |
| `creem.checkouts.retrieve(checkoutId)` | `creem.checkouts.retrieve({ checkoutId })` |
| `creem.customerCredits.closeAccount(id)` | `creem.customerCredits.closeAccount({ id })` |
| `creem.customerCredits.creditAccount(id, creditDebitRequestDto)` | `creem.customerCredits.creditAccount({ id, creditDebitRequestDto })` |
| `creem.customerCredits.debitAccount(id, creditDebitRequestDto)` | `creem.customerCredits.debitAccount({ id, creditDebitRequestDto })` |
| `creem.customerCredits.freezeAccount(id)` | `creem.customerCredits.freezeAccount({ id })` |
| `creem.customerCredits.getAccount(id)` | `creem.customerCredits.getAccount({ id })` |
| `creem.customerCredits.getAccountBalance(id, at)` | `creem.customerCredits.getAccountBalance({ id, at })` |
| `creem.customerCredits.getTransaction(id)` | `creem.customerCredits.getTransaction({ id })` |
| `creem.customerCredits.listAccounts(limit, customerId, startingAfter, endingBefore)` | `creem.customerCredits.listAccounts({ limit, customerId, startingAfter, endingBefore })` |
| `creem.customerCredits.listEntries(id, limit, startingAfter, endingBefore)` | `creem.customerCredits.listEntries({ id, limit, startingAfter, endingBefore })` |
| `creem.customerCredits.listTransactionsByReference(reference)` | `creem.customerCredits.listTransactionsByReference({ reference })` |
| `creem.customerCredits.reverseTransaction(id, reverseTransactionRequestDto)` | `creem.customerCredits.reverseTransaction({ id, reverseTransactionRequestDto })` |
| `creem.customerCredits.reverseTransactionById(id)` | `creem.customerCredits.reverseTransactionById({ id })` |
| `creem.customerCredits.unfreezeAccount(id)` | `creem.customerCredits.unfreezeAccount({ id })` |
| `creem.customers.getOrders(id, pageNumber, pageSize)` | `creem.customers.getOrders({ id, pageNumber, pageSize })` |
| `creem.customers.list(pageNumber, pageSize)` | `creem.customers.list({ pageNumber, pageSize })` |
| `creem.customers.listLicenses(id, pageNumber, pageSize)` | `creem.customers.listLicenses({ id, pageNumber, pageSize })` |
| `creem.customers.listSubscriptions(id, pageNumber, pageSize)` | `creem.customers.listSubscriptions({ id, pageNumber, pageSize })` |
| `creem.customers.retrieve(customerId, email)` | `creem.customers.retrieve({ customerId, email })` |
| `creem.discounts.delete(id)` | `creem.discounts.delete({ id })` |
| `creem.discounts.get(discountId, discountCode)` | `creem.discounts.get({ discountId, discountCode })` |
| `creem.discounts.search(pageNumber, pageSize, productId, status, type, createdAfter, createdBefore)` | `creem.discounts.search({ pageNumber, pageSize, productId, status, type, createdAfter, createdBefore })` |
| `creem.events.listEvents(meterId, customerId, reference, limit, startingAfter)` | `creem.events.listEvents({ meterId, customerId, reference, limit, startingAfter })` |
| `creem.licenses.listInstances(id, pageNumber, pageSize)` | `creem.licenses.listInstances({ id, pageNumber, pageSize })` |
| `creem.meters.archiveMeter(id)` | `creem.meters.archiveMeter({ id })` |
| `creem.meters.getConsumedUnits(id, customerId, at)` | `creem.meters.getConsumedUnits({ id, customerId, at })` |
| `creem.meters.getMeter(id)` | `creem.meters.getMeter({ id })` |
| `creem.meters.listMeters(limit, startingAfter, endingBefore, includeArchived)` | `creem.meters.listMeters({ limit, startingAfter, endingBefore, includeArchived })` |
| `creem.meters.previewExistingMeter(id)` | `creem.meters.previewExistingMeter({ id })` |
| `creem.meters.unarchiveMeter(id)` | `creem.meters.unarchiveMeter({ id })` |
| `creem.meters.updateMeter(id, updateMeterApiRequestDto)` | `creem.meters.updateMeter({ id, updateMeterApiRequestDto })` |
| `creem.products.archive(id)` | `creem.products.archive({ id })` |
| `creem.products.create(createProductRequestEntity, idempotencyKey)` | `creem.products.create({ createProductRequestEntity, idempotencyKey })` |
| `creem.products.get(id)` | `creem.products.get({ id })` |
| `creem.products.search(pageNumber, pageSize, status)` | `creem.products.search({ pageNumber, pageSize, status })` |
| `creem.products.update(id, updateProductRequestEntity)` | `creem.products.update({ id, updateProductRequestEntity })` |
| `creem.splits.delete(id)` | `creem.splits.delete({ id })` |
| `creem.splits.list(pageNumber, pageSize)` | `creem.splits.list({ pageNumber, pageSize })` |
| `creem.splits.retrieve(id)` | `creem.splits.retrieve({ id })` |
| `creem.stats.getSummary(currency, startDate, endDate, interval)` | `creem.stats.getSummary({ currency, startDate, endDate, interval })` |
| `creem.subscriptions.cancel(id, cancelSubscriptionRequestEntity)` | `creem.subscriptions.cancel({ id, cancelSubscriptionRequestEntity })` |
| `creem.subscriptions.get(subscriptionId)` | `creem.subscriptions.get({ subscriptionId })` |
| `creem.subscriptions.pause(id)` | `creem.subscriptions.pause({ id })` |
| `creem.subscriptions.resume(id)` | `creem.subscriptions.resume({ id })` |
| `creem.subscriptions.search(pageNumber, pageSize)` | `creem.subscriptions.search({ pageNumber, pageSize })` |
| `creem.subscriptions.update(id, updateSubscriptionRequestEntity)` | `creem.subscriptions.update({ id, updateSubscriptionRequestEntity })` |
| `creem.subscriptions.upgrade(id, upgradeSubscriptionRequestEntity)` | `creem.subscriptions.upgrade({ id, upgradeSubscriptionRequestEntity })` |
| `creem.transactions.getById(transactionId)` | `creem.transactions.getById({ transactionId })` |
| `creem.transactions.search(customerId, orderId, productId, pageNumber, pageSize)` | `creem.transactions.search({ customerId, orderId, productId, pageNumber, pageSize })` |
| `creem.webhooks.acknowledgeEvent(id, eventId, acknowledgeWebhookEventRequestEntity)` | `creem.webhooks.acknowledgeEvent({ id, eventId, acknowledgeWebhookEventRequestEntity })` |
| `creem.webhooks.delete(id)` | `creem.webhooks.delete({ id })` |
| `creem.webhooks.get(id)` | `creem.webhooks.get({ id })` |
| `creem.webhooks.getSecret(id)` | `creem.webhooks.getSecret({ id })` |
| `creem.webhooks.list(pageNumber, pageSize)` | `creem.webhooks.list({ pageNumber, pageSize })` |
| `creem.webhooks.listPendingEvents(id, limit)` | `creem.webhooks.listPendingEvents({ id, limit })` |
| `creem.webhooks.update(id, updateWebhookRequestEntity)` | `creem.webhooks.update({ id, updateWebhookRequestEntity })` |

These methods already took a single request body and are unchanged:

- `creem.affiliates.createInvite(request)`
- `creem.checkouts.create(request)`
- `creem.customerCredits.createAccount(request)`
- `creem.customerCredits.postTransaction(request)`
- `creem.customers.create(request)`
- `creem.customers.generateBillingLinks(request)`
- `creem.customers.update(request)`
- `creem.discounts.create(request)`
- `creem.events.ingestEvents(request)`
- `creem.events.previewEvents(request)`
- `creem.licenses.activate(request)`
- `creem.licenses.deactivate(request)`
- `creem.licenses.validate(request)`
- `creem.meters.createMeter(request)`
- `creem.meters.previewMeter(request)`
- `creem.moderation.screenPrompt(request)`
- `creem.splits.create(request)`
- `creem.transactions.refund(request)`
- `creem.webhooks.create(request)`

## Response enums are open

Enum values in responses (a product's `status`, a ledger entry's `side`, …)
are now open: a value the API adds later comes through as a plain string
instead of failing the whole response. The known values keep their literal
types, so existing comparisons still work. A `switch` that covers every known
value needs a `default` branch, because the type now also allows other
strings:

```ts
switch (product.status) {
  case "active":
    break;
  case "archived":
    break;
  default:
    // a status this SDK version doesn't know yet
}
```

The same holds for webhook payloads parsed with `parseWebhookEventEntity` or
`constructWebhookEventEntity`, including a subscription's `collectionMethod`
and a refund's `reason`. An event type this version doesn't know no longer
throws. It comes back as the unknown variant, with `eventType: "UNKNOWN"` and
the payload as sent in `raw`:

```ts
const event = await constructWebhookEventEntity(body, headers, secret);
if (event.eventType === "UNKNOWN") {
  // an event type added after this SDK version; the payload is in event.raw
  return;
}
```

So a new value in a response or a webhook, or a new webhook event type, is a
minor release from 2.0 on. Values you send are unchanged for TypeScript: an
open type accepts the known values, and anything else needs a cast. Without
TypeScript, an unknown value in a request is no longer refused by the SDK, and
the API answers it with a `400`.

## MCP server and CLI

The bundled MCP server's tools now take the request under one `request`
argument, in the API's wire field names, the same as each tool's input schema
lists them. For example, `products-update` takes
`{ "request": { "id": "prod_123", "UpdateProductRequestEntity": { "name": "Pro" } } }`.
The `creem` CLI's commands and flags don't change. `subscriptions list --status`
accepts any status, and a billing type the CLI doesn't know is shown as it is.

## Methods that take only a body

The 19 methods listed above take the request body itself, because their
operations have no other parameter. If one of those operations gains its first
query or header parameter, the generator wraps its body in a request object
(like `updateProductRequestEntity` above), which changes the call. Adding a
parameter to an operation that already has one is a new optional property and
doesn't.
