# CREEM Skills for AI Coding Assistants

This folder contains skills designed to help developers integrate CREEM payment infrastructure using AI coding assistants like Claude Code, Cursor, and other AI-powered development tools.

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

## Using with Claude Code

### Option 1: Direct Reference

When working with Claude Code, you can reference this skill by asking:

```
Help me integrate CREEM payments. Use the skill at skills/creem-api/Skill.md
```

### Option 2: Install as Custom Skill

1. Zip the `creem-api` folder:
   ```bash
   cd skills
   zip -r creem-api.zip creem-api/
   ```

2. Upload to Claude Code or your AI assistant's skill management system

3. The skill will be available for all future conversations

## Using with Cursor

In Cursor, you can:

1. **Add to context**: Add the skill files to your conversation context
2. **Use @docs**: Reference the documentation files directly
3. **Custom instructions**: Add the skill content to your project's custom instructions

## Using with Other AI Tools

Most AI coding assistants support adding custom context or instructions. You can:

1. Copy relevant sections from the skill files into your conversation
2. Add the files to your project's AI configuration
3. Reference the OpenAPI specification (`api-reference/openapi.json`) for structured API information

## Skill Structure

```
skills/
└── creem-api/
    ├── Skill.md          # Core skill instructions (required)
    ├── REFERENCE.md      # Detailed API reference
    ├── WEBHOOKS.md       # Webhook documentation
    └── WORKFLOWS.md      # Integration patterns
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

- **TypeScript SDK** (`creem_io`) - See `/code/sdks/typescript.mdx`
- **Next.js SDK** (`@creem_io/nextjs`) - See `/code/sdks/nextjs.mdx`
- **Better Auth Plugin** (`@creem_io/better-auth`) - See `/code/sdks/better-auth.mdx`
- **Community Boilerplates** - See `/code/community/`

For SDK-specific help, refer to the SDK documentation in the main docs.

## Contributing

To improve this skill:

1. Test the integration patterns in real projects
2. Identify common pain points or missing information
3. Update the relevant markdown file
4. Keep examples current with API changes

## Support

- **Documentation**: https://docs.creem.io
- **Dashboard**: https://creem.io/dashboard
- **Support**: support@creem.io
