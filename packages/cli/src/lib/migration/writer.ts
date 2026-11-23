import { openAsBlob } from "node:fs";
import type { Creem } from "creem";
import {
  createProductRequestEntityToJSON,
  updateProductRequestEntityToJSON,
  type CatalogValidateItemRequestDto,
  type CatalogValidationItemResponseDto,
} from "creem/models/components";
import * as errors from "creem/models/errors";
import { describeError } from "../errors";
import { isRecord } from "../operation";
import {
  FILE_ID_METADATA,
  UPLOAD_PREFIX,
  type MigrationPlan,
  type MigrationRequest,
} from "./lemon-squeezy/map";
import {
  summarize,
  type MigrationAction,
  type MigrationError,
  type MigrationItem,
  type MigrationReport,
} from "./report";

export interface CheckOptions {
  secrets?: string[];
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

/** The most items `POST /v1/catalog/validate` takes in one call. */
export const VALIDATE_BATCH_SIZE = 100;

const HINTS: Record<string, string> = {
  discount_redeemed:
    "The discount has been redeemed, so its amount, type, currency and duration are fixed. Create a new discount code in Creem for the new terms.",
  discount_managed_by_stripe:
    "The discount has a Stripe coupon, which keeps its terms. Create a new discount code in Creem for the new terms.",
  external_id_taken: "Another Creem object already uses this key; check for a duplicate.",
  license_keys_issued: "Customers hold keys of this license-key feature; it cannot be removed.",
};

/** The hint for an error, with what the error's `details` name. */
function hintFor(code: string, details: Record<string, unknown>, key: string): string | null {
  if (code === "product_already_grouped") {
    const group = typeof details.product_group_id === "string" ? details.product_group_id : null;
    const product =
      typeof details.product_id === "string" ? `Product ${details.product_id}` : "A product";
    return group
      ? `${product} is in product group ${group}. If that is the group to migrate (one you made in the dashboard), give it the key: creem product-groups update ${group} --external-id ${key}. Otherwise take the product out of it.`
      : `${product} is in another product group; take it out of that group, or give that group the key ${key}.`;
  }
  return HINTS[code] ?? null;
}

/** A Creem error body (the endpoint's envelope) as a report error. */
function errorOf(
  body: unknown,
  status: number | null,
  key: string,
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
  return { code, message, status, hint: hintFor(code, details, key) };
}

function migrationError(error: unknown, secrets: string[], key: string): MigrationError {
  const { result } = describeError(error, secrets);
  const body = isRecord(result.error.details) ? result.error.details : {};
  const migration = errorOf(body, result.error.status, key, result.error.type);
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
  };
}

/** Sends one catalog write of a plan, or its dry run. */
async function send(
  client: Creem,
  request: Exclude<MigrationRequest, { type: "upload_file" }>,
  dryRun: boolean,
): Promise<WriteAnswer> {
  switch (request.type) {
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
    if (error instanceof errors.ResponseValidationError) {
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

/** A product write as an item of `POST /v1/catalog/validate`, in the API's own shape. */
function validateItem(
  request: Extract<
    MigrationRequest,
    { type: "adopt_product" | "update_product" | "upsert_product" }
  >,
): { item: CatalogValidateItemRequestDto; partial: boolean } {
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
 * - the product writes go to `POST /v1/catalog/validate` together, in batches
 *   of 100, so they are checked against each other in one rolled-back run;
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
  const itemOf = itemFinder(report);
  /**
   * Keys of the products this run creates (once validate has answered, the ones
   * it didn't refuse): a dry run names them as unknown references.
   */
  let created = new Set<string>();
  const results = new Map<MigrationItem, { results: string[]; partial: boolean }>();
  const refuse = (item: MigrationItem, error: MigrationError) => {
    item.status = "failed";
    item.error = error;
  };
  const record = (
    item: MigrationItem,
    answer: { id?: unknown; result: string },
    warnings: { code: string; path?: string | null; key?: string | null }[],
    partial: boolean,
  ) => {
    const { result } = answer;
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

  const products = plan.requests.filter(
    (
      r,
    ): r is Extract<
      MigrationRequest,
      { type: "adopt_product" | "update_product" | "upsert_product" }
    > => r.type === "adopt_product" || r.type === "update_product" || r.type === "upsert_product",
  );
  for (let start = 0; start < products.length; start += VALIDATE_BATCH_SIZE) {
    const chunk = products.slice(start, start + VALIDATE_BATCH_SIZE);
    const batch = chunk.map(validateItem);
    let answers: CatalogValidationItemResponseDto[];
    try {
      answers = (await client.catalog.validate({ items: batch.map((b) => b.item) })).items;
    } catch (error) {
      if (!(error instanceof errors.CatalogValidationResponseDto)) throw error;
      answers = error.items;
    }
    if (answers.length !== chunk.length)
      throw new Error(
        `POST /v1/catalog/validate answered ${answers.length} items for the ${chunk.length} it was sent; nothing was written.`,
      );
    answers.forEach((answer, index) => {
      const request = chunk[index];
      const item = itemOf(request);
      if (!answer.valid) {
        refuse(item, errorOf(answer.error, answer.status, item.key, "validation_failed"));
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
        { id: answer.response?.id, result: String(writeResult.result) },
        Array.isArray(writeResult.warnings) ? writeResult.warnings : [],
        batch[index].partial,
      );
    });
  }

  created = new Set(
    report.items
      .filter((i) => i.kind === "product" && i.action === "create" && i.status !== "failed")
      .map((i) => i.key),
  );

  // A refused product's uploads would attach to nothing, so they are not sent.
  for (const request of products) {
    const item = itemOf(request);
    if (item.status !== "failed") continue;
    const body =
      request.type === "upsert_product"
        ? request.request.createProductRequestEntity
        : request.request.updateProductRequestEntity;
    for (const entry of body.features ?? []) {
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
        // Keys of products this run creates; the API takes 100, enough for a preview.
        body.appliesToProductExternalIds = keys
          .filter((k) => !storedIds.has(k))
          .slice(0, VALIDATE_BATCH_SIZE);
        if (!body.appliesToProductExternalIds.length) delete body.appliesToProductExternalIds;
      }
    }
    try {
      const answer = await sendDryRun(client, request);
      record(
        item,
        { id: answer.id, result: answer.writeResult.result },
        answer.writeResult.warnings,
        false,
      );
    } catch (error) {
      if (error instanceof DryRunIgnoredError) throw error;
      refuse(item, migrationError(error, secrets, item.key));
    }
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
  const uploaded = new Map<string, string>();
  const failedKeys = new Set<string>(refused.map((i) => i.key));
  // Products that exist in Creem with their key after the run: stored ones, and
  // those written now. A refused update leaves the stored product as it is, so
  // it stays in its group and discounts; a refused adoption leaves it without
  // the key, so it isn't the migrated product.
  const productIds = new Map(
    report.items
      .filter(
        (i) =>
          i.kind === "product" &&
          i.creem_id &&
          (i.action === "unchanged" || i.action === "update") &&
          !(i.status === "failed" && i.adopted_from),
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
  const pause = async () => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
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
        case "upsert_product": {
          if (!resolveFiles(request.request.createProductRequestEntity, item)) continue;
          break;
        }
        case "adopt_product":
        case "update_product": {
          if (!resolveFiles(request.request.updateProductRequestEntity, item)) continue;
          break;
        }
        case "upsert_product_group": {
          const body = request.request.createProductGroupRequestEntity;
          // A member by id is the merchant's own, kept as it is.
          const kept = (body.products ?? []).filter(
            (p) => !("externalId" in p) || productIds.has(p.externalId),
          );
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
          if (missing.length) {
            item.warnings.push({
              code: "product_not_written",
              message: `Left out of the group because they were not written: ${missing.join(", ")}. Re-run to add them.`,
            });
            body.products = kept;
          }
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
          if (Object.keys(body).length === 1) continue;
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
          if (!Object.keys(body).length) continue;
          break;
        }
      }
      // The exact request runs as a dry run first; a refusal fails the item unwritten.
      await sendDryRun(client, request);
      const answer = await send(client, request, false);
      written.add(item);
      switch (request.type) {
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
      if (error instanceof DryRunIgnoredError) {
        // What was written before it stays reported; the rest stays pending.
        item.status = "failed";
        item.error = {
          code: "dry_run_ignored",
          message: error.message,
          status: null,
          hint: "Check the Creem environment and API version, then re-run: written items are found by their key.",
        };
        for (const done of report.items) if (written.has(done)) done.status = "done";
        report.summary = summarize(report.items);
        error.report = report;
        throw error;
      }
      fail(item, migrationError(error, secrets, item.key));
      // Without its key, an adopted product isn't the migrated one in a discount or group.
      if (request.type === "adopt_product") productIds.delete(request.key);
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
  for (const item of report.items) if (item.status === "pending") item.status = "done";
  report.summary = summarize(report.items);
  return report;
}
