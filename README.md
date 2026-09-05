<p align="center">
  <a href="https://creem.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="packages/docs/logo/dark.svg" width="120">
      <source media="(prefers-color-scheme: light)" srcset="packages/docs/logo/light.svg" width="120">
      <img alt="Creem" src="packages/docs/logo/light.svg" width="120">
    </picture>
  </a>
</p>

<h3 align="center">The Merchant of Record for modern software teams</h3>

<p align="center">
  Sell software globally. We handle taxes, compliance, payments, and payouts.
</p>

<p align="center">
  <a href="https://creem.io"><strong>Website</strong></a> ·
  <a href="https://docs.creem.io"><strong>Docs</strong></a> ·
  <a href="https://docs.creem.io/api-reference/introduction"><strong>API Reference</strong></a> ·
  <a href="https://discord.gg/q3GKZs92Av"><strong>Discord</strong></a> ·
  <a href="https://x.com/creem_io"><strong>Twitter</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/creem"><img src="https://img.shields.io/npm/v/creem?style=flat-square&color=FFBE98" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license"></a>
  <a href="https://discord.gg/q3GKZs92Av"><img src="https://img.shields.io/discord/1262843562140241952?style=flat-square&color=5865F2&label=discord" alt="Discord"></a>
</p>

## What is Creem?

Creem is a **Merchant of Record (MoR)** that lets software companies sell globally without worrying about sales tax, VAT, compliance, or payment infrastructure. We act as the legal seller of your software, so you can focus on building.

**What we handle for you:**

- 🌍 **Global tax compliance** across 140+ countries (US state taxes, EU VAT, UK VAT, and more)
- 💳 **Payment processing** with optimized checkout experiences
- 🔄 **Subscription management** with trials, upgrades, downgrades, and dunning
- 💸 **Automated payouts** to your bank account
- 📊 **Revenue analytics** and reporting
- 🛡️ **Fraud protection** and chargeback handling
- 🏪 **Storefronts** for no-code product pages
- 🤝 **Affiliate programs** with built-in tracking and payouts

This repository contains Creem's maintained public SDK, CLI, integrations, UI
packages, webhook types, examples, and documentation.

## Packages

### SDK and developer tools

| Package                                               | Description                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`creem`](./packages/sdk)                             | Official generated TypeScript SDK with full API coverage and an MCP server.                              |
| [`@creem_io/cli`](./packages/cli)                     | Command-line access to Creem products, customers, subscriptions, checkouts, transactions, and discounts. |
| [`@creem_io/webhook-types`](./packages/webhook-types) | Shared webhook entity/event types, type guards, and parsing utilities.                                   |

### Integrations

| Package                                                        | Description                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`@creem_io/better-auth`](./packages/integrations/better-auth) | Better Auth plugin for customers, subscriptions, and webhooks.                 |
| [`@creem_io/convex`](./packages/integrations/convex)           | Convex billing component with backend helpers and React/Svelte bindings.       |
| [`@creem_io/nextjs`](./packages/integrations/nextjs)           | Next.js checkout, customer portal, and webhook helpers.                        |
| [`@creem_io/strapi`](./packages/integrations/strapi)           | Strapi 5 plugin for products, subscriptions, checkout, and webhook forwarding. |

### Checkout UI

| Package                                    | Description                                             |
| ------------------------------------------ | ------------------------------------------------------- |
| [`@creem_io/embed`](./packages/ui/embed)   | Framework-agnostic modal and inline checkout embedding. |
| [`@creem_io/react`](./packages/ui/react)   | React components and hooks for embedded checkout.       |
| [`@creem_io/svelte`](./packages/ui/svelte) | Svelte components and actions for embedded checkout.    |
| [`@creem_io/vue`](./packages/ui/vue)       | Vue 3 components and composables for embedded checkout. |

Package documentation and installation instructions live in each linked package
directory. The complete product and API documentation is at
[docs.creem.io](https://docs.creem.io).

## Quick start

Install the recommended TypeScript SDK:

```bash
npm install creem
```

Create a checkout:

```ts
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY,
});

const checkout = await creem.checkouts.create({
  productId: "prod_123",
  successUrl: "https://yourapp.com/success",
});

console.log(checkout.checkoutUrl);
```

See the [SDK README](./packages/sdk/README.md) for resources, standalone
functions, retries, error handling, and MCP setup. Framework users can start
from the relevant integration or UI package above.

## Repository structure

```text
packages/
├── sdk/                       # creem; generated SDK + MCP binary
├── cli/                       # public CLI
├── core/                      # future shared primitive
├── webhook-types/             # temporary until absorbed into core
├── integrations/
│   ├── better-auth/
│   ├── convex/
│   ├── nextjs/
│   ├── strapi/
│   └── framer/                # Framer plugin
├── ui/
│   ├── embed/
│   ├── react/
│   ├── svelte/
│   └── vue/
├── docs/                      # documentation application
├── examples/                  # standalone, workspace-excluded examples
├── templates/                 # future cloneable templates
└── creem-io/                  # frozen deprecated exception
```

### Distribution

Creem publishes and deploys artifacts from this repository to the following
destinations:

| Source | Artifact destination |
| --- | --- |
| `packages/sdk`, `packages/cli`, `packages/webhook-types` | Public npm packages |
| `packages/integrations/{better-auth,convex,nextjs,strapi}` | Public npm packages |
| `packages/ui/*` | Public npm packages |
| `packages/integrations/framer` | Framer Marketplace plugin |
| `packages/docs` | `docs.creem.io`, deployed through the Mintlify GitHub App |
| `packages/examples/*` | Standalone examples deployed by their users, where applicable |
| `packages/templates/*` | Future cloneable source templates; no release target yet |
| `packages/creem-io` | Frozen deprecated npm package |

Each package README owns its exact build and delivery procedure. The root
[`package-policy.json`](./package-policy.json) classifies packages for repository
governance checks; it is not deployment configuration.

The README-only `packages/creem-sdk`, `packages/better-auth`, and
`packages/nextjs` directories temporarily guide old repository backlinks to
their new locations. Their review/removal is scheduled in
[OSS-51](https://linear.app/creem/issue/OSS-51/review-temporary-package-path-landing-pages).

Filesystem paths and npm identities are deliberately independent. Moving a
package into a category does not rename its published npm package.

## Deprecated SDK

[`creem_io`](./packages/creem-io) is frozen, excluded from normal CI and
Changesets, and unsupported, including for security fixes. Do not use it for new
projects. Migrate to the maintained [`creem`](./packages/sdk) package.

## Development

### Prerequisites

- Node.js 24 or newer
- pnpm 11 (use the exact version declared in `package.json`)

### Setup and checks

```bash
git clone https://github.com/armitage-labs/creem.git
cd creem
pnpm install --frozen-lockfile

pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Filter to a package for local iteration:

```bash
pnpm --filter @creem_io/nextjs build
pnpm --filter @creem_io/nextjs typecheck
pnpm --filter @creem_io/nextjs test
```

The root CI workflow validates package policy, built tarball contents and entrypoints, build,
typechecking, tests, lint, formatting, workflow paths, and plugin discovery.
Changesets creates release pull requests and publishes eligible public packages
with npm provenance after repository policy passes.

The `creem` SDK is generated from `packages/sdk/openapi.json` with Speakeasy.
Do not hand-edit generated SDK source; see the
[contributing guide](./CONTRIBUTING.md#generated-sdk).

## Contributing and community

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. By
participating, you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

- [GitHub issue forms](https://github.com/armitage-labs/creem/issues/new/choose)
  for reproducible package bugs and documentation problems
- [Discord](https://discord.gg/q3GKZs92Av) for community discussion
- [Featurebase](https://creem.featurebase.app) for product feature requests
- [SECURITY.md](./SECURITY.md) for private vulnerability reporting

## License

This repository and its actively maintained public packages are licensed under
the [MIT License](./LICENSE). The frozen deprecated SDK retains its historical
license file.

---

<p align="center">
  <a href="https://creem.io">
    <img alt="Creem" src="packages/docs/peach-icon.svg" width="40">
  </a>
  <br>
  <sub>Built with 🍑 by the Creem team</sub>
</p>
