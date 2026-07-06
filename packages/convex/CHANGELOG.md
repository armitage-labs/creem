# Changelog

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
