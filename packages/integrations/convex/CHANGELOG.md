# Changelog

## 0.5.0

### Minor Changes

- 3d8809c: Add billing email management. The Creem customer portal cannot change
  the email address invoices and receipts go to, so apps can now offer it
  themselves:
  - `creem.customers.billingEmail(ctx, { entityId })` reads the address from
    Creem and `creem.customers.updateBillingEmail(ctx, { entityId, email })`
    changes it. Both return `{ status: "ok", email }`, or
    `{ status: "no-customer" }` before the entity's first checkout. An update
    reads the customer back from Creem and stores that address on the Convex
    customer record, together with Creem's `updated_at`; a readback that is not
    newer than the stored one is ignored, so overlapping saves that finish out
    of order keep the newest address. The customer record gains an optional
    `emailUpdatedAt` field for this.
  - `creem.api({ resolve })` generates `customers.billingEmail` and
    `customers.updateBillingEmail` actions; export them as
    `customersBillingEmail` and `customersUpdateBillingEmail` and
    `connectCreemApi` wires them. Both take the `expectedEntityId` the caller
    displays and return `{ status: "entity-changed" }` without touching Creem
    when the resolver now picks another entity. `customersBillingEmailArgs` and
    `customersUpdateBillingEmailArgs` are exported for custom RBAC wrappers.
  - New `<BillingEmail>` widget for React and Svelte. `<BillingEmail />` renders
    a ready-made layout; for custom markup, compose `BillingEmail.Root` with
    `Title`, `Description`, `Label`, `Input`, `Save`, `Status`, `Error`, and
    `Retry`, which wire labels, descriptions, and errors to the input and
    support `unstyled`. It is hidden until the entity has a Creem customer and
    when the new `canManageBillingEmail` permission is `false`. It reloads
    instead of saving when the entity changed underneath it, offers a retry
    after a failed load, and its labels live under `billingEmail` in the i18n
    labels.

  The `creem` peer dependency now requires `^1.12.0`, the first SDK release
  whose customer update sends `email`.

- a3cc645: Scope subscriptions and orders to the billing entity, not just the
  Creem customer. Creem keeps one customer per store and email address, so a
  person who checks out for two billing entities (a personal account and an
  organization, say) maps both to the same customer, and each entity used to
  see, and could act on, the other's subscriptions and orders.
  - Subscriptions and orders get an indexed, write-once `entityId` owner, taken
    from the checkout's `convexBillingEntityId`. Verified webhooks can fill a
    missing owner even when they arrive out of order, but never change an
    existing one. Webhook side effects follow the stored row after the guarded
    write: its owner and customer decide the customer mapping, and its status
    decides whether app-owned plans end.
  - `listAllUserSubscriptions`, `listUserSubscriptions`,
    `getCurrentSubscription`, `listUserOrders`, the billing snapshot,
    `getBillingModel` and `uiModel` read the entity's rows through the new
    index. Subscription commands (`update`, `cancel`, `resume`, `pause`,
    `cancelScheduledUpdate`) reject a subscription ID that belongs to another
    entity, like an unknown ID, and period-end updates are checked again when
    they apply.
  - A new `customerEntityHistory` table keeps every entity ever mapped to a
    Creem customer. New component queries `listCustomerEntities` (at most 100
    entities, with a `truncated` flag) and `isCustomerShared`, and client method
    `creem.customers.isShared(ctx, { entityId })`; a customer counts as shared
    when another entity is or was mapped to it or owns one of its rows.
  - While the customer is shared, `customers.portalUrl` throws a `ConvexError`
    with `code: "shared-customer"` (`<BillingPortal>` and
    `<PaymentRecoveryButton>` show the new `portal.sharedCustomer` label), and
    `customers.updateBillingEmail` returns `{ status: "shared-customer" }`
    without changing anything (`<BillingEmail>` shows
    `billingEmail.sharedCustomer`).
  - Existing deployments: run the new `backfillBillingEntityTags` component
    mutation once after deploying, passing back its `cursor` until `isDone` (at
    most 25 rows per call; if a call fails on Convex's read limit because rows
    carry very large metadata, retry the same `cursor` with a smaller
    `batchSize`). It establishes recorded `convexBillingEntityId` claims before
    inferring owners of rows that record none. Until it has run, recorded claims
    still count, a claim naming another entity counts as sharing, untagged rows
    count only for a customer no other entity has touched, and only the first 50
    rows without an owner per table and customer are read (a customer with more
    counts as shared), so billing visibility and access can be incomplete until
    the backfill completes.
  - A checkout that references its subscription by ID gives a stored
    subscription without an owner the checkout's claim (new component mutation
    `claimSubscriptionOwner`). If that checkout arrives before any subscription
    webhook and the later subscription webhook records no
    `convexBillingEntityId`, the subscription keeps no owner.
  - `activateScheduledAppPlanAssignment` and `cancelScheduledAppPlanAssignment`
    now require `entityId` and change only that entity's assignment, and a
    queued cancellation for another entity's subscription is dropped like a
    foreign period-end update; lifecycle compensation restores only assignments
    and scheduled updates of the subscription's owner.
  - Transactions (`transactions.search`, `<BillingHistory>`) and Customer
    Credits stay scoped to the Creem customer.

## 0.4.1

### Patch Changes

- 3cf0b89: Include consistent MIT licensing, repository metadata, release
  documentation, and explicit workspace dependency references in published
  package artifacts, and make dual CommonJS/ESM type entrypoints resolve to
  their matching declaration format.
- Updated dependencies [3cf0b89]
  - creem@1.6.2

## 0.4.0

### Minor Changes

- 9bf9f20: This is a big feature release with breaking changes.

  Features:
  - i18n support for all billing UI text
  - Usage limits / feature gates (`usageLimits`) with scoped trial expiry and
    `eligibilityScopeId` in the catalog
  - Credits widgets for React and Svelte (`Credits*` components)
  - Billing history widget (`BillingHistory`)
  - Payment recovery primitives (`PaymentRecoveryBanner`,
    `PaymentRecoveryButton`)
  - Provider factories: `createCreemReact` / `createCreemSvelte` with
    `CreemConvexProvider`
  - Subscription widget slots (`SubscriptionGrid`, `SubscriptionGroup`,
    `SubscriptionGroupSelector`, `SubscriptionIntervalSelector`,
    `SubscriptionItem*` slot components, `SubscriptionUnitPicker`)
  - `cancelPendingScheduledSubscriptionUpdates` mutation; scheduled-update
    cancellation integrated into the subscription update flow
  - Product descriptions render markdown tables
  - Hosted docs at docs.creem.io/code/sdks/convex, including an agent-oriented
    Integration Guide with a brownfield migration checklist
  - Entity-scoped Customer Credits helpers for trusted app-owned grants and
    spending
  - Packed-package compatibility audit for the intentional ESM/bundler support
    contract
  - `PlanCatalogEntry.trialDays` declares the length of a Creem-managed trial,
    so the pricing card can offer it before checkout instead of a plain
    "Subscribe". Creem's product API does not expose trial configuration, so
    this mirrors the dashboard until config-as-code can drive both. New
    `BillingLabels.subscription` keys: `startFreeTrial` and `trialDaysFree`.
  - `connectCreemApi(api.billing)` builds the connected widget API from the
    generated exports
  - `@creem_io/convex/core` — a browser-safe, framework-neutral entry for
    catalog and snapshot helpers, so sharing a catalog between server and
    browser code no longer pulls the Creem Node SDK into your bundle
  - Every generated function declares a real Convex `returns` validator, so
    clients infer concrete result types instead of `any`
  - Shared `BillingContextValue` contract in `core/` — the integration-agnostic
    seam the widgets will consume
  - Subscription plan/group/cycle derivation extracted to
    `core/subscriptionModel.ts` and shared by the React and Svelte roots
  - `Subscription.Grid` honours the root's `columns` prop, so composed and
    default layouts agree
  - React and Svelte subscription widgets now share one plan-target resolver,
    update-command builder, and optimistic state projector, with lifecycle
    compensation that restores subscription, scheduled-update, and app-plan
    state together after failed Creem calls

  Fixes:
  - Expired subscriptions kept granting access indefinitely. Terminal statuses
    are now closed out, so access ends when the subscription does. `unpaid` and
    `paused` stay open so payment-recovery UI can still act on them
  - A lapsed trial stayed "active" until some unrelated write happened to re-run
    the query. Trial expiry is now driven by a scheduled mutation, so it reaches
    subscribed clients on time
  - A signed-in customer on the free tier was shown no current plan, and the
    free card offered "Get started" to someone already on it
  - When Creem issued a new customer ID for an entity (test/live switch,
    customer re-created), the stale mapping made every subscription and order
    lookup miss — a paying user saw nothing
  - `subscriptions.getCurrent` threw when a subscription referenced a product
    that had not been synced yet, taking down every query composed on top of it
  - Timestamps from Creem are normalized to UTC on write. Offset-form timestamps
    sorted incorrectly against UTC values, which could misclassify trial expiry
    and webhook staleness
  - Orders arriving without a customer ID were stored where no query could reach
    them; the webhook now fails loudly and Creem retries
  - Resuming a subscription Creem had already ended silently left the UI showing
    an active subscription that did not exist
  - A credit grant with a non-integer amount crashed the refund webhook,
    returning 5xx and putting Creem into a retry loop
  - Checkout buttons stayed enabled while a checkout was in flight, so a second
    click could open a second checkout session

  Upgrading from 0.3.x? Read the
  [migration guide](http://docs.creem.io/code/sdks/convex/migration#upgrading-from-0-3-x)
  — it covers every breaking change, including new required peer dependencies,
  removed primitives, and changed return shapes.

### Patch Changes

- c3be179: Bump creem SDK dependency to 1.6.0

## 0.3.2

### Patch Changes

- bb581ac: Bump creem SDK dependency to 1.5.3

## 0.3.1

### Patch Changes

- a979bc4: Bump creem SDK dependency to 1.5.1

## 0.3.0

Breaking changes

- Update convex-svelte package references to @mmailaender/convex-svelte

## 0.2.0

Features

- Tables in product descriptions

Fix

- Markdown rendering in product descriptions

## 0.1.0

- Initial npm release of this package.
- Convex component for Creem billing:
  - Webhook sync engine (customers, subscriptions, orders, products).
  - `creem.api({ resolve })` convenience exports for common billing flows.
  - Resource namespaces for direct API access (`creem.subscriptions.*`,
    `creem.checkouts.*`, `creem.products.*`, `creem.customers.*`,
    `creem.orders.*`).
- Billing UI helpers:
  - React widgets/primitives (`./react` export).
  - Svelte 5 widgets/primitives (`./svelte` export).
  - Shared styles export (`./styles`).
