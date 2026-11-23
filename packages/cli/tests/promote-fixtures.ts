import { Creem } from "creem";
import { HTTPClient } from "creem/lib/http";
import { vi } from "vitest";
import { productJson } from "./migrate-fixtures";

/**
 * Test double for `creem catalog promote`, `link` and `unlink` (ENG-2437).
 *
 * One store with a test and a live side, behind the real SDK (its HTTP
 * transport is replaced): `test-api.creem.io` is the test side,
 * `api.creem.io` the live side. It answers in the API's snake_case shapes:
 *
 * - `GET /v1/products/{id}`, `GET /v1/products/search?external_id=`,
 *   `GET /v1/meters/{id}`;
 * - `PATCH /v1/products/{id}` and `PATCH /v1/meters/{id}`, with `?dry_run=true`
 *   (a copy of the side, thrown away), `409` `external_id_taken`, and a
 *   product's features replaced per type, a feature left out of its type's set
 *   removed (ADR § 2.9);
 * - `POST /v1/catalog/promote` on live (`400` `live_only` on test), modelled on
 *   the backend's planner (pugpay #4299, `promote-planner.ts`,
 *   `promote-candidates.ts`, `promote-feature-pairing.ts`): items paired by
 *   `external_id`, `needs_key` with ranked candidates and the test id as the
 *   proposed key, `feature_candidates`, `possible_rename`, the
 *   `live_metadata_not_in_test` conflict with `details.keys`, `blocked` by a
 *   meter, `not_written` (`archived_not_in_live`, `promote_check_failed`,
 *   `changed_since_check`), the check before the first write with
 *   `validation` and `force`, and pages of `pageSize` items with
 *   `next_cursor`, bound to `select` and `dry_run`.
 */

type Json = Record<string, any>;
export type Side = "test" | "live";
export interface Catalog {
  meters: Json[];
  products: Json[];
}
export interface CatalogCall {
  side: Side;
  method: string;
  path: string;
  query: string;
  body?: Json;
  /** Sent with `?dry_run=true`. */
  dryRun?: boolean;
}

const now = "2026-11-23T12:00:00.000Z";

/** A stored meter as the API returns it. */
export function meterJson(id: string, fields: Json = {}): Json {
  return {
    id,
    store_id: "sto_1",
    name: id,
    event_name: `${id}.used`,
    aggregation: "count",
    aggregation_property: null,
    filter: { conjunction: "and", clauses: [] },
    unit_label: "units",
    status: "active",
    external_id: null,
    locked: false,
    created_at: now,
    updated_at: now,
    ...fields,
  };
}

/** A product of one side as the API returns it; its description defaults to its name, so a test and a live copy compare equal. */
export function sideProduct(side: Side, id: string, fields: Json = {}): Json {
  return productJson(id, { mode: side, description: fields.name ?? "Product", ...fields });
}

/** A stored product feature. */
export function featureJson(
  id: string,
  type: "customerCredits" | "licenseKey" | "custom",
  description: string,
  fields: Json = {},
): Json {
  const settings: Json =
    type === "customerCredits"
      ? { customer_credits: { amount: "100" } }
      : type === "licenseKey"
        ? { license_key: { activation_limit: 1, expiry: null } }
        : { private_note: `${description} note` };
  return { id, type, description, external_id: null, ...settings, ...fields };
}

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

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const changesOf = (before: Json, after: Json, fields: string[]): Json[] =>
  fields
    .filter((field) => !same(before[field], after[field]))
    .map((path) => ({ path, from: before[path] ?? null, to: after[path] ?? null }));

/** The settings field of each feature type promote copies (`promote-feature-pairing.ts`). */
const FEATURE_SETTINGS: Record<string, string> = {
  customerCredits: "customer_credits",
  licenseKey: "license_key",
  custom: "private_note",
};

/**
 * Applies a product write's `features` entries like the API (§ 2.9): a type
 * the entries name is replaced by its entries (an entry with `id`, or with an
 * `external_id` the product holds, edits that feature; any other creates one),
 * and a deletion removes the feature it names.
 */
function applyFeatures(current: Json[], entries: Json[], nextId: () => string): Json[] {
  const touched = new Set(entries.filter((e) => !e.deleted).map((e) => e.type));
  let features = current.filter((f) => !touched.has(f.type));
  for (const entry of entries) {
    if (entry.deleted) {
      const before = features.length;
      features = features.filter(
        (f) => !(f.id === entry.id || (entry.external_id && f.external_id === entry.external_id)),
      );
      if (features.length === before) throw apiError(400, "feature_not_found");
      continue;
    }
    const existing = current.find(
      (f) =>
        (entry.id !== undefined && f.id === entry.id) ||
        (entry.id === undefined && entry.external_id && f.external_id === entry.external_id),
    );
    if (entry.id !== undefined && !existing) throw apiError(400, "feature_not_found");
    const settings = FEATURE_SETTINGS[entry.type];
    features.push({
      id: existing?.id ?? nextId(),
      type: entry.type,
      description: entry.description,
      external_id:
        entry.external_id !== undefined ? entry.external_id : (existing?.external_id ?? null),
      ...(settings ? { [settings]: entry[settings] ?? existing?.[settings] } : {}),
    });
  }
  const keys = features.map((f) => f.external_id).filter((key) => key !== null);
  if (new Set(keys).size !== keys.length)
    throw apiError(409, "feature_external_id_taken", "Two features of the product share a key.");
  return features;
}

const PRODUCT_PATCH_FIELDS = [
  "name",
  "description",
  "external_id",
  "metadata",
  "features",
  "status",
];
const METER_PATCH_FIELDS = ["name", "event_name", "aggregation", "unit_label", "external_id"];

/** A meter's write fields as promote sends them (`METER_FIELDS`). */
const METER_FIELDS = [
  "name",
  "event_name",
  "aggregation",
  "aggregation_property",
  "filter",
  "unit_label",
];
/** A product's write fields promote copies when test sets them (a subset of `PRODUCT_FIELDS`). */
const PRODUCT_FIELDS = [
  "name",
  "description",
  "price",
  "currency",
  "billing_type",
  "billing_period",
  "trial_period_days",
  "abandoned_cart_recovery_enabled",
];
const PRODUCT_WRITE_FIELDS = [...PRODUCT_FIELDS, "external_id", "metadata", "status", "features"];
const METER_WRITE_FIELDS = [...METER_FIELDS, "external_id", "status"];

const normalizeName = (name: unknown) =>
  String(name ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
const isAlike = (a: Json, b: Json) =>
  a.type === b.type && normalizeName(a.description) === normalizeName(b.description);

type Kind = "meter" | "product";
interface Plan {
  kind: Kind;
  testId: string;
  liveId: string | null;
  plan: "write" | "needs_key" | "conflict" | "blocked" | "not_written";
  body?: Json;
  warnings?: Json[];
  candidates?: Json[];
  proposedExternalId?: string;
  featureCandidates?: Json[];
  error?: Json;
  blockedBy?: Json;
}

/** `promoteCandidates`: unpaired live items with the same name, ranked. */
function candidatesFor(kind: Kind, test: Json, live: Json[], heldKeys: Set<string>): Json[] {
  const differenceFields =
    kind === "meter"
      ? ["event_name", "aggregation", "unit_label", "status"]
      : ["price", "currency", "billing_type", "billing_period", "status"];
  const rank = (item: Json) => [
    kind === "product" && item.billing_type === test.billing_type ? 0 : 1,
    item.status === "active" ? 0 : 1,
    kind === "product" ? Math.abs((item.price ?? 0) - (test.price ?? 0)) : 0,
  ];
  return live
    .filter(
      (item) =>
        normalizeName(item.name) === normalizeName(test.name) &&
        (item.external_id === null || !heldKeys.has(item.external_id)),
    )
    .sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return a.id < b.id ? -1 : 1;
    })
    .map((item) => ({
      live_id: item.id,
      external_id: item.external_id,
      name: item.name,
      status: item.status,
      ...(kind === "product"
        ? {
            price: item.price,
            currency: item.currency,
            billing_type: item.billing_type,
            billing_period: item.billing_period,
          }
        : {}),
      differences: differenceFields.filter((field) => !same(item[field], test[field])),
    }));
}

/** `pairPromoteFeatures`: the product body's `features`, or the features that need keys. */
function pairFeatures(test: Json[], live: Json[] | null) {
  const promoted = (f: Json) => FEATURE_SETTINGS[f.type] !== undefined;
  const testFeatures = test.filter(promoted);
  const liveFeatures = (live ?? []).filter(promoted);
  const pairs = new Map<Json, { live: Json; by: "key" | "description" }>();
  const pairedLive = new Set<Json>();
  for (const feature of testFeatures) {
    const match =
      feature.external_id === null
        ? undefined
        : liveFeatures.find((l) => l.external_id === feature.external_id);
    if (match) {
      pairs.set(feature, { live: match, by: "key" });
      pairedLive.add(match);
    }
  }
  const unmatchedTest = testFeatures.filter((f) => !pairs.has(f));
  const unmatchedLive = liveFeatures.filter((f) => !pairedLive.has(f));
  for (const feature of unmatchedTest) {
    if (feature.external_id !== null) continue;
    const alikeTest = unmatchedTest.filter((o) => isAlike(o, feature));
    const alikeLive = unmatchedLive.filter((o) => isAlike(o, feature));
    if (alikeTest.length === 1 && alikeLive.length === 1 && alikeLive[0].external_id === null) {
      pairs.set(feature, { live: alikeLive[0], by: "description" });
      pairedLive.add(alikeLive[0]);
    }
  }
  const testLeftovers = testFeatures.filter((f) => !pairs.has(f));
  const liveLeftovers = liveFeatures.filter((f) => !pairedLive.has(f));
  const entry = (f: Json) => ({
    ...(f.external_id === null ? {} : { external_id: f.external_id }),
    type: f.type,
    description: f.description,
    [FEATURE_SETTINGS[f.type]]: f[FEATURE_SETTINGS[f.type]],
  });
  const featureCandidates: Json[] = [];
  const entries: Json[] = [];
  for (const feature of testFeatures) {
    const pair = pairs.get(feature);
    if (pair) {
      entries.push(pair.by === "key" ? entry(feature) : { id: pair.live.id, ...entry(feature) });
      continue;
    }
    const liveOfType = liveLeftovers.filter((o) => o.type === feature.type);
    const alikeKeyless =
      feature.external_id === null &&
      testLeftovers.some((o) => o !== feature && o.external_id === null && isAlike(o, feature));
    if (liveOfType.length || alikeKeyless) {
      featureCandidates.push({
        test_feature_id: feature.id,
        type: feature.type,
        description: feature.description,
        proposed_external_id: feature.external_id ?? feature.id,
        candidates: liveOfType.map((c) => ({
          live_feature_id: c.id,
          external_id: c.external_id,
          description: c.description,
        })),
      });
      continue;
    }
    entries.push(entry(feature));
  }
  for (const feature of liveLeftovers)
    if (!testLeftovers.some((o) => o.type === feature.type))
      entries.push({ id: feature.id, deleted: true });
  return {
    entries: testFeatures.length === 0 && liveFeatures.length === 0 ? null : entries,
    featureCandidates,
  };
}

export interface PromoteSelect {
  meters?: "all" | string[];
  products?: "all" | string[];
}

export interface FakeCatalogOptions {
  /** Items per promote page (the backend pages by time). */
  pageSize?: number;
  /** Rolled-back batches the real run's check takes; each but the last answers a page without items. */
  checkBatches?: number;
  /** A server that ignores `dry_run` on promote: it writes and answers `dry_run: false`. */
  ignoreDryRun?: boolean;
}

export function fakeCatalog(
  initial: { test?: Partial<Catalog>; live?: Partial<Catalog> } = {},
  init: FakeCatalogOptions = {},
) {
  const options: FakeCatalogOptions = { pageSize: 50, checkBatches: 1, ...init };
  const stores: Record<Side, Catalog> = {
    test: { meters: [], products: [], ...structuredClone(initial.test ?? {}) },
    live: { meters: [], products: [], ...structuredClone(initial.live ?? {}) },
  };
  const calls: CatalogCall[] = [];
  let counter = 100;
  const nextId = (prefix: string) => `${prefix}_${++counter}`;
  const failures: { match: (call: CatalogCall) => boolean; status: number; body: Json }[] = [];
  /** The check and the write of the item with this test id answer this error. */
  const refusals = new Map<string, ApiError>();
  /** Test ids whose command changes between the check and the write. */
  const changedAfterCheck = new Set<string>();
  interface Run {
    select: unknown;
    dryRun: boolean;
    force: boolean;
    items: Json[] | null;
    checkedBatches: number;
    validation: Json | null;
    offset: number;
    pages: number;
  }
  const runs = new Map<string, Run>();

  const find = (catalog: Catalog, kind: Kind, id: string) =>
    (kind === "meter" ? catalog.meters : catalog.products).find((item) => item.id === id);

  /** `PATCH /v1/{kind}s/{id}` on one side. */
  const patch = (side: Side, kind: Kind, id: string, body: Json, dryRun: boolean) => {
    const catalog = dryRun ? structuredClone(stores[side]) : stores[side];
    const items = kind === "meter" ? catalog.meters : catalog.products;
    const existing = items.find((item) => item.id === id);
    if (!existing) throw apiError(404, "not_found");
    if (
      typeof body.external_id === "string" &&
      body.external_id !== existing.external_id &&
      items.some((item) => item !== existing && item.external_id === body.external_id)
    )
      throw apiError(409, "external_id_taken", `The external_id ${body.external_id} is taken.`, {
        external_id: body.external_id,
      });
    const after = structuredClone(existing);
    for (const [key, value] of Object.entries(body)) if (key !== "features") after[key] = value;
    if (body.features)
      after.features = applyFeatures(existing.features, body.features, () => nextId("feat"));
    const fields = kind === "meter" ? METER_PATCH_FIELDS : PRODUCT_PATCH_FIELDS;
    const changes = changesOf(existing, after, fields);
    if (changes.length) Object.assign(existing, after);
    return {
      ...structuredClone(existing),
      write_result: {
        result: changes.length ? "updated" : "unchanged",
        dry_run: dryRun,
        changes,
        warnings: [],
      },
    };
  };

  /** The planner (`planPromote`) over the stores as they are now. */
  const plan = (select: PromoteSelect | undefined): Plan[] => {
    const selection = select ?? { meters: "all", products: "all" };
    const selected = (kind: "meters" | "products", id: string) => {
      const s = selection[kind];
      return s === "all" || (Array.isArray(s) && s.includes(id));
    };
    const byId = (a: Json, b: Json) => (a.id < b.id ? -1 : 1);
    const heldKeys = (items: Json[]) =>
      new Set(items.map((i) => i.external_id).filter((k): k is string => k !== null));
    const { test, live } = stores;
    const plans: Plan[] = [];
    const notLive = (kind: Kind, item: Json, s: unknown): Plan | null =>
      s === "all"
        ? null
        : {
            kind,
            testId: item.id,
            liveId: null,
            plan: "not_written",
            error: {
              status: 409,
              code: "archived_not_in_live",
              message: `The test ${kind} is archived in test, and live has no ${kind} with its external_id.`,
            },
          };
    const needsKey = (kind: Kind, item: Json, liveItems: Json[], testItems: Json[]): Plan => ({
      kind,
      testId: item.id,
      liveId: null,
      plan: "needs_key",
      candidates: candidatesFor(kind, item, liveItems, heldKeys(testItems)),
      proposedExternalId: item.id,
      featureCandidates: [],
    });
    const writtenMeters = new Set<string>();
    for (const item of test.meters.filter((m) => selected("meters", m.id)).sort(byId)) {
      const liveMeter = item.external_id
        ? live.meters.find((m) => m.external_id === item.external_id)
        : undefined;
      if (item.status === "archived" && !liveMeter) {
        const p = notLive("meter", item, selection.meters);
        if (p) plans.push(p);
        continue;
      }
      if (item.external_id === null) {
        plans.push(needsKey("meter", item, live.meters, test.meters));
        continue;
      }
      const body: Json = { external_id: item.external_id };
      for (const field of METER_FIELDS) if (item[field] !== undefined) body[field] = item[field];
      if (liveMeter) body.status = item.status;
      const candidates = liveMeter
        ? []
        : candidatesFor("meter", item, live.meters, heldKeys(test.meters));
      writtenMeters.add(item.id);
      plans.push({
        kind: "meter",
        testId: item.id,
        liveId: liveMeter?.id ?? null,
        plan: "write",
        body,
        candidates,
        warnings: candidates.length ? [{ code: "possible_rename", path: "external_id" }] : [],
      });
    }
    for (const item of test.products.filter((p) => selected("products", p.id)).sort(byId)) {
      const liveProduct = item.external_id
        ? live.products.find((p) => p.external_id === item.external_id)
        : undefined;
      const liveId = liveProduct?.id ?? null;
      if (item.status === "archived" && !liveProduct) {
        const p = notLive("product", item, selection.products);
        if (p) plans.push(p);
        continue;
      }
      if (item.external_id === null) {
        plans.push(needsKey("product", item, live.products, test.products));
        continue;
      }
      const meterId = (item.usage_prices ?? [])
        .map((u: Json) => u.meter_id)
        .find((id: string) => {
          const meter = test.meters.find((m) => m.id === id);
          return (
            !meter?.external_id ||
            !(live.meters.some((m) => m.external_id === meter.external_id) || writtenMeters.has(id))
          );
        });
      if (meterId) {
        plans.push({
          kind: "product",
          testId: item.id,
          liveId,
          plan: "blocked",
          blockedBy: { kind: "meter", test_id: meterId },
        });
        continue;
      }
      const features = pairFeatures(
        item.features ?? [],
        liveProduct ? (liveProduct.features ?? []) : null,
      );
      if (features.featureCandidates.length) {
        plans.push({
          kind: "product",
          testId: item.id,
          liveId,
          plan: "needs_key",
          candidates: [],
          featureCandidates: features.featureCandidates,
        });
        continue;
      }
      const liveOnly = liveProduct
        ? Object.keys(liveProduct.metadata ?? {}).filter(
            (key) => item.metadata === null || !Object.hasOwn(item.metadata, key),
          )
        : [];
      if (liveOnly.length) {
        plans.push({
          kind: "product",
          testId: item.id,
          liveId,
          plan: "conflict",
          error: {
            status: 409,
            code: "live_metadata_not_in_test",
            message: `The live product's metadata has keys the test product doesn't: ${liveOnly.join(", ")}. Promote never clears them.`,
            details: { keys: liveOnly },
          },
        });
        continue;
      }
      const body: Json = { external_id: item.external_id };
      for (const field of PRODUCT_FIELDS)
        if (item[field] !== undefined && item[field] !== null) body[field] = item[field];
      if (item.metadata !== null) body.metadata = item.metadata;
      body.status = item.status;
      if (features.entries !== null) body.features = features.entries;
      const candidates = liveProduct
        ? []
        : candidatesFor("product", item, live.products, heldKeys(test.products));
      plans.push({
        kind: "product",
        testId: item.id,
        liveId,
        plan: "write",
        body,
        candidates,
        warnings: candidates.length ? [{ code: "possible_rename", path: "external_id" }] : [],
      });
    }
    return plans;
  };

  /** Runs a planned write on a live catalog: the keyed upsert of its kind. */
  const upsert = (catalog: Catalog, p: Plan, dryRun: boolean): Json => {
    const refusal = refusals.get(p.testId);
    if (refusal) throw refusal;
    const body = p.body!;
    const items = p.kind === "meter" ? catalog.meters : catalog.products;
    const existing = items.find((item) => item.external_id === body.external_id);
    if (!existing) {
      const created =
        p.kind === "meter"
          ? meterJson(nextId("mtr"), { ...body, status: "active" })
          : sideProduct("live", nextId("prod"), { ...body, features: [] });
      if (p.kind === "product" && body.features)
        created.features = applyFeatures([], body.features, () => nextId("feat"));
      items.push(created);
      return { liveId: created.id, result: "created", changes: [] };
    }
    const after = structuredClone(existing);
    for (const [key, value] of Object.entries(body)) if (key !== "features") after[key] = value;
    if (body.features)
      after.features = applyFeatures(existing.features ?? [], body.features, () => nextId("feat"));
    const changes = changesOf(
      existing,
      after,
      p.kind === "meter" ? METER_WRITE_FIELDS : PRODUCT_WRITE_FIELDS,
    );
    if (changes.length) Object.assign(existing, after);
    void dryRun;
    return { liveId: existing.id, result: changes.length ? "updated" : "unchanged", changes };
  };

  /** One reported item; `written` is the upsert's answer, or the error that refused it. */
  const report = (
    p: Plan,
    outcome: { written?: Json; error?: ApiError; dryRun: boolean },
  ): Json => {
    const base: Json = { kind: p.kind, test_id: p.testId, live_id: p.liveId };
    if (p.plan === "needs_key")
      return {
        ...base,
        result: "needs_key",
        candidates: p.candidates,
        ...(p.proposedExternalId !== undefined
          ? { proposed_external_id: p.proposedExternalId }
          : {}),
        feature_candidates: p.featureCandidates,
      };
    if (p.plan === "blocked") return { ...base, result: "blocked", blocked_by: p.blockedBy };
    if (p.plan === "conflict") return { ...base, result: "conflict", error: p.error };
    if (p.plan === "not_written") return { ...base, result: "not_written", error: p.error };
    if (outcome.error) {
      const { status, body } = outcome.error;
      return {
        ...base,
        result: status === 409 ? "conflict" : "failed",
        error: { status, code: body.code ?? null, message: body.message ?? String(body.code) },
      };
    }
    const written = outcome.written!;
    return {
      ...base,
      live_id: written.liveId,
      result: written.result,
      write_result: {
        result: written.result,
        dry_run: outcome.dryRun,
        changes: written.changes,
        warnings: p.warnings ?? [],
      },
      ...(p.candidates?.length ? { candidates: p.candidates } : {}),
    };
  };

  /** Runs every write of the plans on `catalog`; the refused ones carry their error. */
  const runWrites = (catalog: Catalog, plans: Plan[], dryRun: boolean) =>
    plans.map((p) => {
      if (p.plan !== "write") return report(p, { dryRun });
      try {
        return report(p, { written: upsert(catalog, p, dryRun), dryRun });
      } catch (error) {
        if (error instanceof ApiError) return report(p, { error, dryRun });
        throw error;
      }
    });

  const promote = (b: Json, dryRun: boolean): Json => {
    for (const kind of ["meters", "products"] as const) {
      const ids = b.select?.[kind];
      if (b.select && b.select[kind] === null) throw apiError(400, "validation_error");
      if (Array.isArray(ids))
        for (const id of ids)
          if (!find(stores.test, kind === "meters" ? "meter" : "product", id))
            throw apiError(400, "reference_not_found", `Unknown test ${kind} ${id}`, {
              field: `select.${kind}`,
              key: id,
            });
    }
    let runId: string;
    let run: Run;
    if (b.cursor === undefined || b.cursor === null) {
      runId = nextId("cprun");
      run = {
        select: b.select ?? null,
        dryRun,
        force: b.force === true,
        items: null,
        checkedBatches: 0,
        validation: null,
        offset: 0,
        pages: 0,
      };
      runs.set(runId, run);
    } else {
      const match = /^cur_(cprun_\d+)_\d+$/.exec(String(b.cursor));
      const found = match ? runs.get(match[1]) : undefined;
      if (!found || !same(found.select, b.select ?? null) || found.dryRun !== dryRun)
        throw apiError(
          400,
          "invalid_cursor",
          "The cursor wasn't issued for this select and dry_run.",
        );
      runId = match![1];
      run = found;
    }
    run.pages++;
    const realDryRun = dryRun && !options.ignoreDryRun;
    if (run.items === null) {
      const plans = plan(b.select);
      if (realDryRun) run.items = runWrites(structuredClone(stores.live), plans, true);
      else if (dryRun) run.items = runWrites(stores.live, plans, false);
      else {
        // The check: every write together, rolled back, within the page budget.
        run.checkedBatches++;
        const batches = options.checkBatches!;
        if (run.checkedBatches < batches) {
          run.validation = {
            scope: batches > 1 ? "per_layer" : "selection",
            batches,
            checked_batches: run.checkedBatches,
            passed: null,
            written: null,
          };
          return page(runId, run, []);
        }
        const checked = runWrites(structuredClone(stores.live), plans, true);
        const refused = checked.filter((i) => i.result === "conflict" || i.result === "failed");
        const refusedIds = new Set(
          refused
            .filter((i) => plans.find((p) => p.testId === i.test_id)?.plan === "write")
            .map((i) => i.test_id),
        );
        const passed = refusedIds.size === 0;
        const written = passed || run.force;
        run.validation = {
          scope: batches > 1 ? "per_layer" : "selection",
          batches,
          checked_batches: batches,
          passed,
          written,
        };
        run.items = plans.map((p, index) => {
          if (p.plan !== "write" || refusedIds.has(p.testId)) return checked[index];
          if (!written)
            return {
              kind: p.kind,
              test_id: p.testId,
              live_id: p.liveId,
              result: "not_written",
              error: {
                status: 409,
                code: "promote_check_failed",
                message: "The check failed for another item, and force wasn't sent.",
              },
            };
          if (changedAfterCheck.has(p.testId))
            return {
              kind: p.kind,
              test_id: p.testId,
              live_id: p.liveId,
              result: "not_written",
              error: {
                status: 409,
                code: "changed_since_check",
                message: "Its write isn't the one the run checked; promote again.",
              },
            };
          return runWrites(stores.live, [p], false)[0];
        });
      }
    }
    const items = run.items.slice(run.offset, run.offset + options.pageSize!);
    run.offset += items.length;
    return page(runId, run, items);
  };

  const page = (runId: string, run: Run, items: Json[]): Json => {
    const done = run.items !== null && run.offset >= run.items.length;
    const summary: Json = {
      created: 0,
      updated: 0,
      unchanged: 0,
      needs_key: 0,
      conflict: 0,
      failed: 0,
      blocked: 0,
      not_written: 0,
    };
    for (const item of items) summary[item.result]++;
    // The check's progress is on the pages that ran it and the first page with items.
    const validation =
      run.dryRun || (run.items !== null && run.offset > items.length) ? null : run.validation;
    return {
      run_id: runId,
      dry_run: run.dryRun && !options.ignoreDryRun,
      summary,
      items,
      validation,
      next_cursor: done ? null : `cur_${runId}_${run.pages}`,
    };
  };

  const respond = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const side: Side = url.hostname === "api.creem.io" ? "live" : "test";
    if (url.hostname !== "api.creem.io" && url.hostname !== "test-api.creem.io")
      throw new Error(`UNEXPECTED_FETCH ${request.method} ${url}`);
    const path = url.pathname;
    const text = request.method === "GET" ? "" : await request.text();
    const body = text ? (JSON.parse(text) as Json) : undefined;
    const dryRun = url.searchParams.get("dry_run") === "true";
    const call: CatalogCall = {
      side,
      method: request.method,
      path,
      query: url.search,
      ...(body ? { body } : {}),
      ...(dryRun ? { dryRun } : {}),
    };
    calls.push(call);
    const failure = failures.find((f) => f.match(call));
    if (failure) return Response.json(failure.body, { status: failure.status });
    try {
      const productMatch = /^\/v1\/products\/([^/]+)$/.exec(path);
      const meterMatch = /^\/v1\/meters\/([^/]+)$/.exec(path);
      if (request.method === "GET" && path === "/v1/products/search") {
        const key = url.searchParams.get("external_id");
        const items = stores[side].products.filter((p) => key === null || p.external_id === key);
        return Response.json({
          items,
          pagination: {
            total_records: items.length,
            total_pages: 1,
            current_page: 1,
            next_page: null,
            prev_page: null,
          },
        });
      }
      if (request.method === "GET" && productMatch) {
        const product = find(stores[side], "product", productMatch[1]);
        if (!product) throw apiError(404, "not_found");
        return Response.json(product);
      }
      if (request.method === "GET" && meterMatch) {
        const meter = find(stores[side], "meter", meterMatch[1]);
        if (!meter) throw apiError(404, "not_found");
        return Response.json(meter);
      }
      if (request.method === "PATCH" && productMatch)
        return Response.json(patch(side, "product", productMatch[1], body ?? {}, dryRun));
      if (request.method === "PATCH" && meterMatch)
        return Response.json(patch(side, "meter", meterMatch[1], body ?? {}, dryRun));
      if (request.method === "POST" && path === "/v1/catalog/promote") {
        if (side === "test") throw apiError(400, "live_only", "Promote runs on the live API.");
        return Response.json(promote(body ?? {}, dryRun));
      }
      return Response.json({ code: "not_found", path }, { status: 404 });
    } catch (error) {
      if (error instanceof ApiError) return Response.json(error.body, { status: error.status });
      throw error;
    }
  };

  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(input instanceof Request ? input : new Request(input, init)),
  );
  const client = (side: Side) =>
    new Creem({
      apiKey: side === "live" ? "creem_fixture_live" : "creem_test_fixture",
      server: side === "live" ? "prod" : "test",
      httpClient: new HTTPClient({ fetcher }),
      retryConfig: { strategy: "none" },
    });
  const isWrite = (c: CatalogCall) =>
    c.method !== "GET" && !c.dryRun && c.path !== "/v1/catalog/promote";
  return {
    stores,
    calls,
    test: client("test"),
    live: client("live"),
    options,
    /** PATCHes that write, on either side, in order. */
    writes: () => calls.filter(isWrite),
    /** `POST /v1/catalog/promote` calls. */
    promotes: () => calls.filter((c) => c.path === "/v1/catalog/promote"),
    /** Promote calls without `?dry_run=true`. */
    realRuns: () => calls.filter((c) => c.path === "/v1/catalog/promote" && !c.dryRun),
    fail(match: (call: CatalogCall) => boolean, status: number, body: Json) {
      failures.push({ match, status, body });
    },
    /** The check and the write of this test item answer this error (a guard). */
    refuse(testId: string, status: number, code: string, message = code) {
      refusals.set(testId, apiError(status, code, message));
    },
    /** This item's write changes between the check and the write (`changed_since_check`). */
    changeAfterCheck(testId: string) {
      changedAfterCheck.add(testId);
    },
  };
}
