import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { redact } from "../../errors";

/**
 * The Lemon Squeezy side of `creem migrate lemon-squeezy`: the LS API types the
 * migrator reads, and a read-only client. The LS API key stays on the
 * merchant's machine; it is only ever sent to api.lemonsqueezy.com.
 *
 * Field notes, confirmed against an LS test store (2026-11-19) and the LS API
 * reference:
 * - Variants carry no SKU or lookup key, so LS ids are the keys.
 * - Pricing lives in Price objects; a variant's current one is its
 *   `price-model` relationship. The variant's own price fields are deprecated
 *   and only used when no price model came back.
 * - `usage_aggregation` on the price is set for usage-based (metered) prices.
 * - A `pending` variant is the hidden default of a product that has other
 *   variants.
 * - A discount's `variants` relationship lists the variants it is limited to.
 *   This one is from the LS API reference only: the test store has no limited
 *   discount, so a hand-written fixture covers it.
 * - A file's `download_url` is a signed URL that expires after an hour; it is
 *   fetched without the API key.
 */

export interface LSResource<A, R = Record<string, LSRelationship>> {
  type: string;
  id: string;
  attributes: A;
  relationships?: R;
}
export interface LSRelationship {
  data?: { type: string; id: string } | { type: string; id: string }[] | null;
}

export type LSStore = LSResource<{
  name: string;
  slug: string;
  domain?: string;
  currency: string;
}>;
export type LSProduct = LSResource<{
  store_id: number;
  name: string;
  description: string | null;
  status: string;
  thumb_url?: string | null;
  large_thumb_url?: string | null;
}>;
export type LSVariant = LSResource<{
  product_id: number;
  name: string;
  description?: string | null;
  price: number;
  is_subscription: boolean;
  interval?: string | null;
  interval_count?: number | null;
  has_free_trial: boolean;
  trial_interval?: string | null;
  trial_interval_count?: number | null;
  pay_what_you_want: boolean;
  min_price?: number | null;
  suggested_price?: number | null;
  has_license_keys: boolean;
  license_activation_limit?: number | null;
  is_license_limit_unlimited: boolean;
  license_length_value?: number | null;
  license_length_unit?: string | null;
  is_license_length_unlimited: boolean;
  sort: number;
  status: string;
}>;
export type LSPrice = LSResource<{
  variant_id: number;
  category: string;
  scheme: string;
  usage_aggregation: string | null;
  unit_price: number | null;
  unit_price_decimal: string | null;
  setup_fee_enabled: boolean | null;
  setup_fee: number | null;
  renewal_interval_unit: string | null;
  renewal_interval_quantity: number | null;
  trial_interval_unit: string | null;
  trial_interval_quantity: number | null;
  min_price: number | null;
  suggested_price: number | null;
  tax_code: string | null;
}>;
export type LSFile = LSResource<{
  variant_id: number;
  identifier: string;
  name: string;
  extension: string;
  download_url: string;
  size: number;
  status: string;
}>;
export type LSDiscount = LSResource<{
  store_id: number;
  name: string;
  code: string;
  amount: number;
  amount_type: "percent" | "fixed";
  is_limited_to_products: boolean;
  is_limited_redemptions: boolean;
  max_redemptions?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  duration: "once" | "repeating" | "forever";
  duration_in_months?: number | null;
  status: string;
}>;

/** A downloaded LS file: its base64 SHA-256 (as `POST /v1/files` takes it), size and local copy. */
export interface FileDigest {
  sha256: string;
  size: number;
  contentType: string;
  path: string;
}

export interface LemonSqueezyObjects {
  store: LSStore;
  products: LSProduct[];
  variants: LSVariant[];
  prices: LSPrice[];
  files: LSFile[];
  fileDigests: Record<string, FileDigest>;
  /** Files whose download failed, by file id: each is skipped on its own. */
  fileFailures: Record<string, string>;
  discounts: LSDiscount[];
  discountsExcluded: boolean;
  /**
   * Redemptions LS has used, by id, for each limited discount. LS's
   * `max_redemptions` is a lifetime cap and Creem counts from zero, so only
   * what's left carries over. A missing count is a fetch failure.
   */
  discountRedemptions: Record<string, number>;
  /** The discount list couldn't be read: no discount is known to be gone from LS. */
  discountsUnread?: boolean;
}

export interface FetchFailure {
  kind: string;
  message: string;
}

interface JsonApiPage<T> {
  data: T[];
  included?: LSResource<unknown>[];
  links?: { next?: string | null };
  meta?: { page?: { total?: unknown } };
}

const CONTENT_TYPES: Record<string, string> = {
  zip: "application/zip",
  pdf: "application/pdf",
  epub: "application/epub+zip",
  mobi: "application/x-mobipocket-ebook",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  dmg: "application/x-apple-diskimage",
  exe: "application/vnd.microsoft.portable-executable",
  gz: "application/gzip",
  tar: "application/x-tar",
};
export function contentTypeFor(extension: string): string {
  return CONTENT_TYPES[extension.toLowerCase()] ?? "application/octet-stream";
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export class LemonSqueezyClient {
  private readonly baseUrl = "https://api.lemonsqueezy.com/v1";
  private readonly fetcher: typeof fetch;
  private readonly delayMs: number;
  private readonly attempts: number;

  constructor(
    private readonly apiKey: string,
    options: { fetch?: typeof fetch; delayMs?: number; attempts?: number } = {},
  ) {
    this.fetcher = options.fetch ?? ((...args) => fetch(...args));
    // LS allows 300 requests a minute.
    this.delayMs = options.delayMs ?? 200;
    this.attempts = options.attempts ?? 3;
  }

  private async pause(ms: number) {
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** A GET with retries; `withKey: false` leaves the API key out (signed URLs). */
  private async get(url: string, accept: string, withKey = true): Promise<Response> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        const response = await this.fetcher(url, {
          method: "GET",
          headers: withKey
            ? { Accept: accept, Authorization: `Bearer ${this.apiKey}` }
            : { Accept: accept },
        });
        if (response.ok) return response;
        const text = redact(await response.text(), [this.apiKey]);
        lastError = new Error(`Lemon Squeezy API error (${response.status}): ${text}`);
        if (!isRetryable(response.status)) break;
      } catch (error) {
        lastError = new Error(
          redact(error instanceof Error ? error.message : String(error), [this.apiKey]),
        );
      }
      if (attempt < this.attempts) await this.pause(Math.max(this.delayMs, 1) * 2 ** attempt);
    }
    throw lastError ?? new Error("Lemon Squeezy request failed");
  }

  /** Every page of a JSON:API list, with its `included` resources. */
  async list<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<{ data: T[]; included: LSResource<unknown>[] }> {
    const data: T[] = [];
    const included: LSResource<unknown>[] = [];
    for (let page = 1; ; page++) {
      const url = new URL(`${this.baseUrl}${path}`);
      url.searchParams.set("page[number]", String(page));
      url.searchParams.set("page[size]", "100");
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const response = await this.get(url.toString(), "application/vnd.api+json");
      const body = (await response.json()) as JsonApiPage<T>;
      data.push(...body.data);
      included.push(...(body.included ?? []));
      if (body.links?.next == null) return { data, included };
      await this.pause(this.delayMs);
    }
  }

  /** How many resources a JSON:API list has, from one page of size 1. */
  async count(path: string, params: Record<string, string>): Promise<number> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("page[number]", "1");
    url.searchParams.set("page[size]", "1");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.get(url.toString(), "application/vnd.api+json");
    const total = ((await response.json()) as JsonApiPage<unknown>).meta?.page?.total;
    if (typeof total !== "number" || !Number.isInteger(total) || total < 0)
      throw new Error(`Lemon Squeezy returned no count for ${path}`);
    return total;
  }

  async stores(): Promise<LSStore[]> {
    return (await this.list<LSStore>("/stores")).data;
  }

  /**
   * Downloads a file from its signed URL to `path` and hashes it on the way.
   * The URL comes from API data, so the API key is never sent with it.
   */
  async download(url: string, path: string): Promise<{ sha256: string; size: number }> {
    const response = await this.get(url, "*/*", false);
    if (!response.body) throw new Error("Lemon Squeezy file download returned no body");
    const hash = createHash("sha256");
    const out = createWriteStream(path);
    let size = 0;
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        hash.update(chunk);
        size += chunk.length;
        if (!out.write(chunk))
          await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        out.end((error?: Error | null) => (error ? reject(error) : resolve())),
      );
    }
    return { sha256: hash.digest("base64"), size };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads the catalog of one LS store: products, their variants with price
 * models and files, and (unless excluded) discounts with their variants and,
 * for a limited one, its used redemption count. File
 * bytes are downloaded into `downloadDir` and hashed. Customers, subscriptions
 * and orders are never fetched.
 */
export async function fetchLemonSqueezyCatalog(
  client: LemonSqueezyClient,
  options: { storeId: string; excludeDiscounts: boolean; downloadDir: string; store?: LSStore },
): Promise<{ objects: LemonSqueezyObjects; failures: FetchFailure[] }> {
  const failures: FetchFailure[] = [];
  const store =
    options.store ?? (await client.stores()).find((candidate) => candidate.id === options.storeId);
  if (!store) throw new Error(`Lemon Squeezy store ${options.storeId} was not found`);
  const objects: LemonSqueezyObjects = {
    store,
    products: [],
    variants: [],
    prices: [],
    files: [],
    fileDigests: {},
    fileFailures: {},
    discounts: [],
    discountsExcluded: options.excludeDiscounts,
    discountRedemptions: {},
  };
  try {
    objects.products = (
      await client.list<LSProduct>("/products", { "filter[store_id]": options.storeId })
    ).data;
  } catch (error) {
    failures.push({ kind: "products", message: errorMessage(error) });
  }
  for (const product of objects.products) {
    try {
      const { data, included } = await client.list<LSVariant>("/variants", {
        "filter[product_id]": product.id,
        include: "price-model,files",
      });
      objects.variants.push(...data);
      for (const resource of included) {
        if (resource.type === "prices") objects.prices.push(resource as LSPrice);
        if (resource.type === "files") objects.files.push(resource as LSFile);
      }
    } catch (error) {
      failures.push({ kind: `variants of product ${product.id}`, message: errorMessage(error) });
    }
  }
  if (!options.excludeDiscounts) {
    try {
      objects.discounts = (
        await client.list<LSDiscount>("/discounts", {
          "filter[store_id]": options.storeId,
          include: "variants",
        })
      ).data;
    } catch (error) {
      failures.push({ kind: "discounts", message: errorMessage(error) });
      objects.discountsUnread = true;
    }
    // Only the page meta's total is read: a redemption row carries order data.
    for (const discount of objects.discounts) {
      const a = discount.attributes;
      // A draft or expired code is skipped anyway, so its count isn't needed.
      const expired = a.expires_at != null && new Date(a.expires_at).getTime() <= Date.now();
      if (!a.is_limited_redemptions || a.status !== "published" || expired) continue;
      try {
        objects.discountRedemptions[discount.id] = await client.count("/discount-redemptions", {
          "filter[discount_id]": discount.id,
        });
      } catch (error) {
        failures.push({
          kind: `redemptions of discount ${discount.id}`,
          message: errorMessage(error),
        });
      }
    }
  }
  for (const file of objects.files) {
    if (file.attributes.status !== "published") continue;
    try {
      const path = join(options.downloadDir, `${file.id}-${file.attributes.identifier}`);
      const digest = await client.download(file.attributes.download_url, path);
      objects.fileDigests[file.id] = {
        ...digest,
        contentType: contentTypeFor(file.attributes.extension),
        path,
      };
    } catch (error) {
      // One file that can't be downloaded skips that file, not the run.
      objects.fileFailures[file.id] = errorMessage(error);
    }
  }
  return { objects, failures };
}
