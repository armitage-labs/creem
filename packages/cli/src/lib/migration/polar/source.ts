import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { redact } from "../../errors";
import type { FileDigest, FetchFailure } from "../lemon-squeezy/source";
import { issue } from "../plan";
import type { MigrationIssue } from "../report";

/**
 * The Polar side of `creem migrate polar`: the Polar API types the migrator
 * reads, and a read-only client. The organization access token stays on the
 * merchant's machine; it is only ever sent to the Polar API host.
 *
 * Field notes (a Polar sandbox org, API 2026-10, 2026-11-27): objects have no
 * lookup key, so Polar ids are the keys. A legacy product has no interval and
 * one recurring price per interval (`legacy: true`). Free is a `fixed` price
 * of 0 (`amount_type: "free"` on old products). A product sold in several
 * currencies has a price per currency, always including the organization's
 * default. Meter filters name event metadata keys without `metadata.`; `name`
 * is the event name. The product list includes archived products.
 */

export interface PolarOrganization {
  id: string;
  name: string;
  default_presentment_currency?: string | null;
}

export interface PolarFilterClause {
  property: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "not_like";
  value: string | number | boolean;
}
export interface PolarFilter {
  conjunction: "and" | "or";
  clauses: (PolarFilterClause | PolarFilter)[];
}
export interface PolarMeter {
  id: string;
  name: string;
  unit?: "scalar" | "token" | "custom" | null;
  custom_label?: string | null;
  filter: PolarFilter;
  aggregation:
    | { func: "count" }
    | { func: "sum" | "max" | "min" | "avg" | "unique"; property: string };
  archived_at?: string | null;
}

export interface PolarPrice {
  id: string;
  amount_type: string;
  price_currency: string;
  is_archived: boolean;
  product_id: string;
  /** Legacy prices carry their own interval. */
  legacy?: boolean;
  recurring_interval?: string | null;
  price_amount?: number;
  minimum_amount?: number;
  preset_amount?: number | null;
  /** Metered prices: per unit in cents, as a decimal string. */
  unit_amount?: string;
  cap_amount?: number | null;
  meter_id?: string;
}

export interface PolarBenefit {
  id: string;
  type: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface PolarProduct {
  id: string;
  name: string;
  description: string | null;
  visibility?: string;
  recurring_interval: string | null;
  recurring_interval_count?: number | null;
  trial_interval?: string | null;
  trial_interval_count?: number | null;
  meter_interval?: string | null;
  meter_interval_count?: number | null;
  is_archived: boolean;
  prices: PolarPrice[];
  benefits: PolarBenefit[];
  medias?: unknown[];
  attached_custom_fields?: unknown[];
}

export interface PolarDiscount {
  id: string;
  name: string;
  code: string | null;
  type: "percentage" | "fixed";
  basis_points?: number;
  amount?: number;
  currency?: string;
  duration: "once" | "forever" | "repeating";
  duration_in_months?: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_customer?: number | null;
  redemptions_count: number;
  products: { id: string }[];
}

/** A downloadable file of a `downloadables` benefit (`GET /v1/files/`). */
export interface PolarFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  checksum_sha256_base64: string | null;
  is_uploaded: boolean;
}

export interface PolarObjects {
  organization: PolarOrganization;
  products: PolarProduct[];
  meters: PolarMeter[];
  discounts: PolarDiscount[];
  /** The files the products' downloadables benefits name. */
  files: PolarFile[];
  /** Verified local copies of those files (`--polar-files-dir`), by Polar file id. */
  fileDigests: Record<string, FileDigest>;
  /** Why a file has no verified local copy, by Polar file id. */
  fileProblems: Record<string, MigrationIssue>;
}

export const POLAR_SERVERS = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
} as const;
export type PolarServer = keyof typeof POLAR_SERVERS;

interface Page<T> {
  items: T[];
  pagination?: { max_page?: number };
}

export class PolarClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly delayMs: number;
  private readonly attempts: number;

  constructor(
    private readonly token: string,
    options: {
      server?: PolarServer;
      fetch?: typeof fetch;
      delayMs?: number;
      attempts?: number;
    } = {},
  ) {
    this.baseUrl = POLAR_SERVERS[options.server ?? "production"];
    this.fetcher = options.fetch ?? ((...args) => fetch(...args));
    this.delayMs = options.delayMs ?? 500;
    this.attempts = options.attempts ?? 3;
  }

  /** A GET with retries on 429 and 5xx; errors never carry the token. */
  private async get(url: URL): Promise<unknown> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      let wait = this.delayMs * 2 ** attempt;
      try {
        const response = await this.fetcher(url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${this.token}` },
        });
        if (response.ok) return await response.json();
        const text = redact(await response.text(), [this.token]);
        lastError = new Error(`Polar API error (${response.status}): ${text}`);
        if (response.status !== 429 && response.status < 500) break;
        const retryAfter = Number(response.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) wait = retryAfter * 1000;
      } catch (error) {
        lastError = new Error(
          redact(error instanceof Error ? error.message : String(error), [this.token]),
        );
      }
      if (attempt < this.attempts && wait > 0)
        await new Promise((resolve) => setTimeout(resolve, wait));
    }
    throw lastError ?? new Error("Polar request failed");
  }

  /** Every page of a Polar list (`page` from 1, `pagination.max_page`). */
  async list<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const url = new URL(`${this.baseUrl}${path}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      url.searchParams.set("limit", "100");
      url.searchParams.set("page", String(page));
      const body = (await this.get(url)) as Page<T>;
      items.push(...body.items);
      if (!body.items.length || page >= (body.pagination?.max_page ?? 1)) return items;
    }
  }

  /** The organization an organization access token belongs to. */
  async organization(): Promise<PolarOrganization> {
    const organizations = await this.list<PolarOrganization>("/v1/organizations/");
    if (organizations.length !== 1)
      throw new Error(
        `The Polar token sees ${organizations.length} organizations; use an organization access token.`,
      );
    return organizations[0];
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function hashFile(path: string): Promise<{ sha256: string; size: number }> {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(path) as AsyncIterable<Buffer>) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest("base64"), size };
}

/**
 * Polar's API hands out no file downloads to the organization, so the bytes
 * come from the merchant's own copies in `dir`, by file name. A copy counts
 * only when its size and SHA-256 are Polar's.
 */
async function localCopies(dir: string, files: PolarFile[], objects: PolarObjects) {
  for (const file of files) {
    const path = join(dir, basename(file.name));
    if (!existsSync(path)) {
      objects.fileProblems[file.id] = issue(
        "file_not_available",
        `${dir} has no ${file.name}. Download it from Polar into that folder and run the migration again.`,
      );
      continue;
    }
    const { sha256, size } = await hashFile(path);
    if (size !== file.size || (file.checksum_sha256_base64 ?? sha256) !== sha256) {
      objects.fileProblems[file.id] = issue(
        "file_checksum_mismatch",
        `${path} is not Polar's ${file.name}: its size or SHA-256 differs. Download it from Polar again.`,
      );
      continue;
    }
    objects.fileDigests[file.id] = { sha256, size, contentType: file.mime_type, path };
  }
}

/**
 * Reads the catalog of the token's organization: products (with their prices
 * and benefits, archived ones too), meters, discounts, and the metadata of the
 * downloadable files, with their local copies from `filesDir`. Customers, subscriptions,
 * orders, checkout links and webhooks are never fetched.
 */
export async function fetchPolarCatalog(
  client: PolarClient,
  options: { organization?: PolarOrganization; filesDir?: string } = {},
): Promise<{ objects: PolarObjects; failures: FetchFailure[] }> {
  const organization = options.organization ?? (await client.organization());
  const failures: FetchFailure[] = [];
  const objects: PolarObjects = {
    organization,
    products: [],
    meters: [],
    discounts: [],
    files: [],
    fileDigests: {},
    fileProblems: {},
  };
  const scope = { organization_id: organization.id };
  try {
    objects.meters = await client.list<PolarMeter>("/v1/meters/", scope);
  } catch (error) {
    failures.push({ kind: "meters", message: message(error) });
  }
  try {
    objects.products = await client.list<PolarProduct>("/v1/products/", scope);
  } catch (error) {
    failures.push({ kind: "products", message: message(error) });
  }
  try {
    objects.discounts = await client.list<PolarDiscount>("/v1/discounts/", scope);
  } catch (error) {
    failures.push({ kind: "discounts", message: message(error) });
  }
  const fileIds = new Set(
    objects.products.flatMap((p) =>
      p.benefits.flatMap((b) =>
        b.type === "downloadables" && Array.isArray(b.properties.files)
          ? (b.properties.files as string[])
          : [],
      ),
    ),
  );
  if (fileIds.size) {
    try {
      const files = await client.list<PolarFile>("/v1/files/", scope);
      objects.files = files.filter((f) => fileIds.has(f.id));
    } catch (error) {
      failures.push({ kind: "files", message: message(error) });
    }
    if (options.filesDir) await localCopies(options.filesDir, objects.files, objects);
  }
  return { objects, failures };
}
