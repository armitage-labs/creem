import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Creem } from "creem";
import { HTTPClient } from "creem/lib/http";
import { vi } from "vitest";

/**
 * Test doubles for `creem migrate lemon-squeezy`.
 *
 * - `lemonSqueezyFetch` serves the fixtures in `fixtures/lemon-squeezy` as the
 *   LS API would, refuses every non-GET request to LS, and records the
 *   multipart POSTs the migrator sends to a Creem upload slot.
 * - `fakeCreem` is an in-memory Creem store behind the real SDK (its HTTP
 *   transport is replaced), so the migrator's requests go through the SDK's
 *   own serialization. It answers in the API's snake_case shapes.
 */

const FIXTURES = join(__dirname, "fixtures", "lemon-squeezy");
type Doc = { data: any[]; included?: any[]; meta?: unknown; links?: unknown };
const read = (path: string): Doc => JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));

export const LS_STORE_ID = "86325";
export const FILE_BYTES = readFileSync(join(FIXTURES, "hand-written", "files", "icons.zip"));

export function lemonSqueezyDocs() {
  const variants = new Map<string, Doc>();
  for (const dir of ["recorded", "hand-written"])
    for (const name of readdirSync(join(FIXTURES, dir))) {
      const match = /^variants-(\d+)\.json$/.exec(name);
      if (match) variants.set(match[1], read(`${dir}/${name}`));
    }
  const products = read("recorded/products.json");
  const handWritten = read("hand-written/products.json");
  return {
    stores: read("recorded/stores.json"),
    products: { ...products, data: [...products.data, ...handWritten.data] },
    variants,
    discounts: read("hand-written/discounts.json"),
    /** Redemptions already used in LS, by discount id; 0 when absent. */
    redemptions: {} as Record<string, number>,
  };
}

export interface SlotPost {
  url: string;
  fields: Record<string, string>;
  file: Buffer;
}

export function lemonSqueezyFetch(
  docs = lemonSqueezyDocs(),
  options: { files?: Record<string, Buffer> } = {},
) {
  const slotPosts: SlotPost[] = [];
  const lsRequests: string[] = [];
  const page = (doc: Doc) => Response.json({ ...doc, links: { next: null } });
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "lemonsqueezy.com" || url.hostname.endsWith(".lemonsqueezy.com")) {
      if (request.method !== "GET") throw new Error(`LS_WRITE_REFUSED ${request.method} ${url}`);
      lsRequests.push(`${url.pathname}${url.search}`);
      if (url.hostname === "app.lemonsqueezy.com") {
        const id = url.pathname.split("/").pop() ?? "";
        const bytes = options.files?.[id] ?? FILE_BYTES;
        return new Response(new Uint8Array(bytes));
      }
      const path = url.pathname.replace(/^\/v1/, "");
      if (path === "/stores") return page(docs.stores);
      if (path === "/products") {
        if (url.searchParams.get("filter[store_id]") !== LS_STORE_ID)
          throw new Error(`UNSCOPED_PRODUCTS ${url}`);
        return page(docs.products);
      }
      if (path === "/variants") {
        const productId = url.searchParams.get("filter[product_id]") ?? "";
        const doc = docs.variants.get(productId);
        if (!doc) throw new Error(`UNKNOWN_PRODUCT ${productId}`);
        return page(doc);
      }
      if (path === "/discounts") {
        if (url.searchParams.get("filter[store_id]") !== LS_STORE_ID)
          throw new Error(`UNSCOPED_DISCOUNTS ${url}`);
        return page(docs.discounts);
      }
      if (path === "/discount-redemptions") {
        const discountId = url.searchParams.get("filter[discount_id]");
        if (!discountId) throw new Error(`UNSCOPED_REDEMPTIONS ${url}`);
        // Only the page meta's total is read; a redemption row carries order data.
        const total = docs.redemptions[discountId] ?? 0;
        return page({ data: [], meta: { page: { currentPage: 1, perPage: 1, total } } });
      }
      if (/^\/(customers|subscriptions|orders|files)/.test(path))
        throw new Error(`UNEXPECTED_LS_FETCH ${path}`);
      return Response.json({ errors: [{ status: "404" }] }, { status: 404 });
    }
    if (url.hostname === "uploads.creem.test") {
      const form = await request.formData();
      const fields: Record<string, string> = {};
      let file = Buffer.alloc(0);
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") fields[key] = value;
        else file = Buffer.from(await value.arrayBuffer());
      }
      slotPosts.push({ url: url.toString(), fields, file });
      return new Response(null, { status: 204 });
    }
    throw new Error(`UNEXPECTED_FETCH ${request.method} ${url}`);
  });
  return { fetcher, slotPosts, lsRequests };
}

type Json = Record<string, any>;
export interface CreemState {
  products: Json[];
  productGroups: Json[];
  discounts: Json[];
  files: Json[];
  uploads: Json[];
}
export interface CreemCall {
  method: string;
  path: string;
  body?: Json;
}

const now = "2026-11-19T12:00:00.000Z";

/** A stored product as the API returns it. */
export function productJson(id: string, fields: Json = {}): Json {
  return {
    id,
    mode: "test",
    object: "product",
    name: id,
    description: id,
    price: 1000,
    currency: "EUR",
    billing_type: "onetime",
    billing_period: "once",
    recurring_interval: null,
    recurring_interval_count: null,
    trial_period_days: null,
    trial_price: null,
    status: "active",
    tax_mode: "inclusive",
    tax_category: "saas",
    external_id: null,
    metadata: null,
    features: [],
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

/** Turns the snake_case feature entries of a product write into stored features. */
function storeFeatures(
  state: CreemState,
  current: Json[],
  entries: Json[] | undefined,
  nextId: () => string,
): Json[] {
  if (!entries) return current;
  const touched = new Set(entries.filter((e) => !e.deleted).map((e) => e.type));
  let features = current.filter((f) => !touched.has(f.type));
  for (const entry of entries) {
    if (entry.deleted) {
      features = features.filter(
        (f) => !(f.id === entry.id || (entry.external_id && f.external_id === entry.external_id)),
      );
      continue;
    }
    const existing = current.find(
      (f) => f.id === entry.id || (entry.external_id && f.external_id === entry.external_id),
    );
    const stored: Json = {
      id: existing?.id ?? nextId(),
      type: entry.type,
      description: entry.description,
      external_id: entry.external_id ?? existing?.external_id ?? null,
    };
    if (entry.type === "licenseKey") stored.license_key = entry.license_key;
    if (entry.type === "file")
      stored.file = {
        files: entry.file.files.map((f: Json) => {
          const file = state.files.find((s) => s.id === f.id);
          if (!file) throw Object.assign(new Error("reference_not_found"), { status: 400 });
          return {
            id: file.id,
            file_name: file.filename,
            type: file.content_type,
            size: file.size,
          };
        }),
      };
    features.push(stored);
  }
  return features;
}

/** The DTO limits of `CreateDiscountRequestEntity` / `UpdateDiscountRequestEntity`. */
function invalidDiscount(b: Json): Json | undefined {
  if (typeof b.code === "string" && b.code.length > 14)
    return { code: "validation_error", message: "Code cannot be longer than 14 characters" };
  if (typeof b.name === "string" && b.name.length > 40)
    return { code: "validation_error", message: "Name cannot be longer than 40 characters" };
  if ((b.applies_to_product_external_ids ?? []).length > 100)
    return {
      code: "validation_error",
      message: "applies_to_product_external_ids must contain no more than 100 elements",
    };
  return undefined;
}

function productResponse(product: Json) {
  return product;
}

export function fakeCreem(initial: Partial<CreemState> = {}) {
  const state: CreemState = {
    products: [],
    productGroups: [],
    discounts: [],
    files: [],
    uploads: [],
    ...structuredClone(initial),
  };
  const calls: CreemCall[] = [];
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}_${++counter}`;
  const failures: { match: (call: CreemCall) => boolean; status: number; body: Json }[] = [];

  const respond = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    const text = request.method === "GET" ? "" : await request.text();
    const body = text ? (JSON.parse(text) as Json) : request.method === "GET" ? undefined : {};
    const call: CreemCall = { method: request.method, path, ...(body ? { body } : {}) };
    calls.push(call);
    const failure = failures.find((f) => f.match(call));
    if (failure) return Response.json(failure.body, { status: failure.status });
    const pageOf = (items: Json[]) => {
      const size = Number(url.searchParams.get("page_size") ?? 10);
      const number = Number(url.searchParams.get("page_number") ?? 1);
      const totalPages = Math.max(1, Math.ceil(items.length / size));
      return {
        items: items.slice((number - 1) * size, number * size),
        pagination: {
          total_records: items.length,
          total_pages: totalPages,
          current_page: number,
          next_page: number < totalPages ? number + 1 : null,
          prev_page: number > 1 ? number - 1 : null,
        },
      };
    };
    if (request.method === "GET" && path === "/v1/products/search")
      return Response.json(pageOf(state.products));
    if (request.method === "GET" && path === "/v1/product-groups")
      return Response.json({ object: "list", data: state.productGroups, has_more: false });
    if (request.method === "GET" && path === "/v1/discounts/search")
      return Response.json(pageOf(state.discounts.filter((d) => d.status !== "deleted")));
    if (request.method === "POST" && path === "/v1/products") {
      const b = body!;
      if (b.external_id && state.products.some((p) => p.external_id === b.external_id))
        return Response.json({ code: "external_id_taken" }, { status: 409 });
      const product: Json = {
        id: nextId("prod"),
        mode: "test",
        object: "product",
        name: b.name,
        description: b.description,
        price: b.price,
        currency: b.currency,
        billing_type: b.billing_type,
        billing_period: b.billing_type === "onetime" ? "once" : b.billing_period,
        recurring_interval: b.recurring_interval ?? null,
        recurring_interval_count: b.recurring_interval_count ?? null,
        trial_period_days: b.trial_period_days ?? null,
        trial_price: null,
        status: "active",
        tax_mode: "inclusive",
        tax_category: b.tax_category ?? "saas",
        external_id: b.external_id ?? null,
        metadata: b.metadata ?? null,
        features: [],
        created_at: now,
        updated_at: now,
      };
      try {
        product.features = storeFeatures(state, [], b.features, () => nextId("feat"));
      } catch {
        return Response.json({ code: "reference_not_found" }, { status: 400 });
      }
      state.products.push(product);
      return Response.json(productResponse(product));
    }
    const productMatch = /^\/v1\/products\/([^/]+)$/.exec(path);
    if (request.method === "PATCH" && productMatch) {
      const product = state.products.find((p) => p.id === productMatch[1]);
      if (!product) return Response.json({ code: "not_found" }, { status: 404 });
      const b = body!;
      for (const [key, value] of Object.entries(b)) {
        if (key === "features") continue;
        if (key === "pay_what_you_want" || key === "suggested_price") continue;
        product[key] = value;
      }
      if (b.billing_type === "onetime") product.billing_period = "once";
      if (b.billing_period && b.billing_period !== "custom") {
        product.recurring_interval = null;
        product.recurring_interval_count = null;
      }
      try {
        product.features = storeFeatures(state, product.features, b.features, () => nextId("feat"));
      } catch {
        return Response.json({ code: "reference_not_found" }, { status: 400 });
      }
      return Response.json({ ...productResponse(product), write_result: { warnings: [] } });
    }
    if (request.method === "POST" && path === "/v1/discounts") {
      const b = body!;
      const invalid = invalidDiscount(b);
      if (invalid) return Response.json(invalid, { status: 400 });
      const ids: string[] = [...(b.applies_to_products ?? [])];
      for (const key of b.applies_to_product_external_ids ?? []) {
        const product = state.products.find((p) => p.external_id === key);
        if (!product) return Response.json({ code: "reference_not_found" }, { status: 400 });
        ids.push(product.id);
      }
      const discount: Json = {
        id: nextId("disc"),
        mode: "test",
        object: "discount",
        status: "active",
        name: b.name,
        code: b.code,
        type: b.type,
        ...(b.type === "fixed"
          ? { amount: b.amount, currency: b.currency }
          : { percentage: b.percentage }),
        ...(b.expiry_date ? { expiry_date: b.expiry_date } : {}),
        ...(b.max_redemptions !== undefined ? { max_redemptions: b.max_redemptions } : {}),
        duration: b.duration,
        ...(b.duration_in_months !== undefined ? { duration_in_months: b.duration_in_months } : {}),
        applies_to_products: ids,
        redeem_count: 0,
        external_id: b.external_id ?? null,
      };
      state.discounts.push(discount);
      return Response.json(discount);
    }
    const discountMatch = /^\/v1\/discounts\/([^/]+)$/.exec(path);
    if (request.method === "PATCH" && discountMatch) {
      const discount = state.discounts.find((d) => d.id === discountMatch[1]);
      if (!discount) return Response.json({ code: "not_found" }, { status: 404 });
      const b = body!;
      const invalid = invalidDiscount(b);
      if (invalid) return Response.json(invalid, { status: 400 });
      const fixed = ["amount", "percentage", "type", "currency", "duration", "duration_in_months"];
      if (discount.redeem_count > 0 && fixed.some((k) => k in b && b[k] !== discount[k]))
        return Response.json(
          { code: "discount_redeemed", message: "The discount has been redeemed." },
          { status: 409 },
        );
      for (const [key, value] of Object.entries(b)) {
        if (key === "applies_to_product_external_ids") continue;
        if (value === null) delete discount[key];
        else discount[key] = value;
      }
      if (b.applies_to_product_external_ids) {
        const ids = [...(b.applies_to_products ?? [])];
        for (const key of b.applies_to_product_external_ids) {
          const product = state.products.find((p) => p.external_id === key);
          if (!product) return Response.json({ code: "reference_not_found" }, { status: 400 });
          ids.push(product.id);
        }
        discount.applies_to_products = ids;
      }
      return Response.json(discount);
    }
    if (request.method === "POST" && path === "/v1/files") {
      const b = body!;
      const upload = {
        id: nextId("file"),
        upload_url: "https://uploads.creem.test/",
        upload_fields: { key: `store/sto_1/${b.filename}`, "Content-Type": b.content_type },
        expires_at: "2026-11-19T13:00:00.000Z",
        request: b,
      };
      state.uploads.push(upload);
      const { request: _request, ...response } = upload;
      return Response.json(response);
    }
    const confirmMatch = /^\/v1\/files\/([^/]+)\/confirm$/.exec(path);
    if (request.method === "POST" && confirmMatch) {
      const upload = state.uploads.find((u) => u.id === confirmMatch[1]);
      if (!upload) return Response.json({ code: "upload_not_found" }, { status: 404 });
      const file = {
        id: upload.id,
        object: "file",
        purpose: upload.request.purpose,
        filename: upload.request.filename,
        content_type: upload.request.content_type,
        size: upload.request.size,
        sha256: upload.request.sha256,
        created_at: now,
      };
      if (!state.files.some((f) => f.id === file.id)) state.files.push(file);
      return Response.json(file);
    }
    return Response.json({ code: "not_found", path }, { status: 404 });
  };

  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(input instanceof Request ? input : new Request(input, init)),
  );
  const client = new Creem({
    apiKey: "creem_test_fixture",
    server: "test",
    httpClient: new HTTPClient({ fetcher }),
    retryConfig: { strategy: "none" },
  });
  const writes = () => calls.filter((c) => c.method !== "GET");
  return {
    client,
    state,
    calls,
    writes,
    fail(match: (call: CreemCall) => boolean, status: number, body: Json) {
      failures.push({ match, status, body });
    },
  };
}
