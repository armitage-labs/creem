import { createHash } from "node:crypto";
import { openAsBlob } from "node:fs";
import type { Creem } from "creem";
import { describeError } from "../errors";
import { isRecord } from "../operation";
import { UPLOAD_PREFIX, type MigrationPlan, type MigrationRequest } from "./lemon-squeezy/map";
import { summarize, type MigrationError, type MigrationItem, type MigrationReport } from "./report";

export interface ExecuteOptions {
  /** Local copies of the files to upload, by source file id. */
  files: Record<string, { path: string }>;
  /** Used for the POST of file bytes to an upload slot. */
  fetch?: typeof fetch;
  /** Pause between writes, against rate limits. */
  delayMs?: number;
  secrets?: string[];
  onProgress?: (item: MigrationItem, request: MigrationRequest) => void;
}

const HINTS: Record<string, string> = {
  discount_redeemed:
    "The discount has been redeemed, so its amount, type, currency and duration are fixed. Create a new discount code in Creem for the new terms.",
  discount_managed_by_stripe:
    "The discount has a Stripe coupon, which keeps its terms. Create a new discount code in Creem for the new terms.",
  external_id_taken: "Another Creem object already uses this key; check for a duplicate.",
  license_keys_issued: "Customers hold keys of this license-key feature; it cannot be removed.",
};

function migrationError(error: unknown, secrets: string[]): MigrationError {
  const { result } = describeError(error, secrets);
  const details = isRecord(result.error.details) ? result.error.details : {};
  const code =
    typeof details.code === "string"
      ? details.code
      : typeof details.error === "string"
        ? details.error
        : result.error.type;
  return {
    code,
    message: result.error.message,
    status: result.error.status,
    hint: HINTS[code] ?? null,
  };
}

/** A short, stable idempotency key: retries of the same create never duplicate it. */
function idempotencyKey(key: string, body: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return `creem-migrate:${key}:${digest}`;
}

/**
 * Sends a plan's requests in order and returns the report with each item's
 * outcome. A failed item never stops the run: the items that depend on it
 * (a product on its file upload, a discount on its products) fail or shrink
 * with the reason, and everything else goes on.
 */
export async function executeMigration(
  client: Creem,
  plan: MigrationPlan,
  options: ExecuteOptions,
): Promise<MigrationReport> {
  const report: MigrationReport = structuredClone(plan.report);
  report.mode = "run";
  const secrets = options.secrets ?? [];
  const send = options.fetch ?? ((...args) => fetch(...args));
  const items = new Map(report.items.map((item) => [`${item.kind}:${item.key}`, item]));
  const itemOf = (request: MigrationRequest): MigrationItem => {
    const kind =
      request.type === "upload_file"
        ? "file"
        : request.type.endsWith("discount")
          ? "discount"
          : "product";
    const item = items.get(`${kind}:${request.key}`);
    if (!item) throw new Error(`No report item for ${kind} ${request.key}`);
    return item;
  };
  const uploaded = new Map<string, string>();
  const failedKeys = new Set<string>();
  // Products that exist in Creem after the run, by key: matched ones, and those written now.
  const productIds = new Map(
    report.items
      .filter(
        (i) =>
          i.kind === "product" && i.creem_id && (i.action === "unchanged" || i.action === "update"),
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
  const pause = async () => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  };

  /**
   * Swaps `upload:<key>` file ids, in features and in metadata, for uploaded
   * ones; false if an upload failed.
   */
  const resolveFiles = (
    body: { features?: unknown[]; metadata?: Record<string, unknown> | null },
    item: MigrationItem,
  ): boolean => {
    const keys: string[] = [];
    const resolve = (value: string): string | undefined => {
      const key = value.slice(UPLOAD_PREFIX.length);
      const id = uploaded.get(key);
      if (!id) {
        fail(item, {
          code: "dependency_failed",
          message: `The upload of ${key} failed, so the product was not written.`,
          status: null,
          hint: "Re-run the migration to retry.",
        });
        return undefined;
      }
      if (!keys.includes(key)) keys.push(key);
      return id;
    };
    for (const [name, value] of Object.entries(body.metadata ?? {})) {
      if (typeof value !== "string" || !value.startsWith(UPLOAD_PREFIX)) continue;
      const id = resolve(value);
      if (!id) return false;
      body.metadata![name] = id;
    }
    for (const feature of body.features ?? []) {
      if (!isRecord(feature) || feature.type !== "file" || !isRecord(feature.file)) continue;
      const files = Array.isArray(feature.file.files) ? feature.file.files : [];
      for (const file of files) {
        if (!isRecord(file) || typeof file.id !== "string" || !file.id.startsWith(UPLOAD_PREFIX))
          continue;
        const id = resolve(file.id);
        if (!id) return false;
        file.id = id;
      }
    }
    uploadsOf.set(item.key, keys);
    return true;
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
    if (item.status === "failed") continue;
    options.onProgress?.(item, request);
    try {
      switch (request.type) {
        case "adopt_product": {
          await client.products.update(request.request);
          break;
        }
        case "adopt_discount": {
          await client.discounts.update(request.request);
          break;
        }
        case "upload_file": {
          const local = options.files[request.lsFileId];
          if (!local) throw new Error(`No local copy of file ${request.lsFileId}`);
          const slot = await client.files.createUpload(request.request);
          const form = new FormData();
          for (const [name, value] of Object.entries(slot.uploadFields)) form.append(name, value);
          const blob = await openAsBlob(local.path, { type: request.request.contentType });
          form.append("file", blob, request.request.filename);
          const response = await send(slot.uploadUrl, { method: "POST", body: form });
          if (!response.ok)
            throw Object.assign(
              new Error(`Upload to storage failed (${response.status}): ${await response.text()}`),
              { statusCode: response.status },
            );
          const file = await client.files.confirmUpload({ id: slot.id });
          uploaded.set(request.key, file.id);
          item.creem_id = file.id;
          break;
        }
        case "create_product": {
          const body = request.request.createProductRequestEntity;
          if (!resolveFiles(body, item)) continue;
          const product = await client.products.create({
            createProductRequestEntity: body,
            idempotencyKey: idempotencyKey(request.key, body),
          });
          item.creem_id = product.id;
          productIds.set(request.key, product.id);
          break;
        }
        case "update_product": {
          const body = request.request.updateProductRequestEntity;
          if (!resolveFiles(body, item)) continue;
          await client.products.update(request.request);
          break;
        }
        case "create_discount": {
          const body = request.request.createDiscountRequestEntity;
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
          const discount = await client.discounts.create({
            createDiscountRequestEntity: body,
            idempotencyKey: idempotencyKey(request.key, body),
          });
          item.creem_id = discount.id;
          break;
        }
        case "update_discount": {
          const body = request.request.updateDiscountRequestEntity;
          if (body.appliesToProductExternalIds) {
            const ids = resolveProducts(body.appliesToProductExternalIds, item);
            delete body.appliesToProductExternalIds;
            // Without one migrated product written, the stored set stays as it is.
            if (ids.length) body.appliesToProducts = [...(body.appliesToProducts ?? []), ...ids];
            else delete body.appliesToProducts;
          }
          if (!Object.keys(body).length) break;
          await client.discounts.update(request.request);
          break;
        }
      }
    } catch (error) {
      fail(item, migrationError(error, secrets));
      // Without its key, an adopted product isn't the migrated one in a discount.
      if (request.type === "adopt_product") productIds.delete(request.key);
      if (request.type === "adopt_product" || request.type === "adopt_discount")
        item.error!.message = `Adopting ${request.request.id} failed: ${item.error!.message}`;
    }
    await pause();
  }
  // The API can't look files up, so a confirmed upload whose product write
  // failed is uploaded again by the next run. The unattached copy is never
  // delivered to buyers; it is reported so the duplicate is known.
  for (const [productKey, fileKeys] of uploadsOf) {
    if (!failedKeys.has(productKey)) continue;
    for (const key of fileKeys) {
      const fileItem = items.get(`file:${key}`);
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
