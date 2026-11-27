import { createRequire } from "node:module";
import type Stripe from "stripe";

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

const CLAUDE_CODE_VARIABLES = ["CLAUDECODE", "CLAUDE_CODE_CHILD_SESSION"] as const;

/**
 * Runs `load` with `CLAUDECODE` and `CLAUDE_CODE_CHILD_SESSION` hidden. The
 * Stripe SDK writes a Claude Code plugin hint to stderr when it loads with
 * either set (stripe-node #2805); the CLI's stderr carries only its own output.
 */
export function withoutClaudeCodeHint<T>(load: () => T): T {
  const saved = CLAUDE_CODE_VARIABLES.filter((name) => name in process.env).map(
    (name) => [name, process.env[name]] as const,
  );
  for (const [name] of saved) delete process.env[name];
  try {
    return load();
  } finally {
    for (const [name, value] of saved) process.env[name] = value;
  }
}

let sdk: typeof Stripe | undefined;
/** The SDK, loaded on first use: only `creem migrate stripe` loads it. */
function loadSdk(): typeof Stripe {
  sdk ??= withoutClaudeCodeHint(() => createRequire(__filename)("stripe") as typeof Stripe);
  return sdk;
}

export function stripeClient(
  key: string,
  options: { fetch?: typeof fetch; maxNetworkRetries?: number } = {},
): Stripe {
  const StripeSdk = loadSdk();
  return new StripeSdk(key, {
    httpClient: StripeSdk.createFetchHttpClient(options.fetch ?? globalThis.fetch),
    // 429, 5xx and network errors are retried with backoff (reads only).
    maxNetworkRetries: options.maxNetworkRetries ?? 3,
    appInfo: { name: "creem-cli" },
  });
}

const stripeError = (error: unknown) =>
  sdk && error instanceof sdk.errors.StripeError ? error : undefined;

const isPermissionError = (error: unknown) => {
  const e = stripeError(error);
  return Boolean(e && (e.statusCode === 403 || e.type === "StripePermissionError"));
};

/** Stripe refused the key. */
export const isAuthError = (error: unknown) =>
  stripeError(error)?.type === "StripeAuthenticationError";

/** Stripe couldn't be reached. */
export const isConnectionError = (error: unknown) =>
  stripeError(error)?.type === "StripeConnectionError";

/** A Stripe key as Stripe's error messages quote it, whole or masked (`rk_live_51Ab…***…1234`). */
const STRIPE_KEY_SHAPE = /\b(rk|sk)_(live|test)_[A-Za-z0-9*…]+/g;

/** A Stripe error message without the supplied keys, or anything shaped like a Stripe key. */
export function redactStripe(message: string, secrets: readonly string[] = []): string {
  for (const secret of secrets) if (secret) message = message.split(secret).join("[REDACTED]");
  return message.replace(STRIPE_KEY_SHAPE, "[REDACTED]");
}

async function readAll<T>(list: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of list) items.push(item);
  return items;
}

/**
 * Reads what the migrator maps: the account, products, prices (active only,
 * unless `includeArchived`), active Billing Meters, and the number of webhook
 * endpoints. A refused key throws Stripe's authentication error; any other
 * list that can't be read is a fetch failure, and the run writes nothing. A
 * failure's message names neither `secrets` nor anything shaped like a key.
 */
export async function fetchStripeCatalog(
  stripe: Stripe,
  options: { includeArchived?: boolean; secrets?: readonly string[] } = {},
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
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ kind, message: redactStripe(message, options.secrets) });
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
