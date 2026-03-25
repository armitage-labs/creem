# Creem Docs - Claude Code Context

This is the documentation site for **Creem**, a Merchant of Record (MoR) platform for SaaS and digital businesses. The docs live at [docs.creem.io](https://docs.creem.io).

## Project Structure

```
creem-docs/
├── docs.json                     # Mintlify configuration (navigation, theme, SEO)
├── package.json                  # Scripts (formatting, API doc generation)
├── styles.css                    # Custom Mintlify CSS overrides
├── llms.txt                      # LLM-friendly summary of Creem
├── getting-started/              # Onboarding: intro, quickstart, test mode, migration
├── api-reference/                # API docs (auto-generated from OpenAPI spec)
│   ├── openapi.json              # OpenAPI 3.0 spec (source of truth for API Reference tab)
│   ├── introduction.mdx          # API introduction page
│   ├── error-codes.mdx           # Error code reference
│   └── endpoint/                 # Auto-generated endpoint MDX files
├── features/                     # Product feature docs (checkout, subscriptions, splits, etc.)
├── guides/                       # Step-by-step tutorials
├── code/                         # Developer tools (SDKs, CLI, webhooks, community)
├── ai/                           # AI integration docs (for humans + for agents)
├── merchant-of-record/           # MoR educational content (countries, finance, reviews)
├── integrations/                 # Third-party integration guides
├── for-customers/                # End-customer FAQs (charges, cancellations, payments)
├── skills/                       # AI agent skill files (Claude Code plugin)
├── scripts/                      # Build tools (generate-api-docs.js)
├── images/                       # Documentation images and assets
└── logo/                         # Brand logo variants (light/dark SVGs)
```

## Tech Stack

- **Framework**: [Mintlify](https://mintlify.com) — hosted documentation platform
- **Content**: MDX (Markdown + JSX) files
- **API Docs**: Auto-generated from OpenAPI 3.0 spec via custom Node.js script
- **Formatting**: Prettier (JSON, MD, MDX)
- **Git Hooks**: Husky (pre-commit formatting)
- **Deployment**: Automatic via Mintlify GitHub App on push to `main`

---

## Agent Execution Rules

> These rules must be strictly enforced at all times.

1. **Do not ignore or skip instructions.** Every rule must be followed.
2. **Do not hallucinate.** Only generate content backed by this context and actual Creem product knowledge.
3. **Validate every output** against these rules before finalizing.
4. **Use only approved patterns, conventions, and structures.**
5. If a rule conflicts with a general best practice, **prioritize the custom rule** defined here.
6. Be **predictable, repeatable, and rule-compliant** — not creative with structure.

---

## Development Commands

```bash
# Preview docs locally
mintlify dev

# Format all content files
npm run format

# Check formatting without changes
npm run format:check

# Generate API reference MDX from local openapi.json
npm run generate:api

# Generate from remote API, update local spec, and clean orphans
npm run generate:api:remote -- https://api.creem.io/open-api/json

# Preview API doc generation without writing files
npm run generate:api:dry-run

# Delete orphaned endpoint MDX files
npm run generate:api:cleanup
```

---

## Mintlify Configuration

The `docs.json` file is the primary configuration. It controls:

- **Navigation**: Three tabs — Documentation, Guides, API Reference
- **Theme**: Mint theme with Peach (#FFBE98) primary and Lavender (#B09CFB) dark accent
- **SEO**: Open Graph, Twitter cards, keywords
- **Analytics**: PostHog integration
- **Contextual menu**: copy, view, ChatGPT, Claude, Perplexity
- **Footer**: X (@creem_io), LinkedIn socials
- **Navbar**: Support link, llms.txt, llms-full.txt, Creem homepage button

### Navigation Structure

| Tab | Groups |
|-----|--------|
| **Documentation** | Get Started, AI, Features, Code, Integrations, Community, Merchant of Record, For Customers |
| **Guides** | Step-by-step tutorials (create product, create checkout, FAQ) |
| **API Reference** | Introduction, Error Codes, Checkout, Product, Customer, Transactions, License, Discount Code, Subscription |

### Adding a New Page

1. Create the `.mdx` file in the appropriate directory
2. Add the page path to `docs.json` under the correct group in `navigation.tabs`
3. Pages are referenced by their file path without extension (e.g., `features/discounts` for `features/discounts.mdx`)

### Page Frontmatter

Every MDX page needs frontmatter:

```yaml
---
title: 'Page Title'
description: 'Brief description of the page content.'
icon: 'icon-name'  # Optional — Font Awesome icon name
---
```

---

## API Reference Documentation

### Source of Truth

The OpenAPI 3.0 spec lives at `api-reference/openapi.json`. This is the single source of truth for all API endpoint documentation.

### How API Docs Are Generated

The `scripts/generate-api-docs.js` script:
1. Reads the OpenAPI spec (local file or remote URL)
2. Generates/updates MDX files in `api-reference/endpoint/`
3. Only touches frontmatter (title, description, openapi reference)
4. **Preserves any custom content** you add below the frontmatter

### Generated Endpoint MDX Format

```yaml
---
title: 'Creates a new product'
description: 'Create a new product for one-time payments or subscriptions.'
openapi: post /v1/products
---

## Custom Content Here

Any content below the frontmatter is preserved across regenerations.
```

### Filename Overrides

The script has a `FILENAME_OVERRIDES` map for custom filenames. If an operationId doesn't produce a good filename, add an override in `scripts/generate-api-docs.js`.

### Updating API Docs After Backend Changes

When the backend API changes:

1. Deploy or run the backend locally to expose the updated OpenAPI spec
2. Run: `npm run generate:api:remote -- https://api.creem.io/open-api/json` (or sandbox URL)
3. Review the generated changes
4. Add the new endpoint page path to `docs.json` navigation if it's a new endpoint
5. Commit both the updated `openapi.json` and any new/changed MDX files

---

## Creem Business Context

Understanding the business is essential for writing accurate documentation.

### What Creem Does

Creem is a **Merchant of Record (MoR)** — the legal entity that sells digital products on behalf of merchants. This means:
- Creem handles payment processing, tax collection, compliance, and chargebacks
- Merchants integrate via API and receive payouts
- End-customers see "Creem" (or white-labeled) as the seller on their receipts

### Core Product Areas

| Area | Description |
|------|-------------|
| **Payments** | One-time and recurring payments via checkout sessions |
| **Subscriptions** | Full lifecycle — create, upgrade, pause, resume, cancel |
| **Tax Compliance** | Automatic VAT/GST collection for 190+ countries |
| **License Keys** | Software licensing with activation, validation, deactivation |
| **Revenue Splits** | Programmable payment splitting between multiple recipients |
| **Affiliates** | Built-in affiliate/referral program infrastructure |
| **Discounts** | Coupon codes with percentage or fixed-amount discounts |
| **Customer Portal** | Self-service portal for subscription and billing management |
| **Storefronts** | Hosted product pages for merchants |
| **Webhooks** | Event notifications for all payment lifecycle events |

### Target Audience

The documentation serves:
- **Developers** integrating Creem via API or SDKs
- **Solopreneurs / Indie hackers** selling digital products
- **AI tool creators** needing fast payment integration
- **SaaS founders** managing subscriptions
- **End customers** with billing questions

---

## Creem API Overview

This context helps when writing or editing API-related documentation.

### Authentication

- **Method**: API key in `x-api-key` header
- **Environments**: Production (`https://api.creem.io`) and Sandbox (`https://test-api.creem.io`)
- **Key format**: `creem_xxxxx` (production) or `creem_test_xxxxx` (sandbox)

### API Scopes (Granular Permissions)

API keys can have granular scopes following `resource:action` pattern:

| Resource | Read | Write |
|----------|------|-------|
| checkouts | checkouts:read | checkouts:write |
| products | products:read | products:write |
| customers | customers:read | customers:write |
| subscriptions | subscriptions:read | subscriptions:write |
| transactions | transactions:read | — |
| licenses | licenses:read | licenses:write |
| discounts | discounts:read | discounts:write |
| stats | stats:read | — |

Special scope: `*:*` grants full access to all resources.

### API Endpoints

| Group | Endpoints |
|-------|-----------|
| **Checkout** | Create checkout, Retrieve checkout |
| **Product** | Create product, Retrieve product, Search products |
| **Customer** | Retrieve customer, List customers, Customer billing |
| **Subscription** | Retrieve, Update, Upgrade, Pause, Resume, Cancel |
| **Transaction** | Retrieve transaction, List transactions |
| **License** | Validate, Activate, Deactivate |
| **Discount** | Create, Retrieve, Delete |
| **Stats** | Revenue, Subscriptions, Customers, MRR, Churn, LTV |

### Core Data Entities

| Entity | Key Fields |
|--------|-----------|
| **Product** | id, name, price, currency, billing_period, tax_code |
| **Customer** | id, email, name, country |
| **Checkout** | id, product_id, customer info, success/return URLs |
| **Subscription** | id, status (active/paused/canceled/expired), current_period_start/end |
| **Transaction** | id, type (charge/refund/chargeback), status, amount |
| **License** | id, key, activation_limit, status |
| **Discount** | id, code, type (percentage/fixed_amount), duration |

### SDKs & Developer Tools

| Tool | Purpose |
|------|---------|
| `@creem/sdk` | Core TypeScript SDK |
| `@creem/next` | Next.js adapter with server-side helpers |
| `creem-cli` | CLI tool for managing products, customers, subscriptions |
| Webhooks | Event-driven notifications (checkout.completed, subscription.active, etc.) |

---

## Content Guidelines

### Tone & Voice

- **Professional but friendly** — developer-focused, not overly corporate
- **Clear and concise** — get to the point, avoid filler
- **Practical** — lead with code examples and concrete use cases
- **Authoritative** — be precise when discussing tax, compliance, or legal topics

### Writing Standards

- Use **second person** ("you") when addressing the reader
- Use **present tense** ("Creem handles" not "Creem will handle")
- Keep paragraphs short (2-4 sentences max)
- Lead sections with the most important information
- Include code examples wherever relevant
- Use tables for structured reference data
- Use admonitions (Note, Warning, Tip, Info) for callouts

### Mintlify Components

Use Mintlify's built-in components in MDX:

````mdx
<Note>Important information the reader should know.</Note>
<Warning>Critical warning about potential issues.</Warning>
<Tip>Helpful suggestion or best practice.</Tip>
<Info>Additional context that may be useful.</Info>

<CodeGroup>
```typescript TypeScript
// TypeScript example
```
```python Python
# Python example
```
</CodeGroup>

<Card title="Card Title" icon="icon-name" href="/link">
  Card description text.
</Card>

<CardGroup cols={2}>
  <Card title="Card 1">Description</Card>
  <Card title="Card 2">Description</Card>
</CardGroup>

<Steps>
  <Step title="First Step">
    Step content here.
  </Step>
  <Step title="Second Step">
    Step content here.
  </Step>
</Steps>

<Tabs>
  <Tab title="Tab 1">Content for tab 1</Tab>
  <Tab title="Tab 2">Content for tab 2</Tab>
</Tabs>

<Accordion title="Expandable Section">
  Hidden content revealed on click.
</Accordion>
````

---

## AI & Agent Integration

Creem has first-class support for AI agents. The `skills/` directory contains a Claude Code plugin:

- `skills/creem-api/Skill.md` — Core instructions for the Creem API skill
- `skills/creem-api/REFERENCE.md` — API reference for agents
- `skills/creem-api/WEBHOOKS.md` — Webhook documentation for agents
- `skills/creem-api/WORKFLOWS.md` — Common integration patterns

The `ai/` documentation directory covers:
- **For Humans**: CLI usage, getting started guides
- **For Agents**: Skill files, agent CLI, store monitoring

### llms.txt

The `llms.txt` file at the root provides an LLM-friendly summary of Creem. This is served at `https://docs.creem.io/llms.txt` and linked from the navbar. Keep it updated when major features or API changes are made.

---

## Legal Entity

- **Company Name**: Armitage Labs OÜ (Estonia)
- **Product Name**: Creem
- Use "Armitage Labs OÜ" only in legal/compliance contexts (terms of service, invoices, email footers)
- Use "Creem" for all product branding and documentation

---

## Publishing & Deployment

- Changes pushed to `main` are **automatically deployed** via the Mintlify GitHub App
- Preview builds are generated for pull requests
- No manual build or deploy step needed

---

## Code Quality Checklist

Before submitting documentation changes, verify:

- [ ] MDX frontmatter is complete (title, description)
- [ ] Page is added to `docs.json` navigation if new
- [ ] Links to other docs use relative paths (e.g., `/getting-started/quickstart`)
- [ ] Code examples are accurate and use current SDK/API patterns
- [ ] API reference changes are generated via the script, not manually edited
- [ ] Formatting passes (`npm run format:check`)
- [ ] No broken internal links
- [ ] Tone matches Creem voice (professional, friendly, developer-focused)
- [ ] Business/legal terminology is accurate (MoR, VAT, compliance)
