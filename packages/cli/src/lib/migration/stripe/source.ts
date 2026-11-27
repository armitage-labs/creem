import Stripe from "stripe";

/**
 * The read-only Stripe client of `creem migrate stripe`. It reads with the
 * official SDK (its types and auto-pagination), over `fetch`, and sends the
 * key to api.stripe.com only. Nothing here writes to Stripe.
 */

export interface StripeAccount {
  id: string;
  name: string;
  /** The account's default currency, uppercase; empty when the key may not read the account. */
  currency: string;
}

export interface StripeObjects {
  account: StripeAccount;
  products: Stripe.Product[];
  /** With `currency_options`, which names the USD and EUR amounts of another currency. */
  prices: Stripe.Price[];
  meters: Stripe.Billing.Meter[];
  /** How many webhook endpoints the account has; `null` when the key may not read them. */
  webhookEndpoints: number | null;
}

export interface FetchFailure {
  kind: string;
  message: string;
}

const PAGE_SIZE = 100;

export function stripeClient(
  key: string,
  options: { fetch?: typeof fetch; maxNetworkRetries?: number } = {},
): Stripe {
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(options.fetch ?? globalThis.fetch),
    // 429, 5xx and network errors are retried with backoff (reads only).
    maxNetworkRetries: options.maxNetworkRetries ?? 3,
    appInfo: { name: "creem-cli" },
  });
}

const isPermissionError = (error: unknown) =>
  error instanceof Stripe.errors.StripeError &&
  (error.statusCode === 403 || error.type === "StripePermissionError");

const isAuthError = (error: unknown) =>
  error instanceof Stripe.errors.StripeError && error.type === "StripeAuthenticationError";

async function readAll<T>(list: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of list) items.push(item);
  return items;
}

/**
 * Reads what the migrator maps: the account, products, prices (active only,
 * unless `includeArchived`), active Billing Meters, and the number of webhook
 * endpoints. A refused key throws Stripe's authentication error; any other
 * list that can't be read is a fetch failure, and the run writes nothing.
 */
export async function fetchStripeCatalog(
  stripe: Stripe,
  options: { includeArchived?: boolean } = {},
): Promise<{ objects: StripeObjects; failures: FetchFailure[] }> {
  let account: StripeAccount = { id: "", name: "", currency: "" };
  try {
    const read = await stripe.accounts.retrieveCurrent();
    account = {
      id: read.id,
      name: read.settings?.dashboard?.display_name ?? read.business_profile?.name ?? "",
      currency: (read.default_currency ?? "").toUpperCase(),
    };
  } catch (error) {
    if (!isPermissionError(error)) throw error;
  }

  const failures: FetchFailure[] = [];
  const active = options.includeArchived ? {} : { active: true };
  const list = async <T>(kind: string, read: () => AsyncIterable<T>): Promise<T[]> => {
    try {
      return await readAll(read());
    } catch (error) {
      if (isAuthError(error)) throw error;
      failures.push({ kind, message: error instanceof Error ? error.message : String(error) });
      return [];
    }
  };
  const products = await list("products", () =>
    stripe.products.list({ limit: PAGE_SIZE, ...active }),
  );
  const prices = await list("prices", () =>
    stripe.prices.list({ limit: PAGE_SIZE, ...active, expand: ["data.currency_options"] }),
  );
  const meters = await list("meters", () =>
    stripe.billing.meters.list({ limit: PAGE_SIZE, status: "active" }),
  );
  let webhookEndpoints: number | null = null;
  try {
    webhookEndpoints = (await readAll(stripe.webhookEndpoints.list({ limit: PAGE_SIZE }))).length;
  } catch (error) {
    // Reading them is optional: the guide's minimal key may leave them out.
    if (isAuthError(error)) throw error;
  }
  return { objects: { account, products, prices, meters, webhookEndpoints }, failures };
}
