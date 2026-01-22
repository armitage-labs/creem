# CREEM Integration Workflows

Step-by-step guides for common integration patterns.

## Table of Contents

1. [Basic SaaS Subscription](#1-basic-saas-subscription)
2. [One-Time Purchase with Digital Delivery](#2-one-time-purchase-with-digital-delivery)
3. [License Key System for Desktop Apps](#3-license-key-system-for-desktop-apps)
4. [Seat-Based Team Billing](#4-seat-based-team-billing)
5. [Freemium with Upgrade Flow](#5-freemium-with-upgrade-flow)
6. [Affiliate/Referral Tracking](#6-affiliatereferral-tracking)

---

## 1. Basic SaaS Subscription

A complete flow for a typical SaaS application with monthly/yearly plans.

### Architecture

```
User clicks "Subscribe" → Create Checkout → User pays → Webhook grants access
                                                      ↓
User's subscription status ← Check status ← Webhook renews/cancels
```

### Step 1: Create Products in Dashboard

Create products in the CREEM dashboard:
- Monthly Plan: $29/month, billing_type: recurring, billing_period: every-month
- Yearly Plan: $290/year, billing_type: recurring, billing_period: every-year

### Step 2: Implement Checkout Route

```typescript
// app/api/checkout/route.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server';

const CREEM_API_KEY = process.env.CREEM_API_KEY!;
const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.creem.io'
  : 'https://test-api.creem.io';

export async function POST(req: NextRequest) {
  const { productId, userId, email } = await req.json();

  const response = await fetch(`${BASE_URL}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: productId,
      request_id: `checkout_${userId}_${Date.now()}`,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      customer: { email },
      metadata: {
        userId,
        source: 'webapp'
      }
    }),
  });

  const checkout = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: checkout }, { status: response.status });
  }

  return NextResponse.json({ checkoutUrl: checkout.checkout_url });
}
```

### Step 3: Create Checkout Button Component

```tsx
// components/CheckoutButton.tsx
'use client';

import { useState } from 'react';

interface CheckoutButtonProps {
  productId: string;
  userId: string;
  email: string;
  children: React.ReactNode;
}

export function CheckoutButton({ productId, userId, email, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, userId, email }),
      });

      const { checkoutUrl, error } = await response.json();

      if (error) {
        console.error('Checkout error:', error);
        return;
      }

      // Redirect to CREEM checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

### Step 4: Handle Webhook Events

```typescript
// app/api/webhooks/creem/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('creem-signature');
  const rawBody = await req.text();

  // Verify signature
  const computed = crypto
    .createHmac('sha256', process.env.CREEM_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (computed !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  switch (event.eventType) {
    case 'checkout.completed': {
      const { customer, subscription, metadata, product } = event.object;

      // Find user by metadata or email
      const userId = metadata?.userId;
      const user = userId
        ? await db.user.findUnique({ where: { id: userId } })
        : await db.user.findUnique({ where: { email: customer.email } });

      if (!user) {
        console.error('User not found:', customer.email);
        break;
      }

      // Create or update subscription
      await db.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          creemSubscriptionId: subscription.id,
          creemCustomerId: customer.id,
          productId: product.id,
          plan: product.name,
          status: 'active',
          currentPeriodEnd: new Date(subscription.current_period_end_date),
        },
        update: {
          creemSubscriptionId: subscription.id,
          productId: product.id,
          plan: product.name,
          status: 'active',
          currentPeriodEnd: new Date(subscription.current_period_end_date),
        },
      });

      // Update user role
      await db.user.update({
        where: { id: user.id },
        data: { role: 'pro' },
      });
      break;
    }

    case 'subscription.paid': {
      const { id, current_period_end_date } = event.object;

      await db.subscription.update({
        where: { creemSubscriptionId: id },
        data: {
          status: 'active',
          currentPeriodEnd: new Date(current_period_end_date),
        },
      });
      break;
    }

    case 'subscription.canceled': {
      const { id, current_period_end_date } = event.object;

      await db.subscription.update({
        where: { creemSubscriptionId: id },
        data: {
          status: 'canceled',
          currentPeriodEnd: new Date(current_period_end_date),
        },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

### Step 5: Check Subscription Status

```typescript
// lib/subscription.ts
import { db } from './db';

export async function checkSubscription(userId: string): Promise<{
  isActive: boolean;
  plan: string | null;
  expiresAt: Date | null;
}> {
  const subscription = await db.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return { isActive: false, plan: null, expiresAt: null };
  }

  // Active if status is 'active' OR canceled but still within period
  const isActive =
    subscription.status === 'active' ||
    (subscription.status === 'canceled' &&
      subscription.currentPeriodEnd > new Date());

  return {
    isActive,
    plan: subscription.plan,
    expiresAt: subscription.currentPeriodEnd,
  };
}
```

### Step 6: Create Customer Portal Link

```typescript
// app/api/billing/route.ts
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: session.userId },
  });

  if (!subscription?.creemCustomerId) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const response = await fetch(`${BASE_URL}/v1/customers/billing`, {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_id: subscription.creemCustomerId,
    }),
  });

  const { customer_portal_link } = await response.json();

  return NextResponse.json({ portalUrl: customer_portal_link });
}
```

---

## 2. One-Time Purchase with Digital Delivery

For selling digital products like ebooks, templates, or courses.

### Architecture

```
User purchases → Checkout completes → Webhook triggers → Generate download link
                                                        ↓
                                            Send email with access
```

### Step 1: Product Setup

Create a one-time product in the dashboard with:
- billing_type: `onetime`
- Enable "File Downloads" feature with your digital files

### Step 2: Checkout with Custom Fields

```typescript
const createCheckout = async (productId: string, customerEmail: string) => {
  const response = await fetch(`${BASE_URL}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: productId,
      customer: { email: customerEmail },
      success_url: `${APP_URL}/download?session={checkout_id}`,
      custom_fields: [
        {
          type: 'text',
          key: 'companyName',
          label: 'Company Name (for license)',
          optional: true,
        },
        {
          type: 'checkbox',
          key: 'newsletter',
          label: 'Subscribe to newsletter',
          optional: true,
          checkbox: {
            label: 'Send me updates about new products'
          }
        }
      ]
    }),
  });

  return response.json();
};
```

### Step 3: Handle Completed Purchase

```typescript
case 'checkout.completed': {
  const { customer, product, feature, custom_fields } = event.object;

  // Get files from features
  const fileFeature = feature?.find(f => f.type === 'file');
  const files = fileFeature?.file?.files || [];

  // Create purchase record
  await db.purchase.create({
    data: {
      customerEmail: customer.email,
      productId: product.id,
      downloadLinks: files.map(f => f.url),
      customFields: custom_fields,
    },
  });

  // Send delivery email
  await sendDeliveryEmail({
    to: customer.email,
    productName: product.name,
    downloadLinks: files,
    companyName: custom_fields.find(f => f.key === 'companyName')?.text?.value,
  });

  // Add to newsletter if opted in
  const newsletter = custom_fields.find(f => f.key === 'newsletter');
  if (newsletter?.checkbox?.value) {
    await addToNewsletter(customer.email);
  }
  break;
}
```

### Step 4: Download Page

```typescript
// app/download/page.tsx
export default async function DownloadPage({ searchParams }) {
  const checkoutId = searchParams.session;

  // Verify checkout is completed
  const response = await fetch(
    `${BASE_URL}/v1/checkouts?checkout_id=${checkoutId}`,
    {
      headers: { 'x-api-key': CREEM_API_KEY },
    }
  );

  const checkout = await response.json();

  if (checkout.status !== 'completed') {
    return <div>Purchase not found or not completed</div>;
  }

  const files = checkout.feature?.find(f => f.type === 'file')?.file?.files || [];

  return (
    <div>
      <h1>Thank you for your purchase!</h1>
      <h2>Your Downloads</h2>
      <ul>
        {files.map((file) => (
          <li key={file.id}>
            <a href={file.url} download>
              {file.file_name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 3. License Key System for Desktop Apps

For software requiring activation and device management.

### Architecture

```
User purchases → License key generated → User enters in app → Activation
                                                              ↓
                    App validates on startup ← Store instance ID locally
```

### Step 1: Product Setup

Create a product in the dashboard with:
- Enable "License Key" feature
- Set activation limit (e.g., 3 devices)
- Set expiration (or unlimited)

### Step 2: Desktop App Activation Flow

```typescript
// Desktop app - activation.ts
import Store from 'electron-store';

interface LicenseState {
  key: string;
  instanceId: string;
  expiresAt: string | null;
  activatedAt: string;
}

const store = new Store<{ license: LicenseState }>();

const CREEM_API = 'https://api.creem.io';
const API_KEY = process.env.CREEM_API_KEY;

export async function activateLicense(licenseKey: string): Promise<boolean> {
  // Generate unique instance name from machine
  const instanceName = await getMachineId(); // Use machine-id package

  const response = await fetch(`${CREEM_API}/v1/licenses/activate`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: licenseKey,
      instance_name: instanceName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 403) {
      throw new Error('Activation limit reached. Deactivate another device first.');
    }
    throw new Error(error.message || 'Activation failed');
  }

  const license = await response.json();

  // Store license locally
  store.set('license', {
    key: licenseKey,
    instanceId: license.instance.id,
    expiresAt: license.expires_at,
    activatedAt: new Date().toISOString(),
  });

  return true;
}

export async function validateLicense(): Promise<{
  valid: boolean;
  status: string;
  expiresAt: string | null;
}> {
  const storedLicense = store.get('license');

  if (!storedLicense) {
    return { valid: false, status: 'not_activated', expiresAt: null };
  }

  const response = await fetch(`${CREEM_API}/v1/licenses/validate`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: storedLicense.key,
      instance_id: storedLicense.instanceId,
    }),
  });

  if (!response.ok) {
    // Clear invalid license
    store.delete('license');
    return { valid: false, status: 'invalid', expiresAt: null };
  }

  const license = await response.json();

  return {
    valid: license.status === 'active',
    status: license.status,
    expiresAt: license.expires_at,
  };
}

export async function deactivateLicense(): Promise<boolean> {
  const storedLicense = store.get('license');

  if (!storedLicense) {
    return false;
  }

  const response = await fetch(`${CREEM_API}/v1/licenses/deactivate`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: storedLicense.key,
      instance_id: storedLicense.instanceId,
    }),
  });

  if (response.ok) {
    store.delete('license');
    return true;
  }

  return false;
}
```

### Step 3: App Startup Check

```typescript
// main.ts (Electron)
import { app, BrowserWindow, dialog } from 'electron';
import { validateLicense } from './activation';

async function createWindow() {
  // Validate license on startup
  const licenseStatus = await validateLicense();

  if (!licenseStatus.valid) {
    // Show activation window
    const activationWindow = new BrowserWindow({
      width: 400,
      height: 300,
      modal: true,
    });
    activationWindow.loadFile('activation.html');
    return;
  }

  // Check if expiring soon
  if (licenseStatus.expiresAt) {
    const expiresAt = new Date(licenseStatus.expiresAt);
    const daysUntilExpiry = Math.ceil(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 7) {
      dialog.showMessageBox({
        type: 'warning',
        title: 'License Expiring',
        message: `Your license expires in ${daysUntilExpiry} days. Please renew.`,
      });
    }
  }

  // Normal app startup
  const mainWindow = new BrowserWindow({ width: 1200, height: 800 });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
```

---

## 4. Seat-Based Team Billing

For B2B SaaS with per-user pricing.

### Architecture

```
Admin purchases seats → Members invited → Seat count tracked
                                          ↓
               Update seats via API ← Admin adds/removes members
```

### Step 1: Initial Purchase with Seats

```typescript
// Create checkout with seat count
const createTeamCheckout = async (seats: number, adminEmail: string) => {
  const response = await fetch(`${BASE_URL}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: 'prod_team_plan', // Per-seat product
      units: seats,
      customer: { email: adminEmail },
      success_url: `${APP_URL}/team/setup`,
      metadata: {
        initialSeats: seats,
      },
    }),
  });

  return response.json();
};
```

### Step 2: Track Team Members

```typescript
// Handle checkout completed - team setup
case 'checkout.completed': {
  const { subscription, customer, metadata } = event.object;
  const seats = event.object.units || 1;

  // Create team
  await db.team.create({
    data: {
      creemSubscriptionId: subscription.id,
      creemCustomerId: customer.id,
      adminEmail: customer.email,
      totalSeats: seats,
      usedSeats: 0, // Will be 1 after admin is added
    },
  });

  // Add admin as first member
  await db.teamMember.create({
    data: {
      teamId: team.id,
      email: customer.email,
      role: 'admin',
    },
  });

  await db.team.update({
    where: { id: team.id },
    data: { usedSeats: 1 },
  });
  break;
}
```

### Step 3: Update Seat Count

```typescript
// Update seats when team changes
export async function updateTeamSeats(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) throw new Error('Team not found');

  const currentMembers = team.members.length;

  if (currentMembers === team.totalSeats) {
    return; // No change needed
  }

  // Get subscription details first
  const subResponse = await fetch(
    `${BASE_URL}/v1/subscriptions?subscription_id=${team.creemSubscriptionId}`,
    {
      headers: { 'x-api-key': CREEM_API_KEY },
    }
  );

  const subscription = await subResponse.json();
  const itemId = subscription.items[0].id;

  // Update seat count in CREEM
  const response = await fetch(
    `${BASE_URL}/v1/subscriptions/${team.creemSubscriptionId}`,
    {
      method: 'POST',
      headers: {
        'x-api-key': CREEM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ id: itemId, units: currentMembers }],
        update_behavior: 'proration-charge-immediately',
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update seats');
  }

  // Update local record
  await db.team.update({
    where: { id: teamId },
    data: { totalSeats: currentMembers },
  });
}
```

### Step 4: Invite Team Members

```typescript
// API route to invite member
export async function POST(req: NextRequest) {
  const { teamId, email } = await req.json();

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (team.members.length >= team.totalSeats) {
    // Need to add more seats first
    return NextResponse.json({
      error: 'No seats available. Upgrade your plan to add more members.',
      requiresUpgrade: true,
    }, { status: 400 });
  }

  // Create invitation
  const invitation = await db.invitation.create({
    data: {
      teamId,
      email,
      token: generateToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Send invitation email
  await sendInvitationEmail(email, invitation.token);

  return NextResponse.json({ success: true });
}
```

---

## 5. Freemium with Upgrade Flow

Free tier with premium features unlocked via subscription.

### Step 1: Feature Gating Middleware

```typescript
// middleware/subscription.ts
import { NextRequest, NextResponse } from 'next/server';

const PREMIUM_ROUTES = [
  '/api/export',
  '/api/integrations',
  '/api/advanced',
];

const PREMIUM_LIMITS = {
  free: {
    projects: 3,
    storage: 100 * 1024 * 1024, // 100MB
    collaborators: 1,
  },
  pro: {
    projects: -1, // unlimited
    storage: 10 * 1024 * 1024 * 1024, // 10GB
    collaborators: 10,
  },
  enterprise: {
    projects: -1,
    storage: -1,
    collaborators: -1,
  },
};

export async function subscriptionMiddleware(req: NextRequest) {
  const session = await getSession(req);

  if (!session) {
    return NextResponse.redirect('/login');
  }

  const isPremiumRoute = PREMIUM_ROUTES.some(route =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (!isPremiumRoute) {
    return NextResponse.next();
  }

  const subscription = await getSubscription(session.userId);

  if (!subscription?.isActive) {
    return NextResponse.json(
      {
        error: 'Premium subscription required',
        upgrade_url: '/pricing',
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export function getLimits(plan: string) {
  return PREMIUM_LIMITS[plan] || PREMIUM_LIMITS.free;
}
```

### Step 2: Upgrade Prompts

```tsx
// components/UpgradePrompt.tsx
'use client';

import { useState } from 'react';

export function UpgradePrompt({
  feature,
  currentPlan,
}: {
  feature: string;
  currentPlan: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod_pro_plan' }),
    });
    const { checkoutUrl } = await response.json();
    window.location.href = checkoutUrl;
  };

  return (
    <div className="upgrade-prompt">
      <h3>Upgrade to Pro</h3>
      <p>{feature} requires a Pro subscription.</p>
      <ul>
        <li>Unlimited projects</li>
        <li>10GB storage</li>
        <li>Team collaboration</li>
        <li>Priority support</li>
      </ul>
      <button onClick={handleUpgrade} disabled={loading}>
        {loading ? 'Redirecting...' : 'Upgrade to Pro - $29/mo'}
      </button>
    </div>
  );
}
```

---

## 6. Affiliate/Referral Tracking

Track conversions from marketing campaigns or affiliates.

### Step 1: Pass Tracking Data

```typescript
// Checkout with tracking metadata
const createTrackedCheckout = async (
  productId: string,
  tracking: {
    referralCode?: string;
    utm_source?: string;
    utm_campaign?: string;
    affiliateId?: string;
  }
) => {
  const response = await fetch(`${BASE_URL}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: productId,
      metadata: {
        ...tracking,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  return response.json();
};
```

### Step 2: Track Conversions

```typescript
case 'checkout.completed': {
  const { metadata, customer, order } = event.object;

  // Log conversion
  await db.conversion.create({
    data: {
      customerId: customer.id,
      customerEmail: customer.email,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      referralCode: metadata?.referralCode,
      utmSource: metadata?.utm_source,
      utmCampaign: metadata?.utm_campaign,
      affiliateId: metadata?.affiliateId,
    },
  });

  // Credit affiliate
  if (metadata?.affiliateId) {
    await creditAffiliate(
      metadata.affiliateId,
      order.amount * 0.2 // 20% commission
    );
  }

  // Credit referrer
  if (metadata?.referralCode) {
    const referrer = await db.user.findUnique({
      where: { referralCode: metadata.referralCode },
    });
    if (referrer) {
      await creditReferrer(referrer.id, 500); // $5 credit
    }
  }
  break;
}
```

### Step 3: Landing Page Tracking

```tsx
// app/page.tsx
import { cookies } from 'next/headers';

export default function LandingPage({ searchParams }) {
  // Store tracking params in cookie
  const trackingData = {
    utm_source: searchParams.utm_source,
    utm_campaign: searchParams.utm_campaign,
    ref: searchParams.ref, // referral code
    aff: searchParams.aff, // affiliate ID
  };

  cookies().set('tracking', JSON.stringify(trackingData), {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return <LandingPageContent />;
}
```

```typescript
// API route reads tracking from cookie
export async function POST(req: NextRequest) {
  const trackingCookie = req.cookies.get('tracking');
  const tracking = trackingCookie ? JSON.parse(trackingCookie.value) : {};

  const checkout = await createTrackedCheckout(productId, {
    referralCode: tracking.ref,
    utm_source: tracking.utm_source,
    utm_campaign: tracking.utm_campaign,
    affiliateId: tracking.aff,
  });

  return NextResponse.json({ checkoutUrl: checkout.checkout_url });
}
```

---

## Best Practices Summary

1. **Always use webhooks** for production access control, not success URL redirects
2. **Store CREEM IDs** (customer_id, subscription_id) for later API calls
3. **Use metadata** to link checkouts to your internal user/order IDs
4. **Implement idempotency** to handle duplicate webhook deliveries
5. **Test in sandbox** before going live
6. **Log everything** for debugging and customer support
7. **Handle edge cases**: expired subscriptions, failed payments, refunds
8. **Keep secrets safe**: Use environment variables, never client-side
