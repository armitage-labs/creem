# Quick Start Guide

Get the Creem Better-Auth test app running in 5 minutes.

## TL;DR

```bash
# 1. Navigate to test app
cd test/nextjs-app

# 2. Install and build
npm run setup

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Creem API key

# 4. Start app
npm run dev
```

Open http://localhost:3000 🚀

## Detailed Steps

### Step 1: Prerequisites

Make sure you have:
- ✅ Node.js 22+ installed
- ✅ npm or yarn
- ✅ A Creem account ([sign up here](https://creem.io))

### Step 2: Get Creem Credentials

1. Log in to [Creem Dashboard](https://creem.io/dashboard)
2. Go to **Settings** → **API Keys**
3. Copy your **API Key**
4. Copy your **Webhook Secret**
5. Make sure **Test Mode** is enabled

### Step 3: Install Dependencies

```bash
cd test/nextjs-app
npm install
```

This installs:
- Next.js and React
- Better-Auth
- Creem SDK
- SQLite database
- Tailwind CSS
- TypeScript

### Step 4: Build Parent Plugin

```bash
npm run build:plugin
```

This builds the Creem Better-Auth plugin from the parent directory.

### Step 5: Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
BETTER_AUTH_SECRET=<paste-generated-secret>
BETTER_AUTH_URL=http://localhost:3000
CREEM_API_KEY=<paste-your-api-key>
CREEM_WEBHOOK_SECRET=<paste-your-webhook-secret>
CREEM_TEST_MODE=true
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 6: Start Development Server

```bash
npm run dev
```

The app will start at http://localhost:3000

### Step 7: Create Test Products in Creem

1. Go to Creem Dashboard → **Products**
2. Click **Create Product**
3. Add product details:
   - Name: "Starter Plan"
   - Price: $9/month
   - Type: Recurring
4. Copy the **Product ID**
5. Update `src/app/pricing/page.tsx` with your product IDs

### Step 8: Test the Integration

1. **Sign Up**: Go to http://localhost:3000/auth/signup
2. **View Pricing**: Navigate to /pricing
3. **Subscribe**: Click "Subscribe" (you'll be redirected to Creem)
4. **Use Test Card**: 
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVC: `123`
5. **Complete Payment**: You'll be redirected back
6. **Check Dashboard**: See your active subscription

## What's Next?

### Enable Webhooks (Optional)

For webhooks to work locally:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok
ngrok http 3000

# Copy the HTTPS URL
# Add to Creem Dashboard → Webhooks:
# https://your-url.ngrok.io/api/auth/creem-webhook
```

### Explore Features

- 📊 **Dashboard**: View subscription status
- 💳 **Portal**: Manage your subscription
- 📜 **Transactions**: See payment history
- ⚙️ **Settings**: Update account details

### Read Documentation

- [README.md](./README.md) - Full documentation
- [SETUP.md](./SETUP.md) - Detailed setup guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Architecture overview

## Troubleshooting

### "Module not found"

```bash
npm run build:plugin
```

### "Database is locked"

```bash
rm auth.db*
npm run dev
```

### "Invalid API key"

Check that `CREEM_API_KEY` in `.env.local` matches your Creem dashboard.

### Port 3000 already in use

```bash
npm run dev -- -p 3001
```

Then update `BETTER_AUTH_URL` to `http://localhost:3001`

## Getting Help

- 📖 Check [SETUP.md](./SETUP.md) for detailed setup
- 🧪 Check [TESTING_GUIDE.md](./TESTING_GUIDE.md) for testing
- 🐛 Open issue on [GitHub](https://github.com/armitage-labs/creem-betterauth/issues)
- 💬 Contact [Creem Support](mailto:support@creem.io)

## Success!

If you can see the home page and create an account, you're all set! 🎉

Start testing the Creem Better-Auth integration and explore all the features.

---

**Need more details?** See [README.md](./README.md)  
**Found a bug?** Please report it on GitHub  
**Have a question?** Check the documentation or ask for help

