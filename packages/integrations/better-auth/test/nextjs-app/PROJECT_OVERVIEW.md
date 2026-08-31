# Project Overview

## Purpose

This Next.js application is a comprehensive test harness for the Creem Better-Auth plugin. It demonstrates all plugin features and serves as:

1. **Development Tool**: Test plugin changes locally without publishing
2. **Reference Implementation**: Example code for integration
3. **Documentation**: Working examples of all features
4. **Debugging Aid**: Full app context for troubleshooting

## Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Better-Auth
- **Payments**: Creem (via Better-Auth plugin)
- **Database**: SQLite (better-sqlite3)

### Project Structure

```
test/nextjs-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Better-Auth endpoints
│   │   │   │   └── [...all]/  # Catch-all auth route
│   │   │   └── webhook/       # Custom webhook handler (example)
│   │   ├── auth/              # Authentication pages
│   │   │   ├── signin/        # Sign in page
│   │   │   └── signup/        # Sign up page
│   │   ├── dashboard/         # User dashboard
│   │   ├── pricing/           # Subscription plans
│   │   ├── portal/            # Customer portal access
│   │   ├── transactions/      # Transaction history
│   │   ├── success/           # Post-checkout success
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable React components
│   │   ├── LoadingSpinner.tsx
│   │   └── SubscriptionBadge.tsx
│   └── lib/                   # Configuration and utilities
│       ├── auth.ts            # Better-Auth server config
│       └── auth-client.ts     # Better-Auth client config
├── public/                    # Static assets
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.ts        # Tailwind CSS config
├── next.config.js            # Next.js configuration
├── postcss.config.mjs        # PostCSS config
├── .env.local.example        # Environment variables template
├── .gitignore                # Git ignore rules
├── README.md                 # Main documentation
├── SETUP.md                  # Setup instructions
├── TESTING_GUIDE.md          # Testing procedures
└── PROJECT_OVERVIEW.md       # This file
```

## Key Features

### 1. Authentication Flow

**Files:**
- `src/lib/auth.ts` - Server-side auth configuration
- `src/lib/auth-client.ts` - Client-side auth setup
- `src/app/auth/signin/page.tsx` - Sign in UI
- `src/app/auth/signup/page.tsx` - Sign up UI

**Features:**
- Email/password authentication
- Session management
- Protected routes
- Auto-redirect on auth state changes

### 2. Creem Integration

**Files:**
- `src/lib/auth.ts` - Plugin configuration with callbacks

**Plugin Configuration:**
```typescript
creem({
  apiKey: process.env.CREEM_API_KEY!,
  testMode: true,
  onGrantAccess: async (context) => {
    // Handle subscription activation
  },
  onRevokeAccess: async (context) => {
    // Handle subscription cancellation
  }
})
```

**Endpoints Provided:**
- `/api/auth/create-checkout` - Create checkout session
- `/api/auth/create-portal` - Generate portal URL
- `/api/auth/cancel-subscription` - Cancel subscription
- `/api/auth/retrieve-subscription` - Get subscription details
- `/api/auth/search-transactions` - Search transactions
- `/api/auth/has-access-granted` - Check subscription status
- `/api/auth/creem-webhook` - Handle Creem webhooks

### 3. Checkout Process

**Files:**
- `src/app/pricing/page.tsx` - Pricing page with plans
- `src/app/success/page.tsx` - Post-checkout success page

**Flow:**
1. User views pricing page
2. Clicks "Subscribe" on a plan
3. Redirected to Creem checkout
4. Completes payment
5. Redirected back to success page
6. `onGrantAccess` callback triggered
7. User gains access to premium features

### 4. Subscription Management

**Files:**
- `src/app/dashboard/page.tsx` - Subscription status display
- `src/app/portal/page.tsx` - Customer portal access

**Features:**
- Check active subscription status
- Access customer portal
- Update payment methods
- View/download invoices
- Cancel subscription

### 5. Transaction History

**Files:**
- `src/app/transactions/page.tsx` - Transaction list

**Features:**
- Display all transactions
- Show transaction status
- Format amounts
- Empty state handling

### 6. Webhook Handling

**Files:**
- `src/lib/auth.ts` - Webhook callbacks

**Events Handled:**
- `checkout.completed` → Grant access
- `subscription.updated` → Update access
- `subscription.cancelled` → Revoke access
- `refund.created` → Revoke access

**Security:**
- Signature verification
- Webhook secret validation
- Replay attack prevention

## Configuration

### Environment Variables

```env
# Required
BETTER_AUTH_SECRET=<random-secret>
CREEM_API_KEY=<your-api-key>

# Optional
BETTER_AUTH_URL=http://localhost:3000
CREEM_WEBHOOK_SECRET=<webhook-secret>
CREEM_TEST_MODE=true
```

### Dependencies

**Runtime:**
- `next` - React framework
- `react` & `react-dom` - UI library
- `better-auth` - Authentication
- `creem` - Payment processing
- `better-sqlite3` - Database
- `zod` - Schema validation

**Development:**
- `typescript` - Type safety
- `tailwindcss` - Styling
- `eslint` - Code linting

## API Integration

### Client-Side Usage

```typescript
import { creemClient } from "@/lib/auth-client";

// Create checkout
const { data } = await creemClient.createCheckout({
  productId: "prod_xxx",
  successUrl: "/success",
  cancelUrl: "/pricing",
});

// Check subscription
const { data } = await creemClient.hasAccessGranted();

// Open portal
const { data } = await creemClient.createPortal({
  returnUrl: "/dashboard",
});

// Search transactions
const { data } = await creemClient.searchTransactions({
  limit: 20,
});
```

### Server-Side Usage

```typescript
import { auth } from "@/lib/auth";

// In API route or Server Component
const session = await auth.api.getSession({ headers });
const user = session?.user;
```

## Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Build parent plugin
npm run build:plugin

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# 4. Start development server
npm run dev
```

### Making Changes

**To Parent Plugin:**
1. Edit files in `../../src/`
2. Run `npm run build:plugin`
3. Restart Next.js dev server
4. Changes reflected in test app

**To Test App:**
1. Edit files in `src/`
2. Changes hot-reload automatically
3. No rebuild needed

### Testing Changes

```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm run start
```

## Import Strategy

The test app imports the plugin from the built distribution:

```typescript
// From: test/nextjs-app/src/lib/auth.ts
import { creem } from "../../../../dist/esm/index";
```

**Why ESM?**
- Better tree-shaking
- Modern module system
- Next.js prefers ESM
- Smaller bundle size

**Alternative (for debugging):**
```typescript
// Import directly from source (requires rebuild on changes)
import { creem } from "../../../../src/index";
```

## Database Schema

The app uses Better-Auth's default schema with SQLite:

**Tables:**
- `user` - User accounts
- `session` - Active sessions
- `verification` - Email verification tokens
- `account` - OAuth accounts (if using social auth)

**Custom Fields:**
You can extend the user table for subscription data:

```typescript
// Example: Store subscription info
interface CustomUser {
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'cancelled' | 'expired';
  productId?: string;
}
```

## Styling Approach

**Tailwind CSS Utility-First:**
- No custom CSS classes
- Inline utilities for rapid development
- Consistent design tokens
- Responsive by default

**Example:**
```tsx
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
  Subscribe
</button>
```

## Error Handling

### Client-Side

```typescript
try {
  const result = await creemClient.createCheckout({...});
  if (result.error) {
    // Handle API error
    console.error(result.error.message);
  }
} catch (error) {
  // Handle network error
  console.error(error);
}
```

### Server-Side

```typescript
export const auth = betterAuth({
  // ...
  onError: (error) => {
    console.error("Auth error:", error);
  },
});
```

## Security Considerations

### Environment Variables
- ✅ Never commit `.env.local`
- ✅ Use `.env.local.example` for template
- ✅ Rotate secrets regularly

### Webhook Security
- ✅ Verify webhook signatures
- ✅ Use HTTPS in production
- ✅ Validate payload structure
- ✅ Log webhook events

### User Data
- ✅ Hash passwords (Better-Auth handles this)
- ✅ Secure session tokens
- ✅ CSRF protection (Next.js handles this)

## Performance Optimization

### Bundle Size
- Tree-shaking enabled
- Import only what you need
- Use dynamic imports for large components

### Database
- Connection pooling
- Prepared statements
- Indexed queries

### Caching
- Next.js automatic caching
- API response caching
- Static page generation where possible

## Deployment Considerations

### Production Checklist

- [ ] Set `CREEM_TEST_MODE=false`
- [ ] Use production Creem API keys
- [ ] Update `BETTER_AUTH_URL` to production URL
- [ ] Use PostgreSQL instead of SQLite
- [ ] Configure webhook URL in Creem dashboard
- [ ] Enable HTTPS
- [ ] Set up monitoring
- [ ] Configure error tracking

### Recommended Platforms

- **Vercel** - Optimal for Next.js
- **Netlify** - Good alternative
- **Railway** - Supports databases
- **Render** - All-in-one solution

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Module not found | Run `npm run build:plugin` |
| Database locked | Delete `auth.db*` files |
| Type errors | Restart TypeScript server |
| Webhook not working | Check ngrok and webhook URL |
| Import errors | Verify dist folder exists |

### Debug Mode

Enable verbose logging:

```typescript
// In auth.ts
export const auth = betterAuth({
  // ...
  advanced: {
    debug: process.env.NODE_ENV === 'development',
  },
});
```

## Testing Coverage

This app tests:

✅ Authentication (sign up, sign in, sign out)  
✅ Checkout flow (create session, redirect, success)  
✅ Subscription management (status, portal, cancel)  
✅ Transaction history (list, filter, display)  
✅ Webhook handling (signature, events, callbacks)  
✅ Error handling (network, API, validation)  
✅ Edge cases (unauthenticated, invalid keys, etc.)

## Extension Points

### Adding New Features

1. **New Payment Methods**: Update checkout options
2. **Social Auth**: Add OAuth providers to Better-Auth
3. **Custom Subscription Logic**: Extend `onGrantAccess` callback
4. **Analytics**: Track checkout/subscription events
5. **Email Notifications**: Send emails on subscription events

### Customization

- Modify pricing tiers in `pricing/page.tsx`
- Update branding in `layout.tsx`
- Add custom subscription fields
- Extend user profile with subscription data

## Resources

- [Better-Auth Docs](https://better-auth.com)
- [Creem Docs](https://docs.creem.io)
- [Next.js Docs](https://nextjs.org/docs)
- [Plugin GitHub](https://github.com/armitage-labs/creem-betterauth)

## Support

For issues or questions:

1. Check [SETUP.md](./SETUP.md) for setup help
2. Review [TESTING_GUIDE.md](./TESTING_GUIDE.md) for testing
3. Open issue on GitHub
4. Contact Creem support

---

**Last Updated**: November 2024  
**Version**: 0.1.0  
**Status**: Active Development

