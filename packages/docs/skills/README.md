# CREEM Skills for AI Coding Assistants

Official Creem payment integration skills for AI coding assistants like Claude Code, Cursor, and Windsurf.

## Quick Install for Claude Code

Install the Creem skill with two simple commands:

```bash
/plugin marketplace add armitage-labs/creem-skills
/plugin install creem-api@creem-skills
```

That's it! Claude Code now has complete knowledge of the Creem API.

## What is a Skill?

Skills are structured instructions and reference materials that AI assistants use to provide more accurate, contextual help for specific tasks. When you load a skill, the AI assistant gains deep knowledge about the domain and can guide you through implementations with best practices.

## Available Skills

### creem-api

A comprehensive skill for integrating the CREEM REST API. Covers:

- **Checkouts** - Create payment sessions for one-time and recurring purchases
- **Subscriptions** - Manage recurring billing, upgrades, cancellations
- **Webhooks** - Handle real-time payment events securely
- **Licenses** - Implement license key systems for desktop/mobile apps
- **Customers** - Manage customer data and self-service portals
- **Discounts** - Create and manage promotional codes
- **Transactions** - Query payment history and details

**Contents:**
- `Skill.md` - Main skill file with quick reference and implementation patterns
- `REFERENCE.md` - Complete API reference with all endpoints and schemas
- `WEBHOOKS.md` - Webhook events documentation with payload examples
- `WORKFLOWS.md` - Step-by-step integration guides for common use cases

## Installation Methods

### Claude Code (Recommended)

**Option 1: Plugin Marketplace (Easiest)**

```bash
# Add the marketplace
/plugin marketplace add armitage-labs/creem-skills

# Install the skill
/plugin install creem-api@creem-skills
```

**Managing the plugin:**

```bash
# View installed plugins
/plugin

# Disable temporarily
/plugin disable creem-api@creem-skills

# Enable again
/plugin enable creem-api@creem-skills

# Uninstall
/plugin uninstall creem-api@creem-skills

# Update to latest version
/plugin marketplace update creem-skills
```

**Option 2: Direct Reference**

Reference the skill in any conversation:

```
Help me integrate Creem payments. Use the skill at https://github.com/armitage-labs/creem-skills
```

### Cursor

1. Clone the skill repository into your project:
   ```bash
   git clone https://github.com/armitage-labs/creem-skills.git .cursor/skills
   ```

2. Reference the skill files in your conversations using `@` mentions:
   ```
   @.cursor/skills/creem-api/Skill.md Help me create a checkout flow
   ```

### Windsurf

1. Clone the skill repository:
   ```bash
   git clone https://github.com/armitage-labs/creem-skills.git .windsurf/creem
   ```

2. Add to your project's knowledge base in Windsurf settings

### Other AI Tools

Most AI coding assistants support adding custom context. You can:

1. Clone this repository into your project
2. Add the files to your AI tool's context or knowledge base
3. Reference the OpenAPI specification (`api-reference/openapi.json`) for structured API information

## Skill Structure

```
skills/
├── .claude-plugin/
│   └── marketplace.json    # Plugin marketplace configuration
├── creem-api/
│   ├── plugin.json         # Plugin metadata
│   ├── Skill.md            # Core skill instructions
│   ├── REFERENCE.md        # Detailed API reference
│   ├── WEBHOOKS.md         # Webhook documentation
│   └── WORKFLOWS.md        # Integration patterns
└── README.md               # This file
```

## What This Skill Covers

### API Endpoints
- Products: Create, retrieve, list products
- Checkouts: Create and retrieve checkout sessions
- Customers: Manage customers and portal links
- Subscriptions: Full lifecycle management
- Licenses: Activation, validation, deactivation
- Discounts: Create and manage promotional codes
- Transactions: Query payment history

### Integration Patterns
- Basic SaaS subscription flows
- One-time purchases with digital delivery
- License key systems for desktop apps
- Seat-based team billing
- Freemium with upgrade flows
- Affiliate/referral tracking

### Best Practices
- Webhook signature verification
- Error handling patterns
- Test mode development
- Security considerations
- Idempotency and retry handling

## What This Skill Does NOT Cover

This skill focuses on the CREEM REST API. It does not cover:

- **TypeScript SDK** (`creem_io`) - See [TypeScript SDK docs](https://docs.creem.io/code/sdks/typescript)
- **Next.js SDK** (`@creem_io/nextjs`) - See [Next.js SDK docs](https://docs.creem.io/code/sdks/nextjs)
- **Better Auth Plugin** (`@creem_io/better-auth`) - See [Better Auth docs](https://docs.creem.io/code/sdks/better-auth)

For SDK-specific help, refer to the SDK documentation.

## Contributing

To improve this skill:

1. Test the integration patterns in real projects
2. Identify common pain points or missing information
3. Submit a pull request with improvements
4. Keep examples current with API changes

## Support

- **Documentation**: https://docs.creem.io
- **Dashboard**: https://creem.io/dashboard
- **Support**: support@creem.io
