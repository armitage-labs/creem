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
  /** Sent with `?dry_run=true`. */
  dryRun?: boolean;
  /** The `If-None-Match` header, when sent. */
  ifNoneMatch?: string;
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
    abandoned_cart_recovery_enabled: false,
    external_id: null,
    metadata: null,
    features: [],
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

/** A stored product group as the API returns it. */
export function productGroupJson(id: string, fields: Json = {}): Json {
  return {
    id,
    mode: "test",
    object: "product_group",
    name: id,
    description: null,
    external_id: null,
    products: [],
    upgrades_enabled: false,
    upgrade_behavior: null,
    upsells_enabled: false,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

/** An API error answer: the endpoint's status and error body. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Json,
  ) {
    super(String(body.code ?? status));
  }
}
const apiError = (status: number, code: string, message = code, details?: Json) =>
  new ApiError(status, { code, message, ...(details ? { details } : {}) });

interface WriteContext {
  state: CreemState;
  nextId: (prefix: string) => string;
  dryRun: boolean;
  /** `reference_not_found` warnings of a dry run (a real call answers 400). */
  warnings: Json[];
}

/** Turns the snake_case feature entries of a product write into stored features. */
function storeFeatures(
  context: WriteContext,
  current: Json[],
  entries: Json[] | undefined,
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
      id: existing?.id ?? context.nextId("feat"),
      type: entry.type,
      description: entry.description,
      external_id: entry.external_id ?? existing?.external_id ?? null,
    };
    if (entry.type === "licenseKey") stored.license_key = entry.license_key;
    if (entry.type === "file")
      stored.file = {
        files: entry.file.files.map((f: Json) => {
          // An unknown file id is a 400 in a dry run too (only keys become warnings).
          const file = context.state.files.find((s) => s.id === f.id);
          if (!file) throw apiError(400, "reference_not_found", `Unknown file ${f.id}`);
          return {
            id: file.id,
            file_name: file.filename,
            type: file.content_type,
            size: file.size,
            sha256: file.sha256 ?? null,
          };
        }),
      };
    features.push(stored);
  }
  return features;
}

/** The DTO limits of `CreateDiscountRequestEntity` / `UpdateDiscountRequestEntity`. */
function invalidDiscount(b: Json): ApiError | undefined {
  if (typeof b.code === "string" && b.code.length > 14)
    return apiError(400, "validation_error", "Code cannot be longer than 14 characters");
  if (typeof b.name === "string" && b.name.length > 40)
    return apiError(400, "validation_error", "Name cannot be longer than 40 characters");
  if ((b.applies_to_product_external_ids ?? []).length > 100)
    return apiError(
      400,
      "validation_error",
      "applies_to_product_external_ids must contain no more than 100 elements",
    );
  return undefined;
}

/** A product as reads return it: every file entry carries `sha256`, `null` when stored without one. */
function productResponse(product: Json): Json {
  return {
    ...product,
    features: (product.features ?? []).map((feature: Json) =>
      feature.file
        ? {
            ...feature,
            file: {
              ...feature.file,
              files: feature.file.files.map((f: Json) => ({ sha256: null, ...f })),
            },
          }
        : feature,
    ),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The fields of a stored object that changed, as `write_result.changes`. */
function changesOf(before: Json, after: Json, fields: string[]): Json[] {
  return fields
    .filter((field) => !same(before[field], after[field]))
    .map((path) => ({ path, from: before[path] ?? null, to: after[path] ?? null }));
}

const PRODUCT_FIELDS = [
  "name",
  "description",
  "price",
  "currency",
  "billing_type",
  "billing_period",
  "recurring_interval",
  "recurring_interval_count",
  "trial_period_days",
  "status",
  "tax_mode",
  "abandoned_cart_recovery_enabled",
  "external_id",
  "metadata",
  "features",
];

/** `POST /v1/products` (create or keyed upsert) and `PATCH /v1/products/{id}`. */
function writeProduct(
  context: WriteContext,
  b: Json,
  target: { id?: string; ifNoneMatch?: string },
): { status: number; body: Json } {
  const { state } = context;
  const keyed =
    target.id === undefined && b.external_id
      ? state.products.find((p) => p.external_id === b.external_id)
      : undefined;
  if (keyed && target.ifNoneMatch === "*")
    throw apiError(412, "precondition_failed", "A product already has this external_id.", {
      product_id: keyed.id,
    });
  const existing = target.id !== undefined ? state.products.find((p) => p.id === target.id) : keyed;
  if (target.id !== undefined && !existing) throw apiError(404, "not_found");
  if (!existing) {
    const missing = ["name", "description", "price", "currency", "billing_type"].filter(
      (field) => b[field] === undefined,
    );
    if (missing.length) throw apiError(400, "validation_error", `${missing.join(", ")} required`);
    const product: Json = productJson(context.nextId("prod"), {
      name: b.name,
      description: b.description,
      price: b.price,
      currency: b.currency,
      billing_type: b.billing_type,
      billing_period: b.billing_type === "onetime" ? "once" : b.billing_period,
      recurring_interval: b.recurring_interval ?? null,
      recurring_interval_count: b.recurring_interval_count ?? null,
      trial_period_days: b.trial_period_days ?? null,
      tax_mode: b.tax_mode ?? "inclusive",
      tax_category: b.tax_category ?? "saas",
      abandoned_cart_recovery_enabled: b.abandoned_cart_recovery_enabled ?? false,
      external_id: b.external_id ?? null,
      metadata: b.metadata ?? null,
    });
    product.features = storeFeatures(context, [], b.features);
    state.products.push(product);
    return { status: 200, body: { product, result: "created", changes: [], warnings: [] } };
  }
  if (
    typeof b.external_id === "string" &&
    b.external_id !== existing.external_id &&
    state.products.some((p) => p !== existing && p.external_id === b.external_id)
  )
    throw apiError(409, "external_id_taken");
  const warnings: Json[] = [];
  const after: Json = structuredClone(existing);
  for (const [key, value] of Object.entries(b)) {
    if (key === "features" || key === "pay_what_you_want" || key === "suggested_price") continue;
    if (key === "tax_category") {
      if (value !== existing.tax_category)
        warnings.push({ code: "field_not_writable", path: "tax_category" });
      continue;
    }
    after[key] = value;
  }
  if (b.billing_type === "onetime") after.billing_period = "once";
  if (b.billing_period && b.billing_period !== "custom") {
    after.recurring_interval = null;
    after.recurring_interval_count = null;
  }
  after.features = storeFeatures(context, existing.features, b.features);
  const changes = changesOf(existing, after, PRODUCT_FIELDS);
  if (!changes.length)
    return { status: 200, body: { product: existing, result: "unchanged", changes, warnings } };
  Object.assign(existing, after);
  return { status: 200, body: { product: existing, result: "updated", changes, warnings } };
}

const DISCOUNT_FIELDS = [
  "name",
  "type",
  "amount",
  "currency",
  "percentage",
  "expiry_date",
  "max_redemptions",
  "duration",
  "duration_in_months",
  "applies_to_products",
  "external_id",
];

/** Product ids of a discount write; unknown keys are 400s, or warnings in a dry run. */
function discountProducts(context: WriteContext, b: Json): string[] {
  const ids: string[] = [...(b.applies_to_products ?? [])];
  for (const id of ids)
    if (!context.state.products.some((p) => p.id === id))
      throw apiError(400, "reference_not_found", `Unknown product ${id}`);
  for (const key of b.applies_to_product_external_ids ?? []) {
    const product = context.state.products.find((p) => p.external_id === key);
    if (product) ids.push(product.id);
    else if (context.dryRun)
      context.warnings.push({
        code: "reference_not_found",
        path: "applies_to_product_external_ids",
        key,
      });
    else throw apiError(400, "reference_not_found", `Unknown product key ${key}`);
  }
  return ids;
}

/** `POST /v1/discounts` (create or keyed upsert) and `PATCH /v1/discounts/{id}`. */
function writeDiscount(
  context: WriteContext,
  b: Json,
  target: { id?: string; ifNoneMatch?: string },
): { status: number; body: Json } {
  const { state } = context;
  const invalid = invalidDiscount(b);
  if (invalid) throw invalid;
  const live = state.discounts.filter((d) => d.status !== "deleted");
  const keyed =
    target.id === undefined && b.external_id
      ? live.find((d) => d.external_id === b.external_id)
      : undefined;
  if (keyed && target.ifNoneMatch === "*")
    throw apiError(412, "precondition_failed", "A discount already has this external_id.", {
      discount_id: keyed.id,
    });
  const existing = target.id !== undefined ? live.find((d) => d.id === target.id) : keyed;
  if (target.id !== undefined && !existing) throw apiError(404, "not_found");
  if (!existing) {
    const missing = ["name", "type", "duration"].filter((field) => b[field] === undefined);
    if (missing.length) throw apiError(400, "validation_error", `${missing.join(", ")} required`);
    const code = String(b.code ?? "");
    if (live.some((d) => d.code.toUpperCase() === code.toUpperCase()))
      throw apiError(
        b.external_id ? 409 : 400,
        b.external_id ? "discount_code_taken" : "validation_error",
        "The code has already been taken.",
      );
    const discount: Json = {
      id: context.nextId("disc"),
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
      applies_to_products: discountProducts(context, b),
      redeem_count: 0,
      external_id: b.external_id ?? null,
    };
    // Like the API: a discount created without a code gets a generated one.
    discount.code ??= discount.id.toUpperCase().replace(/[^A-Z0-9]/g, "");
    state.discounts.push(discount);
    return { status: 200, body: { discount, result: "created", changes: [], warnings: [] } };
  }
  if (
    typeof b.external_id === "string" &&
    b.external_id !== existing.external_id &&
    live.some((d) => d !== existing && d.external_id === b.external_id)
  )
    throw apiError(409, "external_id_taken");
  const warnings: Json[] = [];
  const fixed = ["amount", "percentage", "type", "currency", "duration", "duration_in_months"];
  if (typeof b.max_redemptions === "number" && b.max_redemptions < (existing.redeem_count ?? 0))
    throw apiError(
      409,
      "max_redemptions_below_redeemed",
      "The limit is below the redemptions so far.",
    );
  if (existing.redeem_count > 0 && fixed.some((k) => k in b && b[k] !== existing[k]))
    throw apiError(409, "discount_redeemed", "The discount has been redeemed.");
  const after: Json = structuredClone(existing);
  for (const [key, value] of Object.entries(b)) {
    if (key === "applies_to_product_external_ids" || key === "applies_to_products") continue;
    if (key === "code") {
      if (String(value).toUpperCase() !== String(existing.code).toUpperCase())
        warnings.push({ code: "field_not_writable", path: "code" });
      continue;
    }
    if (value === null) delete after[key];
    else after[key] = value;
  }
  if (b.applies_to_product_external_ids || b.applies_to_products) {
    const ids = discountProducts(context, b);
    // Like the API (`DryRunProductKeys.forUpdate`): when a dry run can't resolve a
    // key, the update keeps the entire stored set, not the products it could resolve.
    const unresolved = (b.applies_to_product_external_ids ?? []).some(
      (key: string) => !context.state.products.some((p) => p.external_id === key),
    );
    if (!unresolved) after.applies_to_products = ids;
  }
  const changes = changesOf(existing, after, DISCOUNT_FIELDS);
  if (!changes.length)
    return { status: 200, body: { discount: existing, result: "unchanged", changes, warnings } };
  for (const key of Object.keys(existing)) if (!(key in after)) delete existing[key];
  Object.assign(existing, after);
  return { status: 200, body: { discount: existing, result: "updated", changes, warnings } };
}

/** `POST /v1/product-groups` (create or keyed upsert) and `PATCH /v1/product-groups/{id}`. */
function writeProductGroup(
  context: WriteContext,
  b: Json,
  target: { id?: string; ifNoneMatch?: string },
): { status: number; body: Json } {
  const { state } = context;
  const keyed =
    target.id === undefined && b.external_id
      ? state.productGroups.find((g) => g.external_id === b.external_id)
      : undefined;
  if (keyed && target.ifNoneMatch === "*")
    throw apiError(412, "precondition_failed", "A product group already has this external_id.", {
      product_group_id: keyed.id,
    });
  const existing =
    target.id !== undefined ? state.productGroups.find((g) => g.id === target.id) : keyed;
  if (target.id !== undefined && !existing) throw apiError(404, "not_found");
  if (
    existing &&
    typeof b.external_id === "string" &&
    b.external_id !== existing.external_id &&
    state.productGroups.some((g) => g !== existing && g.external_id === b.external_id)
  )
    throw apiError(409, "external_id_taken");
  let members: Json[] | undefined;
  if (b.products) {
    members = [];
    let unknown = false;
    const grouped: string[] = [];
    for (const ref of b.products as Json[]) {
      const product = state.products.find((p) =>
        ref.id !== undefined ? p.id === ref.id : p.external_id === ref.external_id,
      );
      if (!product) {
        if (!context.dryRun)
          throw apiError(
            400,
            "reference_not_found",
            `Unknown product ${ref.id ?? ref.external_id}`,
          );
        unknown = true;
        context.warnings.push({
          code: "reference_not_found",
          path: "products",
          key: ref.id ?? ref.external_id,
        });
        continue;
      }
      if (
        state.productGroups.some(
          (g) => g !== existing && g.products.some((m: Json) => m.id === product.id),
        )
      )
        grouped.push(product.id);
      members.push({ id: product.id, external_id: product.external_id ?? null });
    }
    // Like the API (`ProductAlreadyGroupedError`): every such product by id, not
    // the group it is in.
    if (grouped.length)
      throw apiError(
        409,
        "product_already_grouped",
        `Products ${grouped.join(", ")} are already in other bundles`,
        { product_ids: grouped },
      );
    // Like the API (`bundles.service.ts`): each product once, by id or by key.
    if (new Set(members.map((m) => m.id)).size !== members.length)
      throw apiError(400, "bad_request", "products must not list the same product twice");
    // A dry-run update with an unknown member keeps the stored members.
    if (unknown && existing) members = undefined;
  }
  if (!existing) {
    const group = productGroupJson(context.nextId("pgrp"), {
      name: b.name ?? "",
      description: b.description ?? null,
      external_id: b.external_id ?? null,
      products: members ?? [],
    });
    state.productGroups.push(group);
    return { status: 201, body: { group, result: "created", changes: [], warnings: [] } };
  }
  const after: Json = structuredClone(existing);
  for (const [key, value] of Object.entries(b)) if (key !== "products") after[key] = value;
  if (members) after.products = members;
  const changes = changesOf(existing, after, ["name", "description", "external_id", "products"]);
  if (!changes.length)
    return { status: 200, body: { group: existing, result: "unchanged", changes, warnings: [] } };
  Object.assign(existing, after);
  return { status: 200, body: { group: existing, result: "updated", changes, warnings: [] } };
}

export interface FakeCreemOptions {
  /**
   * Models a server that doesn't know `dry_run`: it ignores the parameter, writes
   * for real and answers `write_result.dry_run` `false`.
   */
  ignoreDryRun?: boolean;
  /**
   * Models a server whose `POST /v1/catalog/validate` doesn't roll back: it
   * writes the items and answers `write_result.dry_run` `false`.
   */
  validateWrites?: boolean;
}

const VALIDATE_MAX_ITEMS = 100;

export function fakeCreem(initial: Partial<CreemState> = {}, init: FakeCreemOptions = {}) {
  // Mutable, so a test can honour the dry run during the check and ignore it in the run.
  const options: FakeCreemOptions = { ...init };
  let state: CreemState = {
    products: [],
    productGroups: [],
    discounts: [],
    files: [],
    uploads: [],
    ...structuredClone(initial),
  };
  const calls: CreemCall[] = [];
  // New ids continue after the ids of the initial store, so they never collide.
  let counter = Math.max(
    0,
    ...Object.values(state)
      .flat()
      .map((o: Json) => Number(/_(\d+)$/.exec(String(o.id))?.[1] ?? 0)),
  );
  const failures: {
    match: (call: CreemCall) => boolean;
    status: number;
    body: Json;
    headers?: Record<string, string>;
  }[] = [];
  /**
   * Server rules the fake doesn't model (a guard, a conflict): a write of the
   * product, discount or group with this key answers this error, also in a dry
   * run and in validate.
   */
  const refusals = new Map<string, ApiError>();

  type Writer = typeof writeProduct;
  /**
   * Runs a catalog write. A dry run runs it on a copy of the store, whose ids and
   * writes are thrown away, and answers what the real call would.
   */
  const runWrite = (
    writer: Writer,
    body: Json,
    target: { id?: string; ifNoneMatch?: string },
    dryRun: boolean,
    on: CreemState = state,
  ): { status: number; body: Json } => {
    const rollback = dryRun && !options.ignoreDryRun;
    const scratch = rollback ? structuredClone(on) : on;
    const saved = counter;
    const context: WriteContext = {
      state: scratch,
      nextId: (prefix) => `${prefix}_${++counter}`,
      dryRun: rollback,
      warnings: [],
    };
    try {
      const objects = [...on.products, ...on.discounts, ...on.productGroups];
      const key =
        body.external_id ??
        objects.find((o) => target.id !== undefined && o.id === target.id)?.external_id;
      const refusal = key !== undefined ? refusals.get(key) : undefined;
      if (refusal) throw refusal;
      const answer = writer(context, body, target);
      const { result, changes, warnings } = answer.body;
      const object = answer.body.product ?? answer.body.discount ?? answer.body.group;
      const response = answer.body.product ? productResponse(object) : structuredClone(object);
      return {
        status: answer.status,
        body: {
          ...response,
          write_result: {
            result,
            dry_run: rollback,
            changes,
            warnings: [...warnings, ...context.warnings],
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) return { status: error.status, body: error.body };
      throw error;
    } finally {
      if (rollback) counter = saved;
    }
  };

  /** `POST /v1/catalog/validate`: every item as its dry run, in one rolled-back transaction. */
  const validate = (b: Json): { status: number; body: Json } => {
    const items: Json[] = Array.isArray(b.items) ? b.items : [];
    if (items.length > VALIDATE_MAX_ITEMS)
      return {
        status: 400,
        body: {
          code: "validate_batch_too_large",
          message: "Too many items.",
          details: { max_items: VALIDATE_MAX_ITEMS, items: items.length },
        },
      };
    const unsupported = items.find((item) => item.kind !== "product");
    if (unsupported)
      return {
        status: 400,
        body: {
          code: "dry_run_not_supported",
          message: `${unsupported.kind} items can't be validated yet.`,
          details: { kind: unsupported.kind },
        },
      };
    const scratch = options.validateWrites ? state : structuredClone(state);
    const saved = counter;
    const answers = items.map((item) => {
      // Each item sees what the items before it would have written.
      const answer = runWrite(
        writeProduct,
        item.body ?? {},
        item.id !== undefined ? { id: item.id } : {},
        false,
        scratch,
      );
      const valid = answer.status < 300;
      if (valid) answer.body.write_result.dry_run = !options.validateWrites;
      return {
        kind: item.kind,
        id: item.id ?? null,
        valid,
        status: answer.status,
        response: valid ? answer.body : null,
        error: valid ? null : answer.body,
      };
    });
    if (!options.validateWrites) counter = saved;
    const valid = answers.every((a) => a.valid);
    return {
      status: valid ? 200 : 422,
      body: { object: "catalog_validation", valid, items: answers },
    };
  };

  const respond = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname;
    const text = request.method === "GET" ? "" : await request.text();
    const body = text ? (JSON.parse(text) as Json) : request.method === "GET" ? undefined : {};
    const dryRunParam = url.searchParams.get("dry_run");
    const dryRun = dryRunParam === "true";
    const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;
    const call: CreemCall = {
      method: request.method,
      path,
      ...(body ? { body } : {}),
      ...(dryRun ? { dryRun } : {}),
      ...(ifNoneMatch ? { ifNoneMatch } : {}),
    };
    calls.push(call);
    const failure = failures.find((f) => f.match(call));
    if (failure)
      return Response.json(failure.body, { status: failure.status, headers: failure.headers });
    if (dryRunParam !== null && dryRunParam !== "true" && dryRunParam !== "false")
      return Response.json({ code: "validation_error" }, { status: 400 });
    const answer = (a: { status: number; body: Json }) =>
      Response.json(a.body, { status: a.status });
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
      return Response.json(pageOf(state.products.map(productResponse)));
    if (request.method === "GET" && path === "/v1/product-groups")
      return Response.json({ object: "list", data: state.productGroups, has_more: false });
    if (request.method === "GET" && path === "/v1/discounts/search")
      return Response.json(pageOf(state.discounts.filter((d) => d.status !== "deleted")));
    if (request.method === "POST" && path === "/v1/catalog/validate") {
      if (dryRunParam !== null)
        return Response.json({ code: "dry_run_not_supported" }, { status: 400 });
      return answer(validate(body!));
    }
    if (request.method === "POST" && path === "/v1/products")
      return answer(runWrite(writeProduct, body!, { ifNoneMatch }, dryRun));
    const productMatch = /^\/v1\/products\/([^/]+)$/.exec(path);
    if (request.method === "PATCH" && productMatch)
      return answer(runWrite(writeProduct, body!, { id: productMatch[1] }, dryRun));
    if (request.method === "POST" && path === "/v1/discounts")
      return answer(runWrite(writeDiscount, body!, { ifNoneMatch }, dryRun));
    const discountMatch = /^\/v1\/discounts\/([^/]+)$/.exec(path);
    if (request.method === "PATCH" && discountMatch)
      return answer(runWrite(writeDiscount, body!, { id: discountMatch[1] }, dryRun));
    if (request.method === "POST" && path === "/v1/product-groups")
      return answer(runWrite(writeProductGroup, body!, { ifNoneMatch }, dryRun));
    const groupMatch = /^\/v1\/product-groups\/([^/]+)$/.exec(path);
    if (request.method === "PATCH" && groupMatch)
      return answer(runWrite(writeProductGroup, body!, { id: groupMatch[1] }, dryRun));
    if (request.method === "POST" && path === "/v1/files") {
      const b = body!;
      const upload = {
        id: `file_${++counter}`,
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
  const isCheck = (c: CreemCall) => c.dryRun === true || c.path === "/v1/catalog/validate";
  return {
    client,
    get state() {
      return state;
    },
    set state(next: CreemState) {
      state = next;
    },
    calls,
    /** Requests that write: everything but reads, dry runs and validation. */
    writes: () => calls.filter((c) => c.method !== "GET" && !isCheck(c)),
    /** Requests sent with `?dry_run=true`. */
    dryRuns: () => calls.filter((c) => c.dryRun === true),
    /** `POST /v1/catalog/validate` requests. */
    validations: () => calls.filter((c) => c.path === "/v1/catalog/validate"),
    fail(
      match: (call: CreemCall) => boolean,
      status: number,
      body: Json,
      headers?: Record<string, string>,
    ) {
      failures.push({ match, status, body, headers });
    },
    /** Changes how the server treats `dry_run` from the next request on. */
    set ignoreDryRun(on: boolean) {
      options.ignoreDryRun = on;
    },
    /** Every write of the object with this key answers this error (see `refusals`). */
    refuse(key: string, status: number, code: string, message = code) {
      refusals.set(key, apiError(status, code, message));
    },
  };
}
