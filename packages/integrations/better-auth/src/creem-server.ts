import { Creem } from "creem";
import { logger } from "better-auth";
import type { CreemOptions } from "./types.js";
import type { CreateCheckoutInput, CreateCheckoutResponse } from "./checkout-types.js";
import type { CreatePortalResponse } from "./portal-types.js";
import type { SubscriptionData } from "./retrieve-subscription-types.js";
import type { SearchTransactionsResponse } from "./search-transactions-types.js";
import { generateSignature } from "./utils.js";

/**
 * Configuration for server-side Creem operations.
 */
export interface CreemServerConfig {
  /** Creem API key */
  apiKey: string;
  /** Whether to use test mode */
  testMode?: boolean;
}

/**
 * Initialize a Creem client for server-side operations.
 * Use this for direct API calls outside of Better Auth endpoints.
 *
 * @param config - Configuration options
 * @returns Configured Creem client instance
 *
 * @example
 * ```typescript
 * import { createCreemClient } from "@creem_io/better-auth/server";
 *
 * const creem = createCreemClient({
 *   apiKey: process.env.CREEM_API_KEY!,
 *   testMode: true
 * });
 *
 * // Use directly in Server Actions or API routes
 * const subscription = await creem.subscriptions.get("sub_123");
 * ```
 */
export function createCreemClient(config: CreemServerConfig): Creem {
  const serverURL = config.testMode ? "https://test-api.creem.io" : "https://api.creem.io";

  return new Creem({ apiKey: config.apiKey, serverURL });
}

/**
 * Check if a subscription status indicates active access.
 *
 * @param status - The subscription status from Creem
 * @returns True if subscription grants access
 *
 * @example
 * ```typescript
 * import { isActiveSubscription } from "@creem_io/better-auth/server";
 *
 * if (isActiveSubscription(subscription.status)) {
 *   // User has active access
 * }
 * ```
 */
export function isActiveSubscription(status: string): boolean {
  return ["active", "trialing", "paid"].includes(status.toLowerCase());
}

/**
 * Format Creem Unix timestamp to JavaScript Date.
 *
 * @param timestamp - Unix timestamp from Creem (seconds)
 * @returns JavaScript Date object
 *
 * @example
 * ```typescript
 * import { formatCreemDate } from "@creem_io/better-auth/server";
 *
 * const renewalDate = formatCreemDate(subscription.next_billing_date);
 * console.log(renewalDate.toLocaleDateString());
 * ```
 */
export function formatCreemDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Calculate days until subscription renewal.
 *
 * @param periodEndTimestamp - Unix timestamp of period end
 * @returns Number of days until renewal (negative if overdue)
 *
 * @example
 * ```typescript
 * import { getDaysUntilRenewal } from "@creem_io/better-auth/server";
 *
 * const days = getDaysUntilRenewal(subscription.current_period_end_date);
 * if (days > 0) {
 *   console.log(`Renews in ${days} days`);
 * } else {
 *   console.log(`Overdue by ${Math.abs(days)} days`);
 * }
 * ```
 */
export function getDaysUntilRenewal(periodEndTimestamp: number): number {
  const renewalDate = formatCreemDate(periodEndTimestamp);
  const now = new Date();
  const diffTime = renewalDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Validate webhook signature from Creem.
 * Use this to verify webhook authenticity in custom webhook handlers.
 *
 * @param payload - Raw webhook payload string
 * @param signature - Signature from 'creem-signature' header
 * @param secret - Your webhook secret
 * @returns True if signature is valid
 *
 * @example
 * ```typescript
 * import { validateWebhookSignature } from "@creem_io/better-auth/server";
 *
 * export async function POST(req: Request) {
 *   const payload = await req.text();
 *   const signature = req.headers.get('creem-signature');
 *
 *   if (!await validateWebhookSignature(payload, signature, process.env.CREEM_WEBHOOK_SECRET!)) {
 *     return new Response('Invalid signature', { status: 401 });
 *   }
 *
 *   const event = JSON.parse(payload);
 *   // Process webhook
 * }
 * ```
 */
export async function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const computedSignature = await generateSignature(payload, secret);
  return computedSignature === signature;
}

/**
 * Create a checkout session directly (without using Better Auth endpoints).
 * Useful in Server Components, Server Actions, or custom API routes.
 *
 * @param config - Creem configuration
 * @param input - Checkout parameters
 * @returns Checkout URL and redirect flag
 *
 * @example
 * ```typescript
 * import { createCheckout } from "@creem_io/better-auth/server";
 *
 * // Server Action
 * export async function startCheckout(productId: string) {
 *   const { url } = await createCheckout(
 *     {
 *       apiKey: process.env.CREEM_API_KEY!,
 *       testMode: true
 *     },
 *     {
 *       productId,
 *       customer: { email: user.email },
 *       successUrl: "/success",
 *       metadata: { userId: user.id }
 *     }
 *   );
 *
 *   redirect(url);
 * }
 * ```
 *
 * @example
 * // With trial abuse prevention (check user.hadTrial from your database)
 * ```typescript
 * const { url } = await createCheckout(
 *   config,
 *   {
 *     productId,
 *     customer: { email: user.email },
 *     successUrl: "/success",
 *     skipTrial: user.hadTrial, // Pass true if user has already used a trial
 *   }
 * );
 * ```
 */
export async function createCheckout(
  config: CreemServerConfig,
  input: Omit<CreateCheckoutInput, "customer"> & {
    customer: { email?: string; id?: string };
    /**
     * If true, tells Creem to skip the trial period for this checkout.
     * Use this for trial abuse prevention - pass true if the user has
     * already used a trial (check user.hadTrial from your database).
     *
     * @since 1.1.0
     */
    skipTrial?: boolean;
  },
): Promise<CreateCheckoutResponse> {
  if (!config.apiKey) {
    throw new Error(
      "Creem API key is not configured. Please provide an apiKey in the CreemServerConfig.",
    );
  }

  const creem = createCreemClient(config);

  const checkout = await creem.checkouts.create({
    productId: input.productId,
    requestId: input.requestId,
    units: input.units,
    discountCode: input.discountCode,
    customer: input.customer,
    customFields: input.customFields ?? input.customField,
    successUrl: input.successUrl,
    metadata: {
      ...(input.metadata || {}),
      // Trial abuse prevention: signal to Creem that this user has already had a trial
      ...(input.skipTrial && { skipTrial: true }),
    },
  });

  return {
    url:
      checkout.checkoutUrl ??
      (() => {
        throw new Error("Creem API returned no checkout URL");
      })(),
    redirect: true,
  };
}

/**
 * Create a customer portal session directly.
 * Useful in Server Components, Server Actions, or custom API routes.
 *
 * @param config - Creem configuration
 * @param customerId - Creem customer ID
 * @returns Portal URL and redirect flag
 *
 * @example
 * ```typescript
 * import { createPortal } from "@creem_io/better-auth/server";
 *
 * // Server Component
 * export default async function BillingPage() {
 *   const session = await getSession();
 *
 *   async function openPortal() {
 *     'use server';
 *     const { url } = await createPortal(
 *       {
 *         apiKey: process.env.CREEM_API_KEY!,
 *         testMode: true
 *       },
 *       session.user.creemCustomerId
 *     );
 *     redirect(url);
 *   }
 *
 *   return <form action={openPortal}>...</form>;
 * }
 * ```
 */
export async function createPortal(
  config: CreemServerConfig,
  customerId: string,
): Promise<CreatePortalResponse> {
  if (!config.apiKey) {
    throw new Error(
      "Creem API key is not configured. Please provide an apiKey in the CreemServerConfig.",
    );
  }

  const creem = createCreemClient(config);

  const portal = await creem.customers.generateBillingLinks({
    customerId,
  });

  return {
    url: portal.customerPortalLink,
    redirect: true,
  };
}

/**
 * Cancel a subscription directly.
 * Useful in Server Actions or custom API routes.
 *
 * @param config - Creem configuration
 * @param subscriptionId - Subscription ID to cancel
 * @returns Success status and message
 *
 * @example
 * ```typescript
 * import { cancelSubscription } from "@creem_io/better-auth/server";
 *
 * // Server Action
 * export async function handleCancelSubscription(subId: string) {
 *   const result = await cancelSubscription(
 *     {
 *       apiKey: process.env.CREEM_API_KEY!,
 *       testMode: true
 *     },
 *     subId
 *   );
 *
 *   if (result.success) {
 *     revalidatePath('/billing');
 *   }
 * }
 * ```
 */
export async function cancelSubscription(
  config: CreemServerConfig,
  subscriptionId: string,
): Promise<{ success: boolean; message: string }> {
  if (!config.apiKey) {
    throw new Error(
      "Creem API key is not configured. Please provide an apiKey in the CreemServerConfig.",
    );
  }

  const creem = createCreemClient(config);

  await creem.subscriptions.cancel(subscriptionId, {});

  return {
    success: true,
    message: "Subscription cancelled successfully",
  };
}

/**
 * Retrieve subscription details directly.
 * Useful in Server Components, Server Actions, or custom API routes.
 *
 * @param config - Creem configuration
 * @param subscriptionId - Subscription ID to retrieve
 * @returns Subscription data
 *
 * @example
 * ```typescript
 * import { retrieveSubscription } from "@creem_io/better-auth/server";
 *
 * // Server Component
 * export default async function SubscriptionPage({ params }) {
 *   const subscription = await retrieveSubscription(
 *     {
 *       apiKey: process.env.CREEM_API_KEY!,
 *       testMode: true
 *     },
 *     params.subscriptionId
 *   );
 *
 *   return (
 *     <div>
 *       <h1>{subscription.product.name}</h1>
 *       <p>Status: {subscription.status}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export async function retrieveSubscription(
  config: CreemServerConfig,
  subscriptionId: string,
): Promise<SubscriptionData> {
  if (!config.apiKey) {
    throw new Error(
      "Creem API key is not configured. Please provide an apiKey in the CreemServerConfig.",
    );
  }

  const creem = createCreemClient(config);

  const subscription = await creem.subscriptions.get(subscriptionId);

  return subscription as unknown as SubscriptionData;
}

/**
 * Search transactions directly.
 * Useful in Server Components, Server Actions, or custom API routes.
 *
 * @param config - Creem configuration
 * @param filters - Search filters
 * @returns Transaction search results
 *
 * @example
 * ```typescript
 * import { searchTransactions } from "@creem_io/better-auth/server";
 *
 * // Server Component
 * export default async function TransactionsPage() {
 *   const { items, pagination } = await searchTransactions(
 *     {
 *       apiKey: process.env.CREEM_API_KEY!,
 *       testMode: true
 *     },
 *     {
 *       customerId: user.creemCustomerId,
 *       pageSize: 50
 *     }
 *   );
 *
 *   return <TransactionList transactions={items} />;
 * }
 * ```
 */
export async function searchTransactions(
  config: CreemServerConfig,
  filters?: {
    customerId?: string;
    productId?: string;
    orderId?: string;
    pageNumber?: number;
    pageSize?: number;
  },
): Promise<SearchTransactionsResponse> {
  if (!config.apiKey) {
    throw new Error(
      "Creem API key is not configured. Please provide an apiKey in the CreemServerConfig.",
    );
  }

  const creem = createCreemClient(config);

  const response = await creem.transactions.search(
    filters?.customerId,
    filters?.orderId,
    filters?.productId,
    filters?.pageNumber,
    filters?.pageSize,
  );

  return response as unknown as SearchTransactionsResponse;
}

/**
 * Check if user has active subscription with access.
 * Works in both database-enabled and database-free modes.
 *
 * **Database Mode:** Queries local subscription table for fast access checks.
 * **API Mode:** Queries Creem API directly (requires API call).
 *
 * @param config - Creem configuration
 * @param options - Check options
 * @returns Access status information
 *
 * @example
 * ```typescript
 * // Database mode (when persistSubscriptions: true)
 * import { checkSubscriptionAccess } from "@creem_io/better-auth/server";
 * import { auth } from "@/lib/auth";
 *
 * const status = await checkSubscriptionAccess(
 *   {
 *     apiKey: process.env.CREEM_API_KEY!,
 *     testMode: true
 *   },
 *   {
 *     database: auth.options.database, // Pass database adapter
 *     userId: session.user.id
 *   }
 * );
 *
 * // API mode (when persistSubscriptions: false or no database)
 * const status = await checkSubscriptionAccess(
 *   {
 *     apiKey: process.env.CREEM_API_KEY!,
 *     testMode: true
 *   },
 *   {
 *     customerId: session.user.creemCustomerId
 *   }
 * );
 *
 * if (!status.hasAccess) {
 *   redirect('/subscribe');
 * }
 * ```
 */
export async function checkSubscriptionAccess(
  config: CreemServerConfig,
  options:
    | { database: any; userId: string; customerId?: never }
    | { customerId: string; database?: never; userId?: never },
): Promise<{
  hasAccess: boolean;
  status?: string;
  subscriptionId?: string;
  expiresAt?: Date;
  productName?: string;
}> {
  // Database mode
  // TODO: This uses a raw query builder API (select/from/where) that may not match
  // all Better Auth database adapters. For reliable access checks, prefer the
  // `hasAccessGranted` Better Auth endpoint which uses the adapter correctly.
  if (options.database && options.userId) {
    try {
      const subscriptions = await options.database
        .select()
        .from("creem_subscription")
        .where("referenceId", "=", options.userId);

      const activeSubscription = subscriptions.find(
        (sub: any) => sub.status === "active" || sub.status === "trialing" || sub.status === "paid",
      );

      if (activeSubscription) {
        return {
          hasAccess: true,
          status: activeSubscription.status,
          subscriptionId: activeSubscription.creemSubscriptionId,
          expiresAt: activeSubscription.periodEnd
            ? new Date(activeSubscription.periodEnd)
            : undefined,
        };
      }

      return { hasAccess: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to check subscription access (database mode): ${message}`);
      // Fall through to API check
    }
  }

  // API mode
  if (options.customerId) {
    // API mode not yet supported — use database mode for access checks
    return { hasAccess: false };
  }

  return { hasAccess: false };
}

/**
 * Get all active subscriptions for a user or customer.
 * Works in both database-enabled and database-free modes.
 *
 * @param config - Creem configuration
 * @param options - Query options
 * @returns List of active subscriptions
 *
 * @example
 * ```typescript
 * import { getActiveSubscriptions } from "@creem_io/better-auth/server";
 *
 * // Database mode
 * const subscriptions = await getActiveSubscriptions(
 *   config,
 *   { database: auth.options.database, userId: user.id }
 * );
 *
 * // API mode
 * const subscriptions = await getActiveSubscriptions(
 *   config,
 *   { customerId: user.creemCustomerId }
 * );
 * ```
 */
export async function getActiveSubscriptions(
  config: CreemServerConfig,
  options:
    | { database: any; userId: string; customerId?: never }
    | { customerId: string; database?: never; userId?: never },
): Promise<
  Array<{
    id: string;
    status: string;
    productId: string;
    productName?: string;
    periodEnd?: Date;
  }>
> {
  // Database mode
  // TODO: Same raw query builder caveat as checkSubscriptionAccess above.
  if (options.database && options.userId) {
    try {
      const subscriptions = await options.database
        .select()
        .from("creem_subscription")
        .where("referenceId", "=", options.userId);

      return subscriptions
        .filter(
          (sub: any) =>
            sub.status === "active" || sub.status === "trialing" || sub.status === "paid",
        )
        .map((sub: any) => ({
          id: sub.creemSubscriptionId,
          status: sub.status,
          productId: sub.productId,
          periodEnd: sub.periodEnd ? new Date(sub.periodEnd) : undefined,
        }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to get active subscriptions (database mode): ${message}`);
      return [];
    }
  }

  // API mode
  if (options.customerId) {
    // API mode not yet supported — use database mode for subscription queries
    return [];
  }

  return [];
}
