<p align="center">
  <a href="https://creem.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="packages/docs/logo/dark.svg" width="120">
      <source media="(prefers-color-scheme: light)" srcset="packages/docs/logo/light.svg" width="120">
      <img alt="CREEM" src="packages/docs/logo/light.svg" width="120">
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
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://discord.gg/q3GKZs92Av"><img src="https://img.shields.io/discord/1262843562140241952?style=flat-square&color=5865F2&label=discord" alt="Discord"></a>
</p>

---

## What is CREEM?

CREEM is a **Merchant of Record (MoR)** that lets software companies sell globally without worrying about sales tax, VAT, compliance, or payment infrastructure. We act as the legal seller of your software, so you can focus on building.

**What we handle for you:**

- 🌍 **Global tax compliance** across 140+ countries (US state taxes, EU VAT, UK VAT, and more)
- 💳 **Payment processing** with optimized checkout experiences
- 🔄 **Subscription management** with trials, upgrades, downgrades, and dunning
- 💸 **Automated payouts** to your bank account
- 📊 **Revenue analytics** and reporting
- 🛡️ **Fraud protection** and chargeback handling
- 🏪 **Storefronts** for no-code product pages
- 🤝 **Affiliate programs** with built-in tracking and payouts

## Repository Structure

This is a **pnpm monorepo** containing all of CREEM's open-source packages, SDKs, and documentation.

```
creem/
├── packages/
│   ├── creem-sdk/        # Official TypeScript SDK (auto-generated via Speakeasy)
│   ├── creem-io/         # Lightweight TypeScript wrapper (framework-agnostic)
│   ├── nextjs/           # Next.js integration (@creem_io/nextjs)
│   ├── better-auth/      # Better Auth plugin (@creem_io/better-auth)
│   ├── convex/           # Convex integration (@creem_io/convex)
│   ├── webhook-types/    # Shared webhook type definitions
│   └── docs/             # Documentation site (Mintlify)
├── .github/workflows/    # CI, release, and SDK generation pipelines
├── turbo.json            # Turborepo build configuration
└── pnpm-workspace.yaml   # Workspace package definitions
```

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`creem`](./packages/creem-sdk) | [![npm](https://img.shields.io/npm/v/creem?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/creem) | Official TypeScript SDK with full API coverage, MCP server, and standalone functions |
| [`creem_io`](./packages/creem-io) | [![npm](https://img.shields.io/npm/v/creem_io?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/creem_io) | Lightweight wrapper SDK, framework-agnostic, zero dependencies |
| [`@creem_io/nextjs`](./packages/nextjs) | [![npm](https://img.shields.io/npm/v/@creem_io/nextjs?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/@creem_io/nextjs) | Next.js integration with React components and webhook handlers |
| [`@creem_io/better-auth`](./packages/better-auth) | [![npm](https://img.shields.io/npm/v/@creem_io/better-auth?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/@creem_io/better-auth) | Better Auth plugin for payments and subscription management |
| [`@creem_io/convex`](./packages/convex) | [![npm](https://img.shields.io/npm/v/@creem_io/convex?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/@creem_io/convex) | Convex billing component with backend helpers and React/Svelte widgets |
| [`@creem_io/webhook-types`](./packages/webhook-types) | [![npm](https://img.shields.io/npm/v/@creem_io/webhook-types?style=flat-square&color=FFBE98)](https://www.npmjs.com/package/@creem_io/webhook-types) | Shared TypeScript types for webhook events |

## Quick Start

### 1. Install

```bash
# Official SDK (recommended for most use cases)
npm install creem

# Or the lightweight wrapper
npm install creem_io

# Next.js integration
npm install @creem_io/nextjs

# Better Auth plugin
npm install @creem_io/better-auth

# Convex integration
npm install @creem_io/convex
```

### 2. Create a Checkout

```typescript
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY,
});

const checkout = await creem.checkouts.create({
  productId: "prod_123",
  successUrl: "https://yourapp.com/success",
});

// Redirect your customer to checkout.checkoutUrl
```

### 3. Handle Webhooks

```typescript
import { Creem } from "creem_io";

const creem = new Creem({ apiKey: process.env.CREEM_API_KEY });

// Verify and parse webhook payload
const event = creem.webhooks.verify(rawBody, signature, webhookSecret);

switch (event.eventType) {
  case "checkout.completed":
    // Provision access
    break;
  case "subscription.canceled":
    // Revoke access
    break;
}
```

### Next.js Example

```typescript
// app/api/checkout/route.ts
import { createCheckout } from "@creem_io/nextjs/server";

export async function POST() {
  const checkout = await createCheckout({
    productId: "prod_123",
    successUrl: "/success",
  });
  return Response.redirect(checkout.checkoutUrl);
}
```

```typescript
// app/api/webhook/creem/route.ts
import { handleWebhook } from "@creem_io/nextjs/server";

export const POST = handleWebhook({
  onCheckoutCompleted: async (event) => {
    // Provision access for the customer
  },
  onSubscriptionCanceled: async (event) => {
    // Revoke access
  },
});
```

## Documentation

The full documentation lives in [`packages/docs`](./packages/docs) and is deployed at **[docs.creem.io](https://docs.creem.io)**.

Built with [Mintlify](https://mintlify.com), it covers:

- **Getting Started** guides for new merchants
- **API Reference** with interactive examples
- **SDK guides** for every package in this repo
- **Webhook events** and payload schemas
- **MoR explainers** on tax compliance and payouts

### Running Docs Locally

```bash
# Install Mintlify CLI
npm i -g mintlify

# Start local dev server
cd packages/docs
mintlify dev
```

### AI-Friendly Docs

CREEM provides [`llms.txt`](https://docs.creem.io/llms.txt) and [`llms-full.txt`](https://docs.creem.io/llms-full.txt) for AI agents and LLMs to consume structured documentation. We also ship [Skill Files](https://docs.creem.io/ai/for-agents/skill-files) for agent frameworks that support them.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+

### Setup

```bash
# Clone the repo
git clone https://github.com/armitage-labs/creem.git
cd creem

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Monorepo Commands

This repo uses [Turborepo](https://turbo.build/) for orchestrating builds across packages.

```bash
# Build everything
pnpm build

# Build a specific package
pnpm turbo build --filter=creem

# Run tests for a specific package
pnpm turbo test --filter=@creem_io/better-auth

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
# Create a changeset after making changes
pnpm changeset

# Version packages (CI does this automatically)
pnpm version-packages

# Publish (CI does this automatically)
pnpm release
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Your Application                │
├──────────┬──────────┬──────────┬────────────────┤
│  creem   │ creem_io │  nextjs  │  better-auth   │
│  (SDK)   │(wrapper) │  (React) │   (plugin)     │
├──────────┴──────────┴──────────┴────────────────┤
│              @creem_io/webhook-types              │
├──────────────────────────────────────────────────┤
│                 CREEM API (v1)                    │
│           https://api.creem.io/v1                 │
└──────────────────────────────────────────────────┘
```

- **`creem` (SDK):** Auto-generated from the OpenAPI spec via [Speakeasy](https://www.speakeasy.com/). Full API coverage, retry logic, MCP server support. This is the recommended SDK for most use cases.
- **`creem_io` (wrapper):** Hand-written lightweight SDK with zero dependencies. Framework-agnostic, works anywhere Node.js runs. Ideal for minimal setups or when you want full control.
- **`@creem_io/nextjs`:** React components and server utilities built specifically for Next.js App Router. Drop-in checkout buttons, webhook route handlers, and subscription access helpers.
- **`@creem_io/better-auth`:** Plugin for the [Better Auth](https://www.better-auth.com/) framework. Syncs CREEM customers with your auth users, manages subscriptions in your database, and handles webhooks automatically.
- **`@creem_io/webhook-types`:** Shared TypeScript type definitions for all CREEM webhook events. Used internally by other packages.

## CI/CD

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **CI** | Push/PR to `main` | Builds, typechecks, tests, and lints changed packages |
| **Release** | Push to `main` | Creates release PRs via Changesets, publishes to npm |
| **SDK Generation** | Daily / manual | Regenerates the `creem` SDK from the latest OpenAPI spec |
| **Docs Deploy** | Changes to `packages/docs` | Deploys documentation to [docs.creem.io](https://docs.creem.io) via Mintlify |

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature or fix
   ```bash
   git checkout -b feat/my-feature
   ```
3. **Make your changes** and add tests where appropriate
4. **Create a changeset** if your change affects a published package
   ```bash
   pnpm changeset
   ```
5. **Run checks** to make sure everything passes
   ```bash
   pnpm build && pnpm test && pnpm typecheck
   ```
6. **Open a Pull Request** against `main`

### Contribution Guidelines

- Follow the existing code style (Prettier is configured)
- Write tests for new functionality
- Keep PRs focused on a single change
- Update documentation for user-facing changes
- Use [conventional commits](https://www.conventionalcommits.org/) for commit messages

### Package-Specific Notes

- **`creem` (SDK):** This package is auto-generated. Don't edit files in `src/` directly. Instead, update the OpenAPI spec or Speakeasy configuration.
- **`packages/docs`:** Documentation uses Mintlify MDX format. API reference pages are generated from `openapi.json`. See the [docs README](./packages/docs/README.md) for details.
- **`creem_io`:** When adding new API resources, follow the existing pattern in `resources/` and add corresponding types in `types/`.

## Community

- 💬 [Discord](https://discord.gg/q3GKZs92Av) for questions and discussion
- 🐛 [GitHub Issues](https://github.com/armitage-labs/creem/issues) for bug reports
- 💡 [Feature Requests](https://creem.featurebase.app) on Featurebase
- 🐦 [Twitter/X](https://x.com/creem_io) for updates

## License

This project is licensed under the [MIT License](./LICENSE).

---

<p align="center">
  <a href="https://creem.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="packages/docs/peach-icon.svg" width="40">
      <source media="(prefers-color-scheme: light)" srcset="packages/docs/peach-icon.svg" width="40">
      <img alt="CREEM" src="packages/docs/peach-icon.svg" width="40">
    </picture>
  </a>
  <br>
  <sub>Built with 🍑 by the CREEM team</sub>
</p>
