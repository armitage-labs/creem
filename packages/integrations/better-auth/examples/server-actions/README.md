# Server Actions Example

This directory will contain examples of using Creem with Next.js Server Actions.

## Coming Soon

Examples will include:

- Creating checkout sessions from Server Actions
- Managing subscriptions server-side
- Checking access in Server Actions
- Handling portal redirects
- Transaction queries

## Quick Preview

```typescript
// app/actions.ts
"use server";

import { createCheckout, checkSubscriptionAccess } from "@creem_io/better-auth/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function startCheckout(productId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  const { url } = await createCheckout(
    { apiKey: process.env.CREEM_API_KEY!, testMode: true },
    {
      productId,
      customer: { email: session.user.email },
      successUrl: "/success",
      metadata: { userId: session.user.id }
    }
  );
  
  redirect(url);
}

export async function checkAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user) {
    return { hasAccess: false };
  }
  
  return await checkSubscriptionAccess(
    { apiKey: process.env.CREEM_API_KEY!, testMode: true },
    { database: auth.options.database, userId: session.user.id }
  );
}
```

## Contributing

Want to help create this example? Check out [CONTRIBUTING.md](../../CONTRIBUTING.md)!

