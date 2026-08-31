# Creem Better-Auth Test App

This is a Next.js application for testing the Creem Better-Auth plugin locally without publishing to npm.

## Features

- ✅ Better-Auth authentication (email/password)
- ✅ Local Creem plugin import (from parent directory)
- ✅ Complete checkout flow
- ✅ Customer portal integration
- ✅ Subscription management
- ✅ Transaction history
- ✅ Webhook handling (onGrantAccess/onRevokeAccess)
- ✅ Access control checks

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in this directory:

```env
# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000

# Creem Configuration
CREEM_API_KEY=your-creem-api-key
CREEM_WEBHOOK_SECRET=your-webhook-secret
CREEM_TEST_MODE=true
```

You can generate a secret key with:
```bash
openssl rand -base64 32
```

### 3. Build the Parent Package

Make sure the parent Creem Better-Auth package is built:

```bash
cd ../..
npm run build
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/[...all]/    # Better-Auth API routes
│   ├── auth/
│   │   ├── signin/           # Sign in page
│   │   └── signup/           # Sign up page
│   ├── dashboard/            # User dashboard
│   ├── pricing/              # Subscription plans
│   ├── portal/               # Customer portal access
│   ├── transactions/         # Transaction history
│   ├── success/              # Post-checkout success page
│   └── page.tsx              # Home page
└── lib/
    ├── auth.ts               # Better-Auth server config
    └── auth-client.ts        # Better-Auth client config
```

## Testing the Plugin

### 1. Authentication

- Visit `/auth/signup` to create an account
- Or use `/auth/signin` to sign in with an existing account

### 2. Checkout Flow

1. Go to `/pricing`
2. Update the `productId` values with actual product IDs from your Creem dashboard
3. Click "Subscribe" on a plan
4. You'll be redirected to Creem's checkout page
5. Complete the payment (use Creem test mode)
6. You'll be redirected back to `/success`
7. The `onGrantAccess` callback will be triggered

### 3. Customer Portal

1. Go to `/portal`
2. Click "Open Customer Portal"
3. Manage your subscription, update payment methods, etc.
4. The `onRevokeAccess` callback will be triggered if you cancel

### 4. Transaction History

1. Go to `/transactions`
2. View all your past transactions
3. Tests the `searchTransactions` endpoint

### 5. Subscription Status

1. Go to `/dashboard`
2. See your subscription status
3. Tests the `hasAccessGranted` endpoint

## Plugin Features Tested

### Endpoints

- ✅ `createCheckout` - Create a checkout session
- ✅ `createPortal` - Generate portal access URL
- ✅ `cancelSubscription` - Cancel active subscription
- ✅ `retrieveSubscription` - Get subscription details
- ✅ `searchTransactions` - Search transaction history
- ✅ `hasAccessGranted` - Check subscription access

### Webhooks

- ✅ `onGrantAccess` - Called when subscription is activated
- ✅ `onRevokeAccess` - Called when subscription is cancelled/expired

### Client Methods

- ✅ `creemClient.createCheckout()`
- ✅ `creemClient.createPortal()`
- ✅ `creemClient.searchTransactions()`
- ✅ `creemClient.hasAccessGranted()`

## Local Development Notes

This app imports the Creem plugin directly from the source files in the parent directory:

```typescript
import { creem } from "../../../../../../src/index";
```

This allows you to:
- Test changes immediately without rebuilding
- Debug the plugin code
- Iterate faster during development

Make sure to rebuild the parent package if you make TypeScript changes that affect type definitions.

## Troubleshooting

### Module not found errors

Make sure the parent package is built:
```bash
cd ../.. && npm run build
```

### Webhook not triggering

1. Make sure `CREEM_WEBHOOK_SECRET` is set in `.env.local`
2. Configure the webhook URL in your Creem dashboard to point to:
   ```
   http://localhost:3000/api/auth/creem-webhook
   ```
3. Use a tool like ngrok for local webhook testing:
   ```bash
   ngrok http 3000
   ```

### Database errors

The app uses SQLite with `better-sqlite3`. The database file (`auth.db`) is created automatically on first run.

## Production Deployment

When deploying to production:

1. Set production environment variables
2. Change `CREEM_TEST_MODE` to `false`
3. Update `BETTER_AUTH_URL` to your production URL
4. Use real Creem product IDs
5. Configure webhook URL in Creem dashboard

## License

MIT

