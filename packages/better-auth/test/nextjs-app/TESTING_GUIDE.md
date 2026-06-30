# Testing Guide

This guide walks you through testing all features of the Creem Better-Auth plugin.

## Prerequisites

✅ Completed [SETUP.md](./SETUP.md)  
✅ App running at http://localhost:3000  
✅ Creem API credentials configured  
✅ Test products created in Creem dashboard

## Test Scenarios

### 1. Authentication Flow

#### Test User Registration

1. Navigate to http://localhost:3000/auth/signup
2. Fill in:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `testpassword123`
3. Click "Sign Up"
4. ✅ **Expected**: Redirected to `/dashboard`
5. ✅ **Expected**: See user name and email displayed

#### Test User Login

1. Sign out if logged in
2. Navigate to http://localhost:3000/auth/signin
3. Enter credentials from registration
4. Click "Sign In"
5. ✅ **Expected**: Redirected to `/dashboard`
6. ✅ **Expected**: User session restored

### 2. Checkout Flow

#### Test Creating a Checkout Session

1. Make sure you're logged in
2. Navigate to http://localhost:3000/pricing
3. Click "Subscribe" on any plan
4. ✅ **Expected**: Redirected to Creem checkout page
5. ✅ **Expected**: See product details on checkout page
6. ✅ **Expected**: Email pre-filled from your account

**Console Checks:**
- Look for: `Creating checkout session...`
- API call to: `/api/auth/create-checkout`

#### Test Completing Checkout

1. On Creem checkout page, use test card:
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVC: Any 3 digits
2. Complete payment
3. ✅ **Expected**: Redirected to `/success`
4. ✅ **Expected**: See success message
5. ✅ **Expected**: Console logs show `onGrantAccess` called

**Server Console Checks:**
```
🎉 Granting access to user: {
  userId: "...",
  productId: "...",
  reason: "checkout_completed",
  metadata: {...}
}
```

### 3. Subscription Management

#### Test Checking Subscription Status

1. Navigate to http://localhost:3000/dashboard
2. ✅ **Expected**: Green indicator showing "Active Subscription"
3. ✅ **Expected**: "Manage Subscription" button visible

**API Checks:**
- Endpoint called: `/api/auth/has-access-granted`
- Response: `{ hasAccess: true }`

#### Test Customer Portal

1. From dashboard, click "Manage Subscription"
2. Or navigate to http://localhost:3000/portal
3. Click "Open Customer Portal"
4. ✅ **Expected**: Redirected to Creem customer portal
5. ✅ **Expected**: See your subscription details
6. ✅ **Expected**: Can update payment method
7. ✅ **Expected**: Can view invoices

**API Checks:**
- Endpoint called: `/api/auth/create-portal`
- Response includes: `{ url: "https://portal.creem.io/..." }`

#### Test Cancelling Subscription

1. In Customer Portal, find "Cancel Subscription"
2. Follow cancellation flow
3. ✅ **Expected**: Subscription marked as cancelled
4. ✅ **Expected**: Console logs show `onRevokeAccess` called
5. Navigate back to dashboard
6. ✅ **Expected**: Status shows "No Active Subscription"

**Server Console Checks:**
```
🚫 Revoking access from user: {
  userId: "...",
  productId: "...",
  reason: "subscription_cancelled",
  metadata: {...}
}
```

### 4. Transaction History

#### Test Viewing Transactions

1. Navigate to http://localhost:3000/transactions
2. ✅ **Expected**: See list of your transactions
3. ✅ **Expected**: Each transaction shows:
   - Date
   - Description
   - Amount
   - Status (succeeded, pending, failed)
   - Transaction ID

**API Checks:**
- Endpoint called: `/api/auth/search-transactions`
- Query params: `{ limit: 20 }`

#### Test Empty Transaction State

1. Sign out
2. Create a new account
3. Navigate to `/transactions`
4. ✅ **Expected**: Empty state with "No transactions yet"
5. ✅ **Expected**: Link to pricing page

### 5. Webhook Testing

#### Setup Webhook Endpoint

1. Start ngrok:
   ```bash
   ngrok http 3000
   ```

2. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. In Creem Dashboard:
   - Go to Webhooks
   - Add webhook: `https://abc123.ngrok.io/api/auth/creem-webhook`
   - Select events: 
     - `checkout.completed`
     - `subscription.updated`
     - `subscription.cancelled`
     - `refund.created`

#### Test Webhook Events

**Event: checkout.completed**

1. Complete a new checkout
2. ✅ **Expected**: Webhook POST to `/api/auth/creem-webhook`
3. ✅ **Expected**: `onGrantAccess` called with reason: `"checkout_completed"`

**Event: subscription.cancelled**

1. Cancel subscription via portal
2. ✅ **Expected**: Webhook POST received
3. ✅ **Expected**: `onRevokeAccess` called with reason: `"subscription_cancelled"`

**Event: refund.created**

1. Create refund in Creem dashboard
2. ✅ **Expected**: Webhook POST received
3. ✅ **Expected**: `onRevokeAccess` called with reason: `"refund_created"`

**Webhook Verification:**
- Check server console for signature verification logs
- Verify `creem-signature` header is present
- Verify signature validation passes

### 6. Edge Cases

#### Test Unauthenticated Access

1. Sign out
2. Try accessing `/dashboard`
3. ✅ **Expected**: Redirected to `/auth/signin`
4. Try accessing `/portal`
5. ✅ **Expected**: Redirected to `/auth/signin`

#### Test Invalid API Keys

1. Update `.env.local` with invalid `CREEM_API_KEY`
2. Restart server
3. Try creating checkout
4. ✅ **Expected**: Error message displayed
5. ✅ **Expected**: Console shows API error

#### Test Network Errors

1. Disconnect internet
2. Try creating checkout
3. ✅ **Expected**: Error handling gracefully
4. ✅ **Expected**: User-friendly error message

### 7. Performance Testing

#### Test Concurrent Requests

1. Open multiple tabs
2. Sign in on all tabs
3. Navigate to different pages simultaneously
4. ✅ **Expected**: No race conditions
5. ✅ **Expected**: Session consistent across tabs

#### Test Large Transaction Lists

1. Create multiple test transactions (via Creem dashboard)
2. Navigate to `/transactions`
3. ✅ **Expected**: Pagination or limit works
4. ✅ **Expected**: Page loads quickly (< 2s)

## Debugging Checklist

### Client-Side Issues

**Open Browser DevTools (F12) and check:**

- [ ] Console for error messages
- [ ] Network tab for API calls
- [ ] Application > Local Storage for auth state
- [ ] Response payloads for error details

### Server-Side Issues

**Check terminal/console for:**

- [ ] Better-Auth initialization logs
- [ ] Creem plugin registration
- [ ] API endpoint registration
- [ ] Webhook event logs
- [ ] Database connection status

### Common Issues

**"Module not found" errors:**
```bash
npm run build:plugin
```

**Database locked errors:**
```bash
rm auth.db*
npm run dev
```

**Webhook not receiving events:**
1. Verify ngrok is running
2. Check webhook URL in Creem dashboard
3. Check webhook secret matches `.env.local`
4. Look at Creem webhook delivery logs

**Type errors:**
```bash
npm run typecheck
cd ../.. && npm run build
```

## Test Checklist Summary

Use this checklist to verify all features:

### Authentication
- [ ] Sign up new user
- [ ] Sign in existing user
- [ ] Sign out
- [ ] Session persistence

### Checkout
- [ ] Create checkout session
- [ ] Complete payment
- [ ] Success redirect
- [ ] onGrantAccess triggered

### Subscription
- [ ] Check subscription status
- [ ] View active subscriptions
- [ ] Open customer portal
- [ ] Cancel subscription
- [ ] onRevokeAccess triggered

### Transactions
- [ ] View transaction history
- [ ] Filter transactions
- [ ] Empty state display

### Webhooks
- [ ] checkout.completed event
- [ ] subscription.updated event
- [ ] subscription.cancelled event
- [ ] refund.created event
- [ ] Signature verification

### Error Handling
- [ ] Invalid credentials
- [ ] Network errors
- [ ] Invalid API keys
- [ ] Unauthenticated access

## Success Criteria

All tests passing means:

✅ Authentication works end-to-end  
✅ Checkout integration functional  
✅ Subscription management operational  
✅ Webhooks properly configured  
✅ Error handling robust  
✅ Plugin ready for production use

## Next Steps

After successful testing:

1. Review the implementation code
2. Customize for your use case
3. Add additional features
4. Deploy to staging environment
5. Test with real Creem account (not test mode)
6. Deploy to production

## Getting Help

If tests fail or you encounter issues:

1. Check this testing guide thoroughly
2. Review [SETUP.md](./SETUP.md) for configuration
3. Check [README.md](./README.md) for architecture
4. Open issue on GitHub
5. Contact Creem support

Happy testing! 🧪

