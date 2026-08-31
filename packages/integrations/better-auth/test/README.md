# Test Directory

This directory contains test applications and scripts for the Creem Better-Auth plugin.

## Contents

### `/nextjs-app`

A complete Next.js application that demonstrates the Creem Better-Auth plugin integration.

**Features:**
- Full authentication flow (sign up, sign in, sign out)
- Subscription checkout with Creem
- Customer portal integration
- Transaction history
- Subscription status checking
- Webhook handling (onGrantAccess/onRevokeAccess)

**Quick Start:**

```bash
cd nextjs-app
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
```

See the [nextjs-app/README.md](./nextjs-app/README.md) for detailed documentation.

### `/script.ts`

A simple test script for quick imports and testing.

## Purpose

These test applications serve to:

1. **Local Development**: Test the plugin locally without publishing to npm
2. **Integration Testing**: Verify all plugin features work correctly
3. **Example Code**: Provide reference implementations for users
4. **Debugging**: Easier to debug issues with a full working example

## Note

The test applications are **not included** in the npm package. They are only for local development and testing purposes.

The `.npmignore` file in the root directory excludes the entire `test/` folder from being published.

