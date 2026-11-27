import { openAsBlob } from "node:fs";
import type { Creem } from "creem";
import {
  createMeterApiRequestDtoToJSON,
  createProductRequestEntityToJSON,
  updateProductRequestEntityToJSON,
  type CatalogValidateItemRequestDto,
  type CatalogValidationItemResponseDto,
} from "creem/models/components";
import * as errors from "creem/models/errors";
import { describeError } from "../errors";
import { isRecord } from "../operation";
import { FILE_ID_METADATA } from "./lemon-squeezy/map";
import { UPLOAD_PREFIX, type MigrationPlan, type MigrationRequest } from "./plan";
import {
  summarize,
  type MigrationAction,
  type MigrationError,
  type MigrationItem,
  type MigrationReport,
} from "./report";

export interface CheckOptions {
  secrets?: string[];
  /** Pause after each request, against rate limits (as the writer does). */
  delayMs?: number;
  /** How to wait; tests replace it. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ExecuteOptions {
  /** Local copies of the files to upload, by source file id. */
  files: Record<string, { path: string }>;
  /** Used for the POST of file bytes to an upload slot. */
  fetch?: typeof fetch;
  /** Pause between writes, against rate limits. */
  delayMs?: number;
  secrets?: string[];
  /**
   * Run although Creem's check refused items: they stay failed and are not
   * sent, and the items that depend on them shrink or fail with the reason.
   */
  force?: boolean;
  onProgress?: (item: MigrationItem, request: MigrationRequest) => void;
  /** How to wait; tests replace it. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Creem answered a dry run without `write_result.dry_run: true`: a server that
 * doesn't know the dry run may have written the object. Nothing after it is sent.
 */
export class DryRunIgnoredError extends Error {
  /**
   * During a run: the report of what the run wrote before it stopped. Items it
   * didn't reach stay `pending`; the stopped item is `failed` (`dry_run_ignored`).
   */
  report?: MigrationReport;
  constructor(what: string, answered: unknown) {
    super(
      `Creem answered the dry run of ${what} with write_result.dry_run ${JSON.stringify(answered ?? null)} instead of true, so it may have written it. The migration stopped; nothing after it was sent.`,
    );
    this.name = "DryRunIgnoredError";
  }
}

/**
 * Creem's check couldn't finish: a request failed for a reason that says
 * nothing about the item (a 5xx, a timeout, a 401/403, a 429 after the
 * retries). Nothing was written.
 */
export class CreemCheckError extends Error {
  constructor(
    readonly status: number | null,
    what: string,
    detail: string,
  ) {
    super(
      `Creem's check couldn't finish: ${what} answered ${status ?? "no response"} (${detail}). Nothing was written.`,
    );
    this.name = "CreemCheckError";
  }
}

const statusOf = (error: unknown): number | null =>
  error instanceof errors.CreemError ? error.statusCode : null;

/**
 * Whether Creem refused the item itself: a 4xx, but not 401/403 (the key),
 * 408 (a timeout) or 429 (the rate limit), which say nothing about the item.
 */
const isRefusal = (status: number | null): boolean =>
  status !== null && status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status);

/**
 * Retries after a 429: three times, each as long as `Retry-After` says (1, 2,
 * then 4 s without it). A wait longer than a minute stops the migration.
 */
const RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 60_000;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Creem answered 429 with a `Retry-After` longer than the migrator waits between
 * retries. Sending earlier would only be refused again, so nothing after it is
 * sent: the check stops before any write; a run stops with the report of what
 * it wrote (`report`, as `DryRunIgnoredError`).
 */
export class RateLimitWaitError extends Error {
  report?: MigrationReport;
  constructor(
    readonly waitMs: number,
    what: string,
  ) {
    super(
      `Creem's rate limit asks to wait ${Math.ceil(waitMs / 1000)} s (Retry-After) before ${what} is sent again, longer than the migrator waits (${MAX_RETRY_WAIT_MS / 1000} s). The migration stopped there; nothing after it was sent.`,
    );
    this.name = "RateLimitWaitError";
  }
}

function retryAfterMs(error: unknown, attempt: number): number {
  const header = error instanceof errors.CreemError ? error.headers.get("retry-after") : null;
  let wait = 1000 * 2 ** attempt;
  if (header && /^\d+$/.test(header.trim())) wait = Number(header.trim()) * 1000;
  else if (header && !Number.isNaN(Date.parse(header))) wait = Date.parse(header) - Date.now();
  return Math.max(wait, 0);
}

/**
 * Sends a request again after a 429 (the API didn't process it), up to the
 * retries, waiting as long as Creem asks; a longer wait than a minute throws
 * `RateLimitWaitError`.
 */
async function retrying<T>(
  send: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  what: string,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (statusOf(error) !== 429 || attempt >= RATE_LIMIT_RETRIES) throw error;
      const wait = retryAfterMs(error, attempt);
      if (wait > MAX_RETRY_WAIT_MS) throw new RateLimitWaitError(wait, what);
      await sleep(wait);
    }
  }
}

/** The most items `POST /v1/catalog/validate` takes in one call. */
export const VALIDATE_BATCH_SIZE = 100;

const HINTS: Record<string, string> = {
  discount_redeemed:
    "The discount has been redeemed, so its amount, type, currency and duration are fixed. Create a new discount code in Creem for the new terms.",
  discount_managed_by_stripe:
    "The discount has a Stripe coupon, which keeps its terms. Create a new discount code in Creem for the new terms.",
  external_id_taken: "Another Creem object already uses this key; check for a duplicate.",
  license_keys_issued: "Customers hold keys of this license-key feature; it cannot be removed.",
  postpaid_usage_billing_unavailable:
    "Ask Creem support to enable postpaid usage billing, then run the migration again.",
};

/** What an error's hint may name: the item's key, and the plan's stored groups. */
interface HintContext {
  key: string;
  productGroupOf: MigrationPlan["productGroupOf"];
}

/** The hint for an error, with what the error's `details` name. */
function hintFor(
  code: string,
  details: Record<string, unknown>,
  about: HintContext,
): string | null {
  if (code === "product_already_grouped") {
    const ids = Array.isArray(details.product_ids)
      ? details.product_ids.filter((id): id is string => typeof id === "string")
      : [];
    const hints = ids.map((id) => {
      const group = about.productGroupOf[id];
      if (!group) return `Product ${id} is in another product group; take it out of that group.`;
      // A keyed group belongs to its key (another Lemon Squeezy product's, or
      // the merchant's own): giving it this key would take it from that one.
      if (group.externalId)
        return `Product ${id} is in product group ${group.id}, keyed ${group.externalId}. A product is in one group only: move it out of that group in Creem, then run the migration again.`;
      return `Product ${id} is in product group ${group.id}. If that is the group to migrate (one you made in the dashboard), give it the key: creem product-groups update ${group.id} --external-id ${about.key}. Otherwise take the product out of it.`;
    });
    return hints.length
      ? hints.join(" ")
      : "A product is in another product group; take it out of that group.";
  }
  return HINTS[code] ?? null;
}

/** A Creem error body (the endpoint's envelope) as a report error. */
function errorOf(
  body: unknown,
  status: number | null,
  about: HintContext,
  fallback: string,
): MigrationError {
  const api = isRecord(body) ? body : {};
  const code =
    typeof api.code === "string" ? api.code : typeof api.error === "string" ? api.error : fallback;
  const message = Array.isArray(api.message)
    ? api.message.join("; ")
    : typeof api.message === "string"
      ? api.message
      : code;
  const details = isRecord(api.details) ? api.details : {};
  return { code, message, status, hint: hintFor(code, details, about) };
}

function migrationError(error: unknown, secrets: string[], about: HintContext): MigrationError {
  const { result } = describeError(error, secrets);
  const body = isRecord(result.error.details) ? result.error.details : {};
  const migration = errorOf(body, result.error.status, about, result.error.type);
  return { ...migration, message: result.error.message };
}

const ACTIONS: Record<string, MigrationAction> = {
  created: "create",
  updated: "update",
  unchanged: "unchanged",
};
/** `write_result.result` as a report action; a value this CLI doesn't know is an update. */
const actionOf = (result: string): MigrationAction => ACTIONS[result] ?? "update";

interface WriteAnswer {
  id: string;
  writeResult: {
    result: string;
    dryRun: boolean;
    warnings: { code: string; path?: string | undefined; key?: string | undefined }[];
    changes?: { path: string }[];
  };
}

/** Sends one catalog write of a plan, or its dry run. */
async function send(
  client: Creem,
  request: Exclude<MigrationRequest, { type: "upload_file" }>,
  dryRun: boolean,
): Promise<WriteAnswer> {
  switch (request.type) {
    case "upsert_meter":
      return client.meters.createMeter({ ...request.request, dryRun });
    case "adopt_product":
    case "update_product":
      return client.products.update({ ...request.request, dryRun });
    case "upsert_product":
      return client.products.create({ ...request.request, dryRun });
    case "upsert_product_group":
      return client.productGroups.create({ ...request.request, dryRun });
    case "adopt_discount":
    case "update_discount":
      return client.discounts.update({ ...request.request, dryRun });
    case "upsert_discount":
      return client.discounts.create({ ...request.request, dryRun });
  }
}

const describeRequest = (request: MigrationRequest) => `${request.type} ${request.key}`;

function assertDryRun(request: MigrationRequest, answer: { writeResult?: { dryRun?: unknown } }) {
  if (answer.writeResult?.dryRun !== true)
    throw new DryRunIgnoredError(describeRequest(request), answer.writeResult?.dryRun);
}

/**
 * Sends a write as a dry run. A success the SDK can't read as a write answer
 * (no `write_result`: a server without the dry run, which may have written it)
 * is a `DryRunIgnoredError` too, never a refusal of the item.
 */
async function sendDryRun(
  client: Creem,
  request: Exclude<MigrationRequest, { type: "upload_file" }>,
): Promise<WriteAnswer> {
  let answer: WriteAnswer;
  try {
    answer = await send(client, request, true);
  } catch (error) {
    // A success the SDK can't read; an error answer it can't read keeps its status.
    if (error instanceof errors.ResponseValidationError && error.statusCode < 300) {
      const raw = isRecord(error.rawValue) ? error.rawValue : {};
      const writeResult = isRecord(raw.write_result) ? raw.write_result : {};
      throw new DryRunIgnoredError(describeRequest(request), writeResult.dry_run);
    }
    throw error;
  }
  assertDryRun(request, answer);
  return answer;
}

function itemFinder(report: MigrationReport) {
  const items = new Map(report.items.map((item) => [`${item.kind}:${item.key}`, item]));
  return (request: MigrationRequest): MigrationItem => {
    const kind =
      request.type === "upload_file"
        ? "file"
        : request.type === "upsert_meter"
          ? "meter"
          : request.type === "upsert_product_group"
            ? "product_group"
            : request.type.endsWith("discount")
              ? "discount"
              : "product";
    const item = items.get(`${kind}:${request.key}`);
    if (!item) throw new Error(`No report item for ${kind} ${request.key}`);
    return item;
  };
}

/** A product body without the file entries that wait for an upload of this run. */
function withoutPendingUploads<T extends { features?: unknown[] | null | undefined }>(
  body: T,
): { body: T; partial: boolean } {
  const copy = structuredClone(body);
  let partial = false;
  if (!copy.features) return { body: copy, partial };
  copy.features = copy.features.filter((feature) => {
    if (!isRecord(feature) || feature.type !== "file" || !isRecord(feature.file)) return true;
    const files = Array.isArray(feature.file.files) ? feature.file.files : [];
    const kept = files.filter(
      (file) =>
        !(isRecord(file) && typeof file.id === "string" && file.id.startsWith(UPLOAD_PREFIX)),
    );
    if (kept.length === files.length) return true;
    partial = true;
    feature.file.files = kept;
    return kept.length > 0;
  });
  if (!copy.features.length) delete copy.features;
  return { body: copy, partial };
}

type ValidatedRequest = Extract<
  MigrationRequest,
  { type: "upsert_meter" | "adopt_product" | "update_product" | "upsert_product" }
>;

/** The body of a product write. */
const productBodyOf = (request: Exclude<ValidatedRequest, { type: "upsert_meter" }>) =>
  request.type === "upsert_product"
    ? request.request.createProductRequestEntity
    : request.request.updateProductRequestEntity;

/**
 * The validate batches of a plan's meter and product writes, at most 100 items
 * each. Every product is in a batch with the new meters its usage prices name,
 * so Creem checks the price against the meter (a meter repeats across batches
 * when it must); the meters no usage price names go in the first batch.
 */
function validateBatches(requests: ValidatedRequest[]): ValidatedRequest[][] {
  const meters = new Map(
    requests.flatMap((r) => (r.type === "upsert_meter" ? [[r.key, r] as const] : [])),
  );
  const named = (request: Exclude<ValidatedRequest, { type: "upsert_meter" }>) => [
    ...new Set(
      (productBodyOf(request).usagePrices ?? []).flatMap((u) =>
        u.meterExternalId && meters.has(u.meterExternalId) ? [u.meterExternalId] : [],
      ),
    ),
  ];
  const products = requests.filter(
    (r): r is Exclude<ValidatedRequest, { type: "upsert_meter" }> => r.type !== "upsert_meter",
  );
  const used = new Set(products.flatMap(named));
  const batches: ValidatedRequest[][] = [];
  let batch = { meters: new Set<string>(), products: [] as ValidatedRequest[] };
  const flush = () => {
    if (batch.meters.size || batch.products.length)
      batches.push([...[...batch.meters].map((key) => meters.get(key)!), ...batch.products]);
    batch = { meters: new Set(), products: [] };
  };
  for (const key of meters.keys()) {
    if (used.has(key)) continue;
    if (batch.meters.size >= VALIDATE_BATCH_SIZE) flush();
    batch.meters.add(key);
  }
  for (const request of products) {
    const missing = () => named(request).filter((key) => !batch.meters.has(key));
    if (batch.meters.size + batch.products.length + missing().length + 1 > VALIDATE_BATCH_SIZE)
      flush();
    for (const key of missing()) batch.meters.add(key);
    batch.products.push(request);
  }
  flush();
  return batches;
}

/** A meter or product write as an item of `POST /v1/catalog/validate`, in the API's own shape. */
function validateItem(request: ValidatedRequest): {
  item: CatalogValidateItemRequestDto;
  partial: boolean;
} {
  if (request.type === "upsert_meter")
    return {
      item: {
        kind: "meter",
        body: JSON.parse(createMeterApiRequestDtoToJSON(request.request.createMeterApiRequestDto)),
      },
      partial: false,
    };
  if (request.type === "upsert_product") {
    const { body, partial } = withoutPendingUploads(request.request.createProductRequestEntity);
    return {
      item: { kind: "product", body: JSON.parse(createProductRequestEntityToJSON(body)) },
      partial,
    };
  }
  const { body, partial } = withoutPendingUploads(request.request.updateProductRequestEntity);
  return {
    item: {
      kind: "product",
      id: request.request.id,
      body: JSON.parse(updateProductRequestEntityToJSON(body)),
    },
    partial,
  };
}

/**
 * Checks a plan with Creem before anything is written (ENG-2972):
 *
 * - the meter and product writes go to `POST /v1/catalog/validate` together, in
 *   batches of 100, so they are checked against each other in one rolled-back
 *   run; each product is in a batch with the new meters it names
 *   (`validateBatches`), and a product priced on a meter Creem refuses fails too;
 * - each product group and discount write runs with `?dry_run=true` (validate
 *   takes neither kind yet). A product the run creates is named by its key, which
 *   a dry run reports as a `reference_not_found` warning, not an error.
 *
 * Every answer must carry `write_result.dry_run: true`, or the check throws
 * `DryRunIgnoredError` and nothing more is sent. An item Creem refuses is
 * `failed` with Creem's error. An item whose every write Creem answers
 * `unchanged` is `unchanged` and is not sent. File uploads are not checked:
 * there is no dry run for them, and a file entry waiting for one is left out
 * of the checked body.
 */
export async function checkMigration(
  client: Creem,
  plan: MigrationPlan,
  options: CheckOptions = {},
): Promise<MigrationPlan> {
  const report: MigrationReport = structuredClone(plan.report);
  const secrets = options.secrets ?? [];
  const sleep = options.sleep ?? defaultSleep;
  const pause = async () => {
    if (options.delayMs) await sleep(options.delayMs);
  };
  /** A failure that isn't Creem refusing the item stops the check. */
  const stop = (error: unknown, what: string): CreemCheckError => {
    const { result } = describeError(error, secrets);
    return new CreemCheckError(statusOf(error), what, result.error.message);
  };
  const itemOf = itemFinder(report);
  const about = (item: MigrationItem): HintContext => ({
    key: item.key,
    productGroupOf: plan.productGroupOf,
  });
  /**
   * Keys of the products this run creates (once validate has answered, the ones
   * it didn't refuse): a dry run names them as unknown references. Meters too, from the start.
   */
  let created = new Set<string>(
    report.items.filter((i) => i.kind === "meter" && i.action === "create").map((i) => i.key),
  );
  const results = new Map<MigrationItem, { results: string[]; partial: boolean }>();
  const refuse = (item: MigrationItem, error: MigrationError) => {
    item.status = "failed";
    item.error = error;
  };
  const record = (
    item: MigrationItem,
    answer: { id?: unknown; result: string; changes?: unknown },
    warnings: { code: string; path?: string | null; key?: string | null }[],
    partial: boolean,
  ) => {
    const { result } = answer;
    // A plan that leaves comparing to Creem names no changes, or only the key an
    // adoption gives: Creem's answer names the rest.
    if (Array.isArray(answer.changes) && item.changes.every((c) => c === "external_id"))
      item.changes = [
        ...new Set([
          ...item.changes,
          ...answer.changes.flatMap((c) => (isRecord(c) ? [String(c.path)] : [])),
        ]),
      ];
    // An object that exists already (another run wrote it) has a real id; the id
    // of one a dry run would create is never stored.
    if (result !== "created" && !item.creem_id && typeof answer.id === "string")
      item.creem_id = answer.id;
    const entry = results.get(item) ?? { results: [], partial: false };
    entry.results.push(result);
    entry.partial ||= partial;
    results.set(item, entry);
    for (const warning of warnings) {
      // The dry run couldn't see that product, so its answer (often `unchanged`:
      // the stored set stays) says nothing about the real write, which is kept.
      if (warning.code === "reference_not_found" && warning.key && created.has(warning.key)) {
        entry.partial = true;
        continue;
      }
      const where = [warning.path, warning.key].filter(Boolean).join(" ");
      const issue = {
        code: warning.code,
        message: `Creem's dry run warns ${warning.code}${where ? ` (${where})` : ""}.`,
      };
      if (!item.warnings.some((w) => w.code === issue.code && w.message === issue.message))
        item.warnings.push(issue);
    }
  };

  // Meters first: a product's usage price names a meter of its batch by key.
  const products = plan.requests.filter(
    (r): r is ValidatedRequest =>
      r.type === "upsert_meter" ||
      r.type === "adopt_product" ||
      r.type === "update_product" ||
      r.type === "upsert_product",
  );
  // Without product writes, an empty validate first: a server that doesn't know
  // validate (nor, then, the dry run) answers it with an error before any
  // catalog write, even a dry run, reaches it.
  if (!products.length && plan.requests.some((r) => r.type !== "upload_file")) {
    try {
      await retrying(
        () => client.catalog.validate({ items: [] }),
        sleep,
        "POST /v1/catalog/validate",
      );
    } catch (error) {
      if (error instanceof RateLimitWaitError) throw error;
      throw stop(error, "POST /v1/catalog/validate");
    }
    await pause();
  }
  for (const chunk of validateBatches(products)) {
    const batch = chunk.map(validateItem);
    let answers: CatalogValidationItemResponseDto[];
    try {
      answers = (
        await retrying(
          () => client.catalog.validate({ items: batch.map((b) => b.item) }),
          sleep,
          "POST /v1/catalog/validate",
        )
      ).items;
    } catch (error) {
      if (error instanceof RateLimitWaitError) throw error;
      if (!(error instanceof errors.CatalogValidationResponseDto))
        throw stop(error, "POST /v1/catalog/validate");
      answers = error.items;
    }
    await pause();
    if (answers.length !== chunk.length)
      throw new Error(
        `POST /v1/catalog/validate answered ${answers.length} items for the ${chunk.length} it was sent; nothing was written.`,
      );
    answers.forEach((answer, index) => {
      const request = chunk[index];
      const item = itemOf(request);
      if (!answer.valid) {
        if (!isRefusal(answer.status))
          throw new CreemCheckError(
            answer.status,
            `${describeRequest(request)} in POST /v1/catalog/validate`,
            errorOf(answer.error, answer.status, about(item), "validation_failed").message,
          );
        refuse(item, errorOf(answer.error, answer.status, about(item), "validation_failed"));
        return;
      }
      const writeResult = isRecord(answer.response?.write_result)
        ? answer.response.write_result
        : {};
      if (writeResult.dry_run !== true)
        throw new DryRunIgnoredError(
          `${describeRequest(request)} in POST /v1/catalog/validate`,
          writeResult.dry_run,
        );
      record(
        item,
        {
          id: answer.response?.id,
          result: String(writeResult.result),
          changes: writeResult.changes,
        },
        Array.isArray(writeResult.warnings) ? writeResult.warnings : [],
        batch[index].partial,
      );
    });
  }

  // A product priced on a meter the check refused can't be written either; its
  // own answer (often `reference_not_found` for the meter) doesn't say why.
  const refusedMeters = new Set(
    report.items.filter((i) => i.kind === "meter" && i.status === "failed").map((i) => i.key),
  );
  for (const request of products) {
    if (request.type === "upsert_meter") continue;
    const item = itemOf(request);
    const meters = [
      ...new Set(
        (productBodyOf(request).usagePrices ?? []).flatMap((u) =>
          u.meterExternalId && refusedMeters.has(u.meterExternalId) ? [u.meterExternalId] : [],
        ),
      ),
    ];
    if (!meters.length || (item.status === "failed" && item.error?.code !== "reference_not_found"))
      continue;
    refuse(item, {
      code: "dependency_failed",
      message: `Creem's check refused its meter ${meters.join(", ")}, so the product is not written.`,
      status: null,
      hint: "Fix the meter (see its error), then run the migration again.",
    });
  }

  // An adopted product gets its key only when its PATCH runs, so a dry run can't
  // find it by key either: it counts as created here.
  created = new Set(
    report.items
      .filter(
        (i) =>
          (i.kind === "product" || i.kind === "meter") &&
          (i.action === "create" || i.adopted_from) &&
          i.status !== "failed",
      )
      .map((i) => i.key),
  );

  // A refused product's uploads would attach to nothing, so they are not sent.
  for (const request of products) {
    const item = itemOf(request);
    if (item.status !== "failed" || request.type === "upsert_meter") continue;
    for (const entry of productBodyOf(request).features ?? []) {
      const feature: unknown = entry;
      if (!isRecord(feature) || feature.type !== "file" || !isRecord(feature.file)) continue;
      for (const file of Array.isArray(feature.file.files) ? feature.file.files : []) {
        if (!isRecord(file) || typeof file.id !== "string" || !file.id.startsWith(UPLOAD_PREFIX))
          continue;
        const fileItem = report.items.find(
          (i) => i.kind === "file" && i.key === String(file.id).slice(UPLOAD_PREFIX.length),
        );
        if (!fileItem) continue;
        fileItem.action = "skip";
        fileItem.status = null;
        fileItem.reason = {
          code: "product_refused",
          message: `Not uploaded: Creem's check refused its product ${item.key}.`,
        };
      }
    }
  }

  // Product ids the preview can name: stored ones; the others go by key.
  const storedIds = new Map(
    report.items
      .filter((i) => i.kind === "product" && i.creem_id && i.action !== "create")
      .map((i) => [i.key, i.creem_id as string]),
  );
  for (const original of plan.requests) {
    if (
      original.type !== "adopt_discount" &&
      original.type !== "update_discount" &&
      original.type !== "upsert_discount" &&
      original.type !== "upsert_product_group"
    )
      continue;
    const request = structuredClone(original);
    const item = itemOf(request);
    if (item.status === "failed") continue;
    // A write that names a product this run creates or adopts changes once that
    // product exists, whatever its dry run answers now: it is kept (`partial`).
    // Read from the full request, not the preview, which may leave keys out.
    const named =
      request.type === "upsert_product_group"
        ? (request.request.createProductGroupRequestEntity.products ?? []).flatMap((p) =>
            "externalId" in p ? [p.externalId] : [],
          )
        : ((request.type === "upsert_discount"
            ? request.request.createDiscountRequestEntity
            : request.request.updateDiscountRequestEntity
          ).appliesToProductExternalIds ?? []);
    let partial = named.some((key) => created.has(key));
    if (request.type !== "upsert_product_group") {
      const body =
        request.type === "upsert_discount"
          ? request.request.createDiscountRequestEntity
          : request.request.updateDiscountRequestEntity;
      const keys = body.appliesToProductExternalIds ?? [];
      if (keys.length) {
        body.appliesToProducts = [
          ...(body.appliesToProducts ?? []),
          ...keys.filter((k) => storedIds.has(k)).map((k) => storedIds.get(k)!),
        ];
        // Keys of products this run creates; the API takes 100. A preview cut
        // there can't see the rest, so its answer is partial.
        const unknown = keys.filter((k) => !storedIds.has(k));
        body.appliesToProductExternalIds = unknown.slice(0, VALIDATE_BATCH_SIZE);
        if (unknown.length > VALIDATE_BATCH_SIZE) partial = true;
        if (!body.appliesToProductExternalIds.length) delete body.appliesToProductExternalIds;
      }
    }
    try {
      const answer = await retrying(
        () => sendDryRun(client, request),
        sleep,
        `the dry run of ${describeRequest(request)}`,
      );
      record(
        item,
        { id: answer.id, result: answer.writeResult.result, changes: answer.writeResult.changes },
        answer.writeResult.warnings,
        partial,
      );
    } catch (error) {
      if (error instanceof DryRunIgnoredError || error instanceof RateLimitWaitError) throw error;
      if (!isRefusal(statusOf(error)))
        throw stop(error, `the dry run of ${describeRequest(request)}`);
      refuse(item, migrationError(error, secrets, about(item)));
    }
    await pause();
  }

  for (const [item, { results: answers, partial }] of results) {
    if (item.status === "failed" || partial || item.adopted_from) continue;
    if (answers.every((r) => r === "unchanged")) {
      item.action = "unchanged";
      item.status = null;
      item.changes = [];
    } else if (answers.includes("created")) item.action = "create";
    else item.action = "update";
  }
  report.summary = summarize(report.items);
  return { ...plan, report };
}

/**
 * Sends a checked plan's requests in order and returns the report with each
 * item's outcome. Each catalog write runs with `?dry_run=true` right before it
 * is sent, so the exact request, with the ids of this run's uploads and
 * products, is checked first; a refused dry run fails the item without writing
 * it. A failed item never stops the run: the items that depend on it (a product
 * on its file upload, a group or discount on its products) fail or shrink with
 * the reason, and everything else goes on. A dry run answered as a real write
 * stops the run (`DryRunIgnoredError`).
 */
export async function executeMigration(
  client: Creem,
  plan: MigrationPlan,
  options: ExecuteOptions,
): Promise<MigrationReport> {
  if (plan.answerErrors.length)
    throw new Error(
      `The plan has adoption answers that can't be applied: ${plan.answerErrors.map((e) => e.message).join(" ")}`,
    );
  const refused = plan.report.items.filter((i) => i.status === "failed");
  if (refused.length && !options.force)
    throw new Error(
      `Creem's check refused ${refused.length} item(s) (${refused.map((i) => i.key).join(", ")}), so nothing was written. Fix them, or force the run to write the rest.`,
    );
  const report: MigrationReport = structuredClone(plan.report);
  report.mode = "run";
  const secrets = options.secrets ?? [];
  const sendBytes = options.fetch ?? ((...args) => fetch(...args));
  const itemOf = itemFinder(report);
  const about = (item: MigrationItem): HintContext => ({
    key: item.key,
    productGroupOf: plan.productGroupOf,
  });
  const uploaded = new Map<string, string>();
  const failedKeys = new Set<string>(refused.map((i) => i.key));
  // Products that exist in Creem with their key after the run: stored ones, and
  // those written now. A refused update leaves the stored product as it is, so
  // it stays in its group and discounts. An adopted product is the migrated one
  // only once its PATCH gave it the key, so it is added then, never before.
  const productIds = new Map(
    report.items
      .filter(
        (i) =>
          i.kind === "product" &&
          i.creem_id &&
          !i.adopted_from &&
          (i.action === "unchanged" || i.action === "update"),
      )
      .map((i) => [i.key, i.creem_id as string]),
  );
  // Uploaded files a product write names, so a failed write can report them unattached.
  const uploadsOf = new Map<string, string[]>();
  const fail = (item: MigrationItem, error: MigrationError) => {
    item.status = "failed";
    item.error = error;
    failedKeys.add(item.key);
  };
  /** Items whose write went through, for the report of a run that stops. */
  const written = new Set<MigrationItem>();
  const sleep = options.sleep ?? defaultSleep;
  const pause = async () => {
    if (options.delayMs) await sleep(options.delayMs);
  };
  /**
   * The item's write shrank to nothing (the products it would add weren't
   * written), so no request is sent: Creem keeps it as it is, and the report
   * says so instead of an update that never happened.
   */
  const nothingSent = (item: MigrationItem) => {
    item.action = "unchanged";
    item.status = null;
    item.changes = [];
  };

  /**
   * Swaps `upload:<key>` file ids for uploaded ones: in file features, and in
   * the migrator's own `ls_file_<id>_file_id` metadata keys (the merchant's
   * metadata is sent back as it is). False if an upload failed; every upload
   * that did resolve is still recorded, so a failed write reports it unattached.
   */
  const resolveFiles = (
    body: { features?: unknown[] | null; metadata?: Record<string, unknown> | null },
    item: MigrationItem,
  ): boolean => {
    const keys: string[] = [];
    const missing: string[] = [];
    const resolve = (value: string): string => {
      const key = value.slice(UPLOAD_PREFIX.length);
      const id = uploaded.get(key);
      if (!id) {
        if (!missing.includes(key)) missing.push(key);
        return value;
      }
      if (!keys.includes(key)) keys.push(key);
      return id;
    };
    for (const [name, value] of Object.entries(body.metadata ?? {}))
      if (
        FILE_ID_METADATA.test(name) &&
        typeof value === "string" &&
        value.startsWith(UPLOAD_PREFIX)
      )
        body.metadata![name] = resolve(value);
    for (const feature of body.features ?? []) {
      if (!isRecord(feature) || feature.type !== "file" || !isRecord(feature.file)) continue;
      const files = Array.isArray(feature.file.files) ? feature.file.files : [];
      for (const file of files)
        if (isRecord(file) && typeof file.id === "string" && file.id.startsWith(UPLOAD_PREFIX))
          file.id = resolve(file.id);
    }
    uploadsOf.set(item.key, keys);
    if (!missing.length) return true;
    fail(item, {
      code: "dependency_failed",
      message: `The upload of ${missing.join(", ")} failed, so the product was not written.`,
      status: null,
      hint: "Re-run the migration to retry.",
    });
    return false;
  };

  /**
   * Turns a discount's product keys into Creem ids (`applies_to_products` has
   * no size limit; `applies_to_product_external_ids` takes at most 100), and
   * drops the products that do not exist after this run.
   */
  const resolveProducts = (keys: string[] | undefined, item: MigrationItem): string[] => {
    const kept = (keys ?? []).filter((key) => productIds.has(key));
    const dropped = (keys ?? []).filter((key) => !productIds.has(key));
    if (dropped.length)
      item.warnings.push({
        code: "product_not_written",
        message: `Left out of the discount because they were not written: ${dropped.join(", ")}. Re-run to add them.`,
      });
    return kept.map((key) => productIds.get(key)!);
  };

  for (const original of plan.requests) {
    const request = structuredClone(original);
    const item = itemOf(request);
    if (item.status !== "pending") continue;
    options.onProgress?.(item, request);
    try {
      if (request.type === "upload_file") {
        const local = options.files[request.lsFileId];
        if (!local) throw new Error(`No local copy of file ${request.lsFileId}`);
        const slot = await client.files.createUpload(request.request);
        const form = new FormData();
        for (const [name, value] of Object.entries(slot.uploadFields)) form.append(name, value);
        const blob = await openAsBlob(local.path, { type: request.request.contentType });
        form.append("file", blob, request.request.filename);
        const response = await sendBytes(slot.uploadUrl, { method: "POST", body: form });
        if (!response.ok)
          throw Object.assign(
            new Error(`Upload to storage failed (${response.status}): ${await response.text()}`),
            { statusCode: response.status },
          );
        const file = await client.files.confirmUpload({ id: slot.id });
        uploaded.set(request.key, file.id);
        item.creem_id = file.id;
        written.add(item);
        await pause();
        continue;
      }
      // Resolve what this run's earlier writes decided.
      switch (request.type) {
        case "upsert_product":
        case "adopt_product":
        case "update_product": {
          const body =
            request.type === "upsert_product"
              ? request.request.createProductRequestEntity
              : request.request.updateProductRequestEntity;
          // A usage price on a meter this run failed to write would change what
          // buyers pay, so none of the product is written.
          const meters = (body.usagePrices ?? []).flatMap((u) =>
            u.meterExternalId && failedKeys.has(u.meterExternalId) ? [u.meterExternalId] : [],
          );
          if (meters.length) {
            fail(item, {
              code: "dependency_failed",
              message: `Its meter ${meters.join(", ")} was not written, so the product was not written.`,
              status: null,
              hint: "Re-run the migration to retry.",
            });
            continue;
          }
          if (!resolveFiles(body, item)) continue;
          break;
        }
        case "upsert_product_group": {
          const body = request.request.createProductGroupRequestEntity;
          // A member by id is the merchant's own, kept as it is. Each product is
          // named once (the API refuses a repeat), whether by id or by key.
          const seen = new Set<string>();
          const kept = (body.products ?? []).filter((p) => {
            const id = "externalId" in p ? productIds.get(p.externalId) : p.id;
            if (id === undefined || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          const missing = (body.products ?? []).flatMap((p) =>
            "externalId" in p && !productIds.has(p.externalId) ? [p.externalId] : [],
          );
          if (kept.length < 2) {
            fail(item, {
              code: "dependency_failed",
              message: `Fewer than two of the group's products were written (${missing.join(", ")} not), so the group was not written.`,
              status: null,
              hint: "Re-run the migration to retry.",
            });
            continue;
          }
          if (missing.length)
            item.warnings.push({
              code: "product_not_written",
              message: `Left out of the group because they were not written: ${missing.join(", ")}. Re-run to add them.`,
            });
          body.products = kept;
          break;
        }
        case "upsert_discount": {
          const body = request.request.createDiscountRequestEntity;
          if (item.action === "create") {
            body.appliesToProducts = [
              ...(body.appliesToProducts ?? []),
              ...resolveProducts(body.appliesToProductExternalIds, item),
            ];
            delete body.appliesToProductExternalIds;
            if (!body.appliesToProducts.length) {
              fail(item, {
                code: "dependency_failed",
                message: "None of the discount's products was written.",
                status: null,
                hint: "Re-run the migration to retry.",
              });
              continue;
            }
            break;
          }
          if (body.appliesToProductExternalIds) {
            const ids = resolveProducts(body.appliesToProductExternalIds, item);
            delete body.appliesToProductExternalIds;
            // Without one migrated product written, the stored set stays as it is.
            if (ids.length) body.appliesToProducts = [...(body.appliesToProducts ?? []), ...ids];
            else delete body.appliesToProducts;
          }
          // Only the key is left: nothing to change.
          if (Object.keys(body).length === 1) {
            nothingSent(item);
            continue;
          }
          break;
        }
        case "adopt_discount":
        case "update_discount": {
          const body = request.request.updateDiscountRequestEntity;
          if (body.appliesToProductExternalIds) {
            const ids = resolveProducts(body.appliesToProductExternalIds, item);
            delete body.appliesToProductExternalIds;
            if (ids.length) body.appliesToProducts = [...(body.appliesToProducts ?? []), ...ids];
            else delete body.appliesToProducts;
          }
          if (!Object.keys(body).length) {
            nothingSent(item);
            continue;
          }
          break;
        }
      }
      // The exact request runs as a dry run first; a refusal fails the item unwritten.
      await retrying(
        () => sendDryRun(client, request),
        sleep,
        `the dry run of ${describeRequest(request)}`,
      );
      const answer = await retrying(
        () => send(client, request, false),
        sleep,
        describeRequest(request),
      );
      written.add(item);
      switch (request.type) {
        case "upsert_meter":
          item.creem_id = answer.id;
          item.action = actionOf(answer.writeResult.result);
          break;
        case "adopt_product":
          productIds.set(request.key, request.request.id);
          break;
        case "upsert_product":
          item.creem_id = answer.id;
          productIds.set(request.key, answer.id);
          if (!item.adopted_from) item.action = actionOf(answer.writeResult.result);
          break;
        case "upsert_product_group":
        case "upsert_discount":
          item.creem_id = answer.id;
          if (!item.adopted_from) item.action = actionOf(answer.writeResult.result);
          break;
      }
    } catch (error) {
      if (error instanceof DryRunIgnoredError || error instanceof RateLimitWaitError) {
        // What was written before it stays reported; the rest stays pending.
        item.status = "failed";
        item.error =
          error instanceof DryRunIgnoredError
            ? {
                code: "dry_run_ignored",
                message: error.message,
                status: null,
                hint: "Check the Creem environment and API version, then re-run: written items are found by their key.",
              }
            : {
                code: "rate_limited",
                message: error.message,
                status: 429,
                hint: `Re-run in ${Math.ceil(error.waitMs / 1000)} s: written items are found by their key.`,
              };
        for (const done of report.items) if (written.has(done)) done.status = "done";
        report.summary = summarize(report.items);
        error.report = report;
        throw error;
      }
      fail(item, migrationError(error, secrets, about(item)));
      if (request.type === "adopt_product" || request.type === "adopt_discount")
        item.error!.message = `Adopting ${request.request.id} failed: ${item.error!.message}`;
    }
    await pause();
  }
  // The API can't look files up, so a confirmed upload whose product write
  // failed is uploaded again by the next run. The unattached copy is never
  // delivered to buyers; it is reported so the duplicate is known.
  const fileItems = new Map(report.items.filter((i) => i.kind === "file").map((i) => [i.key, i]));
  for (const [productKey, fileKeys] of uploadsOf) {
    if (!failedKeys.has(productKey)) continue;
    for (const key of fileKeys) {
      const fileItem = fileItems.get(key);
      if (!fileItem) continue;
      fileItem.warnings.push({
        code: "file_not_attached",
        message: `File ${uploaded.get(key)} was uploaded, but its product ${productKey} was not written, so it is attached to nothing and never delivered. The API can't look files up, so the next run uploads it again.`,
      });
    }
  }
  // Only what went through is done; nothing else is reported as sent.
  for (const item of report.items) if (written.has(item)) item.status = "done";
  report.summary = summarize(report.items);
  return report;
}
