# Quick Setup Guide

Follow these steps to get the test app running:

## Prerequisites

- Node.js 22+ installed
- A Creem account with API credentials
- Git (for cloning/managing the repo)

## Step-by-Step Setup

### 1. Navigate to the test app directory

```bash
cd test/nextjs-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Copy the example env file:

```bash
cp .env.local.example .env.local
```

### 4. Configure environment variables

Edit `.env.local` and add your credentials:

```env
# Generate a random secret (use the command below)
BETTER_AUTH_SECRET=your-generated-secret

# Your local development URL
BETTER_AUTH_URL=http://localhost:3000

# Get these from your Creem dashboard at https://creem.io
CREEM_API_KEY=your-creem-api-key
CREEM_WEBHOOK_SECRET=your-webhook-secret
CREEM_TEST_MODE=true
```

To generate a secret key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Build the parent package

The test app imports the Creem plugin from the parent directory, so you need to build it first:

```bash
cd ../..
npm run build
cd test/nextjs-app
```

### 6. Run the development server

```bash
npm run dev
```

### 7. Open in browser

Navigate to [http://localhost:3000](http://localhost:3000)

## Getting Creem Credentials

1. Sign up at [https://creem.io](https://creem.io)
2. Go to your dashboard
3. Navigate to Settings > API Keys
4. Copy your API key
5. Set up test mode for development
6. Create a webhook secret for webhook verification

## Setting Up Products

1. In your Creem dashboard, create test products
2. Note the product IDs
3. Update the product IDs in `src/app/pricing/page.tsx`:

```typescript
const plans = [
  {
    id: "prod_your_actual_product_id", // Replace with real ID
    name: "Starter",
    // ... rest of config
  },
  // ...
];
```

## Testing Webhooks Locally

For webhooks to work locally, you'll need to expose your local server:

### Option 1: Using ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Run ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Configure this in your Creem dashboard webhook settings
```

### Option 2: Using Cloudflare Tunnel

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Run tunnel
cloudflared tunnel --url http://localhost:3000
```

### Configure webhook in Creem

In your Creem dashboard:
1. Go to Webhooks settings
2. Add your ngrok/tunnel URL: `https://your-url.ngrok.io/api/auth/creem-webhook`
3. Select the events you want to receive
4. Save the webhook configuration

## Troubleshooting

### "Module not found" errors

Make sure you've built the parent package:
```bash
cd ../.. && npm run build && cd test/nextjs-app
```

### Database errors

Delete the database and restart:
```bash
rm auth.db*
npm run dev
```

### Type errors

Restart your TypeScript server in your IDE, or run:
```bash
npm run typecheck
```

### Webhook not working

1. Check that `CREEM_WEBHOOK_SECRET` matches your Creem dashboard
2. Ensure your webhook URL is publicly accessible (use ngrok)
3. Check the Creem dashboard webhook logs for delivery status
4. Look at your app console logs for webhook receive events

## Next Steps

Once the app is running:

1. **Sign Up**: Create a test account at `/auth/signup`
2. **View Pricing**: Check out the pricing page at `/pricing`
3. **Test Checkout**: Try subscribing to a plan (uses Creem test mode)
4. **Check Dashboard**: View your subscription status at `/dashboard`
5. **Manage Subscription**: Access the customer portal at `/portal`
6. **View Transactions**: See transaction history at `/transactions`

## Development Tips

### Hot Reload

The app uses Next.js hot reload. Changes to:
- React components: Instant reload
- Server-side code: Requires server restart
- Parent plugin code: May require rebuilding (`npm run build` in parent dir)

### Debugging

Add console logs in:
- `src/lib/auth.ts` - Server-side auth logic
- `onGrantAccess` / `onRevokeAccess` callbacks - See webhook events
- Client components - Browser console

### Testing Different Scenarios

1. **New Subscription**: Complete checkout flow
2. **Cancel Subscription**: Use customer portal to cancel
3. **Expired Subscription**: Wait or manually expire in Creem dashboard
4. **Failed Payment**: Use Creem test cards that fail
5. **Refund**: Create a refund in Creem dashboard

## Support

For issues with:
- **Better-Auth**: https://github.com/better-auth/better-auth
- **Creem**: https://docs.creem.io or support@creem.io
- **This Plugin**: https://github.com/armitage-labs/creem-betterauth/issues

Happy testing! 🚀

