import { redact } from "../../errors";
import type { FetchFailure } from "../lemon-squeezy/source";

/**
 * The Paddle side of `creem migrate paddle`: the Paddle Billing types the
 * migrator reads, and a read-only client. The API key stays on the merchant's
 * machine; it is only ever sent to Paddle's API host of the chosen environment.
 *
 * Field notes, confirmed against a Paddle sandbox (2026-11-27) and the Paddle
 * Billing API reference:
 * - Amounts are strings in minor units (`"1500"`); a percentage discount's
 *   amount is the percentage (`"12.5"`).
 * - Lists return active objects only unless `status` asks for more, and page
 *   with a cursor: `meta.pagination.next` is set on the last page too, so
 *   `has_more` says whether to follow it.
 * - A price's quantity limits default to 1–100.
 * - A `custom` price, product or discount is non-catalog (made for one
 *   transaction), not part of the catalog.
 */

export const PADDLE_HOSTS = {
  production: "https://api.paddle.com",
  sandbox: "https://sandbox-api.paddle.com",
} as const;
export type PaddleEnvironment = keyof typeof PADDLE_HOSTS;

export interface PaddleMoney {
  amount: string;
  currency_code: string;
}
export interface PaddleInterval {
  interval: string;
  frequency: number;
}
export interface PaddleProduct {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tax_category: string;
  custom_data: Record<string, unknown> | null;
  status: string;
}
export interface PaddlePrice {
  id: string;
  product_id: string;
  type: string;
  description: string;
  name: string | null;
  billing_cycle: PaddleInterval | null;
  trial_period: PaddleInterval | null;
  unit_price: PaddleMoney;
  /** `internal` (tax included), `external` (added), `location` or `account_setting`. */
  tax_mode?: string;
  unit_price_overrides: { country_codes: string[]; unit_price: PaddleMoney }[];
  quantity: { minimum: number; maximum: number } | null;
  custom_data: Record<string, unknown> | null;
  status: string;
}
export interface PaddleDiscount {
  id: string;
  status: string;
  description: string;
  code: string | null;
  type: string;
  mode?: string;
  amount: string;
  currency_code: string | null;
  recur: boolean;
  maximum_recurring_intervals: number | null;
  usage_limit: number | null;
  times_used: number;
  restrict_to: string[] | null;
  expires_at: string | null;
  custom_data: Record<string, unknown> | null;
}

export interface PaddleObjects {
  environment: PaddleEnvironment;
  products: PaddleProduct[];
  prices: PaddlePrice[];
  discounts: PaddleDiscount[];
  /** The product or price list couldn't be read: no price is known to be gone from Paddle. */
  catalogUnread?: boolean;
  /** The discount list couldn't be read: no discount is known to be gone from Paddle. */
  discountsUnread?: boolean;
}

/** Paddle refused the request; `status` is its HTTP status. */
export class PaddleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PaddleApiError";
  }
}

const isRetryable = (status: number) => status === 429 || (status >= 500 && status <= 599);

export class PaddleClient {
  readonly environment: PaddleEnvironment;
  private readonly fetcher: typeof fetch;
  private readonly delayMs: number;
  private readonly attempts: number;
  private readonly maxPages: number;

  constructor(
    private readonly apiKey: string,
    options: {
      environment: PaddleEnvironment;
      fetch?: typeof fetch;
      delayMs?: number;
      attempts?: number;
      /** Pages per list before the read gives up (200 objects a page). */
      maxPages?: number;
    },
  ) {
    this.environment = options.environment;
    this.fetcher = options.fetch ?? ((...args) => fetch(...args));
    // Paddle allows 240 requests a minute per IP.
    this.delayMs = options.delayMs ?? 250;
    this.attempts = options.attempts ?? 3;
    this.maxPages = options.maxPages ?? 1000;
  }

  private async pause(ms: number) {
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** A GET with retries after a 429 or a 5xx. */
  private async get(url: string): Promise<unknown> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        const response = await this.fetcher(url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
        });
        if (response.ok) return await response.json();
        const text = redact(await response.text(), [this.apiKey]);
        lastError = new PaddleApiError(
          response.status,
          `Paddle API error (${response.status}): ${text}`,
        );
        if (!isRetryable(response.status)) break;
      } catch (error) {
        lastError = new Error(
          redact(error instanceof Error ? error.message : String(error), [this.apiKey]),
        );
      }
      if (attempt < this.attempts) await this.pause(Math.max(this.delayMs, 1) * 2 ** attempt);
    }
    throw lastError ?? new Error("Paddle request failed");
  }

  /** Every page of a list, active and archived, following `meta.pagination.next`. */
  async list<T>(path: string): Promise<T[]> {
    const base = PADDLE_HOSTS[this.environment];
    const first = new URL(`${base}${path}`);
    first.searchParams.set("status", "active,archived");
    first.searchParams.set("per_page", "200");
    first.searchParams.set("order_by", "id[ASC]");
    const items: T[] = [];
    // A list that can't be read to its end throws: the run then counts it as
    // unread and writes nothing, instead of taking a part for the whole.
    const incomplete = (why: string) => new Error(`${path} is incomplete: ${why}`);
    const seen = new Set<string>();
    for (let url = first.toString(); ; ) {
      if (seen.size === this.maxPages)
        throw incomplete(`Paddle has more than ${this.maxPages} pages of it.`);
      seen.add(url);
      const page = (await this.get(url)) as {
        data: T[];
        meta?: { pagination?: { next?: string | null; has_more?: boolean } };
      };
      items.push(...page.data);
      const pagination = page.meta?.pagination;
      if (!pagination?.has_more) return items;
      if (!pagination.next) throw incomplete("Paddle says there is more, but sent no cursor.");
      const next = new URL(pagination.next, base);
      // The cursor stays on Paddle's host, so the key goes nowhere else.
      if (next.origin !== new URL(base).origin)
        throw incomplete(`its next page is on ${next.origin}, not ${base}, and isn't read.`);
      if (seen.has(next.toString()))
        throw incomplete("Paddle sent the cursor of the same page again.");
      url = next.toString();
      await this.pause(this.delayMs);
    }
  }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Reads the Paddle catalog: products, prices and discounts, active and
 * archived. Customers, subscriptions, transactions and notification settings
 * are never fetched. A refused key (401/403) throws; any other list that can't
 * be read is a fetch failure, and the run writes nothing.
 */
export async function fetchPaddleCatalog(
  client: PaddleClient,
): Promise<{ objects: PaddleObjects; failures: FetchFailure[] }> {
  const failures: FetchFailure[] = [];
  const objects: PaddleObjects = {
    environment: client.environment,
    products: [],
    prices: [],
    discounts: [],
  };
  for (const kind of ["products", "prices", "discounts"] as const) {
    try {
      objects[kind] = (await client.list(`/${kind}`)) as never;
    } catch (error) {
      if (error instanceof PaddleApiError && (error.status === 401 || error.status === 403))
        throw error;
      failures.push({ kind, message: errorMessage(error) });
      if (kind === "discounts") objects.discountsUnread = true;
      else objects.catalogUnread = true;
    }
  }
  return { objects, failures };
}
