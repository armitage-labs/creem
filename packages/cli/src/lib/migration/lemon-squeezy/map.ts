import type {
  CreateFileUploadRequestEntity,
  DiscountEntity,
  FeatureEntity,
  LicenseKeyFeatureEntity,
  ProductEntity,
  ProductGroupEntity,
} from "creem/models/components";
import type {
  CreateDiscountRequest,
  CreateProductRequest,
  UpdateDiscountRequest,
  UpdateProductRequest,
} from "creem/models/operations";
import type { CreemCatalog } from "../catalog";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
  newItem,
  summarize,
  type AdoptionProposal,
  type MigrationIssue,
  type MigrationItem,
  type MigrationReport,
} from "../report";
import type {
  LemonSqueezyObjects,
  LSDiscount,
  LSFile,
  LSPrice,
  LSProduct,
  LSVariant,
} from "./source";

type CreateProductBody = CreateProductRequest["createProductRequestEntity"];
type UpdateProductBody = UpdateProductRequest["updateProductRequestEntity"];
type CreateDiscountBody = CreateDiscountRequest["createDiscountRequestEntity"];
type UpdateDiscountBody = UpdateDiscountRequest["updateDiscountRequestEntity"];
type UpdateFeature = NonNullable<UpdateProductBody["features"]>[number];
type CreateFeature = NonNullable<CreateProductBody["features"]>[number];

/**
 * One write of a migration, typed from the generated SDK. The writer sends
 * them in order. A file feature that waits for an upload in the same run
 * names its file `upload:<file key>`; the writer swaps in the uploaded id.
 */
export type MigrationRequest =
  | { type: "adopt_product"; key: string; request: UpdateProductRequest }
  | { type: "adopt_discount"; key: string; request: UpdateDiscountRequest }
  | {
      type: "upload_file";
      key: string;
      lsFileId: string;
      request: CreateFileUploadRequestEntity;
    }
  | { type: "create_product"; key: string; request: CreateProductRequest }
  | { type: "update_product"; key: string; request: UpdateProductRequest }
  | { type: "create_discount"; key: string; request: CreateDiscountRequest }
  | { type: "update_discount"; key: string; request: UpdateDiscountRequest };

export interface MigrationPlan {
  requests: MigrationRequest[];
  report: MigrationReport;
}

export interface FromLemonSqueezyOptions {
  /** Expired discounts are skipped relative to this time. */
  now: Date;
  /** Decisions on adoption proposals, by proposal id. Undecided proposals skip their item. */
  adoption?: { accepted?: string[]; declined?: string[] };
}

export const UPLOAD_PREFIX = "upload:";
export const LICENSE_KEY_FEATURE_KEY = "ls_license_key";
const PWYW_METADATA_KEY = "ls_pwyw_suggested_price";
const OWNED_METADATA = /^ls_(file_\d+_sha256|pwyw_suggested_price)$/;

export const variantKey = (id: string) => `ls_variant_${id}`;
export const productKey = (id: string) => `ls_product_${id}`;
export const discountKey = (id: string) => `ls_discount_${id}`;
export const fileKey = (id: string) => `ls_file_${id}`;
const fileShaKey = (id: string) => `ls_file_${id}_sha256`;

const issue = (code: string, message: string): MigrationIssue => ({ code, message });

const NOT_MIGRATED = [
  issue("out_of_scope", "Customers are not migrated: the migrator reads no customers."),
  issue("out_of_scope", "Subscriptions are not migrated; move subscribers as the guide describes."),
  issue("out_of_scope", "Orders are not migrated; export them from Lemon Squeezy."),
  issue("out_of_scope", "License keys already issued in Lemon Squeezy are not migrated."),
];

/** Converts LS's HTML descriptions to plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
}

type Preset =
  | "every-day"
  | "every-month"
  | "every-three-months"
  | "every-six-months"
  | "every-year";
type Interval = "day" | "week" | "month" | "year";
const CUSTOM_MAX: Record<Interval, number> = { day: 365, week: 52, month: 24, year: 3 };

function billing(
  unit: string | null | undefined,
  count: number | null | undefined,
):
  | { billingPeriod: Preset }
  | { billingPeriod: "custom"; recurringInterval: Interval; recurringIntervalCount: number }
  | { skip: MigrationIssue } {
  const n = count ?? 1;
  const presets: Record<string, Preset> = {
    "day:1": "every-day",
    "month:1": "every-month",
    "month:3": "every-three-months",
    "month:6": "every-six-months",
    "year:1": "every-year",
  };
  if (!unit)
    return {
      skip: issue("billing_interval_unsupported", "The subscription has no billing interval."),
    };
  const preset = presets[`${unit}:${n}`];
  if (preset) return { billingPeriod: preset };
  if (unit in CUSTOM_MAX && Number.isInteger(n) && n >= 1 && n <= CUSTOM_MAX[unit as Interval])
    return {
      billingPeriod: "custom",
      recurringInterval: unit as Interval,
      recurringIntervalCount: n,
    };
  return {
    skip: issue(
      "billing_interval_unsupported",
      `Billing every ${n} ${unit}(s) is outside what Creem supports (day 1–365, week 1–52, month 1–24, year 1–3).`,
    ),
  };
}

function trialDays(
  unit: string | null | undefined,
  count: number | null | undefined,
  warnings: MigrationIssue[],
): number | undefined {
  if (!unit || !count) return undefined;
  if (unit === "day") return count;
  if (unit === "week") return count * 7;
  const days = unit === "month" ? count * 30 : unit === "year" ? count * 365 : undefined;
  if (days === undefined) return undefined;
  warnings.push(
    issue(
      "trial_not_in_days",
      `The ${count}-${unit} trial becomes ${days} days: Creem trials are counted in days.`,
    ),
  );
  return days;
}

const TAX: Record<string, "saas" | "digital-goods-service" | "ebooks"> = {
  saas: "saas",
  eservice: "digital-goods-service",
  ebook: "ebooks",
};

interface FileSpec {
  file: LSFile;
  key: string;
  sha256: string;
  size: number;
  contentType: string;
}

interface ProductSpec {
  key: string;
  variant: LSVariant;
  product: LSProduct;
  recurring: boolean;
  create: CreateProductBody;
  licenseKey?: LicenseKeyFeatureEntity;
  files: FileSpec[];
  ownedMetadata: Record<string, string | number>;
  item: MigrationItem;
}

function licenseKeyFeature(variant: LSVariant): LicenseKeyFeatureEntity | undefined {
  const a = variant.attributes;
  if (!a.has_license_keys) return undefined;
  const units: Record<string, "day" | "month" | "year"> = {
    days: "day",
    months: "month",
    years: "year",
  };
  const unit = units[a.license_length_unit ?? ""];
  return {
    activationLimit: a.is_license_limit_unlimited ? null : (a.license_activation_limit ?? null),
    expiry:
      a.is_license_length_unlimited || !unit || !a.license_length_value
        ? null
        : { interval: unit, intervalCount: a.license_length_value },
  };
}

function sortVariants(a: LSVariant, b: LSVariant): number {
  return a.attributes.sort - b.attributes.sort || Number(a.id) - Number(b.id);
}

/** The variant's current price model, or one built from its deprecated price fields. */
function priceOf(variant: LSVariant, prices: Map<string, LSPrice>): LSPrice["attributes"] {
  const rel = variant.relationships?.["price-model"]?.data;
  const id = rel && !Array.isArray(rel) ? rel.id : undefined;
  const price = id ? prices.get(id) : undefined;
  if (price) return price.attributes;
  const a = variant.attributes;
  return {
    variant_id: Number(variant.id),
    category: a.pay_what_you_want ? "pwyw" : a.is_subscription ? "subscription" : "one_time",
    scheme: "standard",
    usage_aggregation: null,
    unit_price: a.pay_what_you_want ? (a.min_price ?? 0) : a.price,
    unit_price_decimal: null,
    setup_fee_enabled: null,
    setup_fee: null,
    renewal_interval_unit: a.is_subscription ? (a.interval ?? null) : null,
    renewal_interval_quantity: a.is_subscription ? (a.interval_count ?? null) : null,
    trial_interval_unit: a.is_subscription && a.has_free_trial ? (a.trial_interval ?? null) : null,
    trial_interval_quantity:
      a.is_subscription && a.has_free_trial ? (a.trial_interval_count ?? null) : null,
    min_price: a.pay_what_you_want ? (a.min_price ?? null) : null,
    suggested_price: a.pay_what_you_want ? (a.suggested_price ?? null) : null,
    tax_code: null,
  };
}

/** Maps one variant to its Creem product body, or the reason it is skipped. */
function mapVariant(
  variant: LSVariant,
  price: LSPrice["attributes"],
  currency: "USD" | "EUR",
  warnings: MigrationIssue[],
):
  | { body: Omit<CreateProductBody, "name" | "description" | "externalId"> }
  | { skip: MigrationIssue } {
  const a = variant.attributes;
  const recurring = price.category === "subscription" || a.is_subscription;
  if (price.usage_aggregation)
    return {
      skip: issue(
        "usage_price_without_base_price",
        "Usage-based (metered) prices are not migrated: Creem has no base price to attach the usage to.",
      ),
    };
  if (price.scheme !== "standard")
    return {
      skip: issue(
        "tiered_price_unsupported",
        `The "${price.scheme}" pricing scheme is not migrated; set the price up in Creem.`,
      ),
    };
  const pwyw = price.category === "pwyw" || a.pay_what_you_want;
  let amount = pwyw ? (price.min_price ?? price.unit_price ?? 0) : (price.unit_price ?? 0);
  if (price.category === "lead_magnet") amount = 0;
  const body: Omit<CreateProductBody, "name" | "description" | "externalId"> = {
    price: amount,
    currency,
    billingType: recurring ? "recurring" : "onetime",
  };
  if (recurring) {
    if (amount === 0)
      return {
        skip: issue("free_recurring_unsupported", "Creem refuses a recurring product at price 0."),
      };
    const period = billing(price.renewal_interval_unit, price.renewal_interval_quantity);
    if ("skip" in period) return period;
    Object.assign(body, period);
    if (pwyw)
      warnings.push(
        issue(
          "pwyw_recurring_unsupported",
          `Pay what you want is one-time only in Creem; the subscription gets its minimum price, ${amount} cents, as a fixed price.`,
        ),
      );
    const days = trialDays(price.trial_interval_unit, price.trial_interval_quantity, warnings);
    if (days) body.trialPeriodDays = days;
    if (price.setup_fee_enabled && price.setup_fee)
      warnings.push(
        issue("setup_fee_unsupported", "The setup fee is not migrated: Creem has no setup fees."),
      );
  } else if (pwyw) {
    body.payWhatYouWant = true;
    const suggested = price.suggested_price ?? 0;
    if (suggested >= 100 && suggested >= amount) body.suggestedPrice = suggested;
  }
  if (amount !== 0 && amount < 100)
    return {
      skip: issue(
        "price_below_minimum",
        `Creem prices are 0 or at least 100 (one whole unit); this one is ${amount}.`,
      ),
    };
  const tax = TAX[price.tax_code ?? "saas"] ?? "saas";
  if (tax === "ebooks" && recurring) {
    body.taxCategory = "digital-goods-service";
    warnings.push(
      issue(
        "tax_category_changed",
        "Creem's ebooks tax category is one-time only; the subscription gets digital-goods-service.",
      ),
    );
  } else body.taxCategory = tax;
  return { body };
}

function ownedMetadata(metadata: Record<string, unknown> | null | undefined) {
  const owned: Record<string, unknown> = {};
  const other: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata ?? {}))
    (OWNED_METADATA.test(key) ? owned : other)[key] = value;
  return { owned, other };
}

function sameRecord(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

function sameLicense(
  a: LicenseKeyFeatureEntity | undefined,
  b: LicenseKeyFeatureEntity | undefined,
) {
  return (
    (a?.activationLimit ?? null) === (b?.activationLimit ?? null) &&
    (a?.expiry?.interval ?? null) === (b?.expiry?.interval ?? null) &&
    (a?.expiry?.intervalCount ?? null) === (b?.expiry?.intervalCount ?? null)
  );
}

/** A stored feature sent back unchanged, so a per-type replace keeps it. */
function keepFeature(feature: FeatureEntity): UpdateFeature | undefined {
  if (feature.type === "file" && feature.file)
    return {
      id: feature.id,
      type: "file",
      description: feature.description,
      file: { files: feature.file.files.map((f) => ({ id: f.id })) },
    };
  if (feature.type === "licenseKey" && feature.licenseKey)
    return {
      id: feature.id,
      type: "licenseKey",
      description: feature.description,
      licenseKey: feature.licenseKey,
    };
  return undefined;
}

function fileFeature(spec: FileSpec, fileId: string, id?: string): CreateFeature & UpdateFeature {
  return {
    ...(id ? { id } : {}),
    type: "file",
    externalId: spec.key,
    description: spec.file.attributes.name,
    file: { files: [{ id: fileId }] },
  };
}

function licenseFeature(
  license: LicenseKeyFeatureEntity,
  id?: string,
): CreateFeature & UpdateFeature {
  return {
    ...(id ? { id } : {}),
    type: "licenseKey",
    externalId: LICENSE_KEY_FEATURE_KEY,
    description: "License key",
    licenseKey: license,
  };
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Maps a Lemon Squeezy catalog onto a Creem store: the requests that make the
 * store match it, and the report of every item. Pure: it reads nothing and
 * writes nothing.
 */
export function fromLemonSqueezy(
  objects: LemonSqueezyObjects,
  creemCatalog: CreemCatalog,
  options: FromLemonSqueezyOptions,
): MigrationPlan {
  const currency = objects.store.attributes.currency.toUpperCase();
  if (currency !== "USD" && currency !== "EUR")
    throw new Error(`Lemon Squeezy store currency ${currency} is not USD or EUR`);
  const accepted = new Set(options.adoption?.accepted ?? []);
  const declined = new Set(options.adoption?.declined ?? []);
  const prices = new Map(objects.prices.map((p) => [p.id, p]));
  const productsByKey = new Map<string, ProductEntity>();
  for (const product of creemCatalog.products)
    if (product.externalId) productsByKey.set(product.externalId, product);
  const discountsByKey = new Map<string, DiscountEntity>();
  for (const discount of creemCatalog.discounts)
    if (discount.externalId) discountsByKey.set(discount.externalId, discount);
  const groupsByKey = new Map<string, ProductGroupEntity>();
  for (const group of creemCatalog.productGroups)
    if (group.externalId) groupsByKey.set(group.externalId, group);
  const proposed = new Set<string>();
  const proposals: AdoptionProposal[] = [];

  const adoptRequests: MigrationRequest[] = [];
  const uploadRequests: MigrationRequest[] = [];
  const productRequests: MigrationRequest[] = [];
  const discountRequests: MigrationRequest[] = [];
  const productItems: MigrationItem[] = [];
  const groupItems: MigrationItem[] = [];
  const fileItems: MigrationItem[] = [];
  const discountItems: MigrationItem[] = [];

  /** Finds the Creem object a key matches, or proposes one without a key. */
  function match<T extends { id: string; externalId: string | null }>(
    kind: "product" | "discount",
    key: string,
    byKey: Map<string, T>,
    candidates: T[],
    describe: (candidate: T) => string,
    item: MigrationItem,
  ): { existing?: T; pending?: boolean } {
    const existing = byKey.get(key);
    if (existing) return { existing };
    const unclaimed = candidates.filter((c) => !c.externalId && !proposed.has(c.id));
    if (unclaimed.length !== 1) {
      if (unclaimed.length > 1)
        item.warnings.push(
          issue(
            "adoption_ambiguous",
            `${unclaimed.length} Creem ${kind}s without a key look like this one; none is adopted.`,
          ),
        );
      return {};
    }
    const candidate = unclaimed[0];
    proposed.add(candidate.id);
    const id = `adopt:${key}`;
    const decision = accepted.has(id) ? "accepted" : declined.has(id) ? "declined" : "pending";
    proposals.push({
      id,
      kind,
      key,
      creem_id: candidate.id,
      creem_name: (candidate as { name?: string }).name ?? "",
      match: describe(candidate),
      decision,
    });
    if (decision === "declined") return {};
    if (decision === "pending") return { pending: true, existing: candidate };
    item.adopted_from = candidate.id;
    item.changes.push("external_id");
    return { existing: candidate };
  }

  // ---- products
  const productsInOrder = objects.products;
  const variantsByProduct = new Map<string, LSVariant[]>();
  for (const variant of objects.variants) {
    const id = String(variant.attributes.product_id);
    variantsByProduct.set(id, [...(variantsByProduct.get(id) ?? []), variant]);
  }
  const specs: ProductSpec[] = [];
  const filesByVariant = new Map<string, LSFile[]>();
  for (const file of objects.files) {
    const id = String(file.attributes.variant_id);
    filesByVariant.set(id, [...(filesByVariant.get(id) ?? []), file]);
  }

  for (const product of productsInOrder) {
    const variants = (variantsByProduct.get(product.id) ?? []).sort(sortVariants);
    const hasVisible = variants.some((v) => v.attributes.status !== "pending");
    const mapped: {
      variant: LSVariant;
      item: MigrationItem;
      body?: ReturnType<typeof mapVariant>;
    }[] = [];
    for (const variant of variants) {
      const key = variantKey(variant.id);
      const item = newItem({
        kind: "product",
        key,
        name: product.attributes.name,
        source: { type: "variant", id: variant.id, product_id: product.id },
        action: "skip",
      });
      if (variant.attributes.status === "pending" && hasVisible) {
        item.reason = issue(
          "ls_default_variant",
          "The hidden default variant of a product with other variants is not sold on its own.",
        );
        mapped.push({ variant, item });
        continue;
      }
      const body = mapVariant(variant, priceOf(variant, prices), currency, item.warnings);
      if ("skip" in body) item.reason = body.skip;
      mapped.push({ variant, item, body });
    }
    const migrated = mapped.filter((m) => m.body && !("skip" in m.body));
    for (const { variant, item, body } of mapped) {
      if (!body || "skip" in body) {
        item.name =
          variants.length > 1
            ? `${product.attributes.name} - ${variant.attributes.name}`
            : product.attributes.name;
        productItems.push(item);
        // Files of a skipped variant are reported with it.
        for (const file of filesByVariant.get(variant.id) ?? [])
          fileItems.push(
            newItem({
              kind: "file",
              key: fileKey(file.id),
              name: file.attributes.name,
              source: { type: "file", id: file.id, product_id: product.id },
              action: "skip",
              reason: issue("variant_not_migrated", `Its variant ${variant.id} is not migrated.`),
            }),
          );
        continue;
      }
      const name =
        migrated.length > 1
          ? `${product.attributes.name} - ${variant.attributes.name}`
          : product.attributes.name;
      item.name = name;
      const description =
        htmlToText(product.attributes.description) ||
        htmlToText(variant.attributes.description) ||
        name;
      if (product.attributes.large_thumb_url || product.attributes.thumb_url)
        item.warnings.push(
          issue("image_not_migrated", "The product image is not migrated; add it in Creem."),
        );
      const key = variantKey(variant.id);
      const create: CreateProductBody = { name, description, ...body.body, externalId: key };
      const ownedMeta: Record<string, string | number> = {};
      if (create.payWhatYouWant) ownedMeta[PWYW_METADATA_KEY] = create.suggestedPrice ?? 0;
      const files: FileSpec[] = [];
      for (const file of filesByVariant.get(variant.id) ?? []) {
        const fileItem = newItem({
          kind: "file",
          key: fileKey(file.id),
          name: file.attributes.name,
          source: { type: "file", id: file.id, product_id: product.id },
          action: "skip",
        });
        fileItems.push(fileItem);
        const digest = objects.fileDigests[file.id];
        if (file.attributes.status !== "published") {
          fileItem.reason = issue("file_not_published", "Draft files are not delivered to buyers.");
          continue;
        }
        if (!digest) {
          fileItem.reason = issue("file_not_downloaded", "The file could not be downloaded.");
          continue;
        }
        files.push({
          file,
          key: fileKey(file.id),
          sha256: digest.sha256,
          size: digest.size,
          contentType: digest.contentType,
        });
        ownedMeta[fileShaKey(file.id)] = digest.sha256;
      }
      specs.push({
        key,
        variant,
        product,
        recurring: create.billingType === "recurring",
        create,
        licenseKey: licenseKeyFeature(variant),
        files,
        ownedMetadata: ownedMeta,
        item,
      });
      productItems.push(item);
    }
  }

  for (const spec of specs) {
    const { item, create } = spec;
    const found = match(
      "product",
      spec.key,
      productsByKey,
      creemCatalog.products.filter(
        (p) =>
          p.status !== "archived" &&
          p.name === create.name &&
          p.currency.toUpperCase() === create.currency &&
          p.billingType === create.billingType,
      ),
      (p) => `same name, currency and billing type as ${p.id}`,
      item,
    );
    if (found.pending) {
      item.action = "skip";
      item.creem_id = found.existing!.id;
      item.reason = issue(
        "adoption_unconfirmed",
        `Creem product ${found.existing!.id} has no key and looks like this variant. Confirm adopting it (interactively or with --adopt); declining creates a new product.`,
      );
      continue;
    }
    const existing = found.existing;
    const fileIds = new Map<string, string>();
    const fileFeatures = new Map<string, FeatureEntity>();
    for (const feature of existing?.features ?? [])
      if (feature.type === "file" && feature.externalId)
        fileFeatures.set(feature.externalId, feature);
    const { owned: storedOwned, other: otherMeta } = ownedMetadata(existing?.metadata);
    for (const f of spec.files) {
      const stored = fileFeatures.get(f.key);
      const storedId = stored?.file?.files.length === 1 ? stored.file.files[0].id : undefined;
      const fileItem = fileItems.find((i) => i.key === f.key)!;
      if (storedId && storedOwned[fileShaKey(f.file.id)] === f.sha256) {
        fileIds.set(f.key, storedId);
        fileItem.action = "unchanged";
        fileItem.creem_id = storedId;
        continue;
      }
      fileItem.action = storedId ? "update" : "create";
      fileItem.status = "pending";
      if (storedId) fileItem.changes.push("sha256");
      uploadRequests.push({
        type: "upload_file",
        key: f.key,
        lsFileId: f.file.id,
        request: {
          purpose: "product_file",
          filename: f.file.attributes.name,
          contentType: f.contentType,
          size: f.size,
          sha256: f.sha256,
        },
      });
      fileIds.set(f.key, `${UPLOAD_PREFIX}${f.key}`);
    }

    if (!existing) {
      const body: CreateProductBody = { ...create };
      const features: CreateFeature[] = [];
      if (spec.licenseKey) features.push(licenseFeature(spec.licenseKey));
      for (const f of spec.files) features.push(fileFeature(f, fileIds.get(f.key)!));
      if (features.length) body.features = features;
      if (Object.keys(spec.ownedMetadata).length) body.metadata = { ...spec.ownedMetadata };
      item.action = "create";
      item.status = "pending";
      productRequests.push({
        type: "create_product",
        key: spec.key,
        request: { createProductRequestEntity: body },
      });
      continue;
    }

    // ---- compare with the stored product
    item.creem_id = existing.id;
    if (item.adopted_from)
      adoptRequests.push({
        type: "adopt_product",
        key: spec.key,
        request: { id: existing.id, updateProductRequestEntity: { externalId: spec.key } },
      });
    const update: UpdateProductBody = {};
    const changes: string[] = [];
    const set = <K extends keyof UpdateProductBody>(
      field: K,
      value: UpdateProductBody[K],
      label: string,
    ) => {
      update[field] = value;
      if (!changes.includes(label)) changes.push(label);
    };
    if (existing.name !== create.name) set("name", create.name, "name");
    if (existing.description !== create.description)
      set("description", create.description, "description");
    if (existing.price !== create.price) set("price", create.price, "price");
    if (existing.currency.toUpperCase() !== create.currency)
      set("currency", create.currency, "currency");
    if (existing.billingType !== create.billingType)
      set("billingType", create.billingType, "billing_type");
    if (create.billingType === "recurring") {
      const samePeriod =
        existing.billingPeriod === create.billingPeriod &&
        (create.billingPeriod !== "custom" ||
          (existing.recurringInterval === create.recurringInterval &&
            existing.recurringIntervalCount === create.recurringIntervalCount));
      if (!samePeriod) {
        set("billingPeriod", create.billingPeriod, "billing_period");
        if (create.billingPeriod === "custom") {
          update.recurringInterval = create.recurringInterval;
          update.recurringIntervalCount = create.recurringIntervalCount;
        }
      }
    }
    if ((existing.trialPeriodDays ?? null) !== (create.trialPeriodDays ?? null))
      set("trialPeriodDays", create.trialPeriodDays ?? null, "trial_period_days");
    if (existing.taxCategory !== create.taxCategory)
      item.warnings.push(
        issue(
          "tax_category_not_updatable",
          `The tax category is ${existing.taxCategory} in Creem and ${create.taxCategory} from Lemon Squeezy; the API cannot change it, so change it in the dashboard.`,
        ),
      );
    if (existing.status === "archived")
      item.warnings.push(
        issue("creem_product_archived", "The Creem product is archived; it stays archived."),
      );
    if (!sameRecord(storedOwned, spec.ownedMetadata)) {
      set("metadata", { ...otherMeta, ...spec.ownedMetadata }, "metadata");
      if (
        (storedOwned[PWYW_METADATA_KEY] ?? null) !== (spec.ownedMetadata[PWYW_METADATA_KEY] ?? null)
      ) {
        update.payWhatYouWant = Boolean(create.payWhatYouWant);
        if (create.suggestedPrice !== undefined) update.suggestedPrice = create.suggestedPrice;
        changes.push("pay_what_you_want");
      }
    }

    // Features: a PATCH replaces the features of each type it names, so every
    // other stored feature of that type is sent back unchanged.
    const features: UpdateFeature[] = [];
    const stored = existing.features ?? [];
    const storedLicense = stored.find(
      (f) => f.type === "licenseKey" && f.externalId === LICENSE_KEY_FEATURE_KEY,
    );
    if (spec.licenseKey && !sameLicense(storedLicense?.licenseKey, spec.licenseKey)) {
      features.push(licenseFeature(spec.licenseKey, storedLicense?.id));
      for (const f of stored)
        if (f.type === "licenseKey" && f !== storedLicense) features.push(keepFeature(f)!);
      changes.push("features.license_key");
    } else if (!spec.licenseKey && storedLicense)
      item.warnings.push(
        issue(
          "stale_feature_kept",
          "The variant no longer has license keys; the Creem license-key feature is kept. Remove it in Creem if you want to.",
        ),
      );
    const wantedFiles = new Set(spec.files.map((f) => f.key));
    const fileChanged = spec.files.some((f) => {
      const storedFeature = fileFeatures.get(f.key);
      return (
        !storedFeature ||
        storedFeature.description !== f.file.attributes.name ||
        fileIds.get(f.key) !== storedFeature.file?.files[0]?.id ||
        storedFeature.file?.files.length !== 1
      );
    });
    if (fileChanged) {
      for (const f of spec.files)
        features.push(fileFeature(f, fileIds.get(f.key)!, fileFeatures.get(f.key)?.id));
      for (const f of stored)
        if (f.type === "file" && !(f.externalId && wantedFiles.has(f.externalId)))
          features.push(keepFeature(f)!);
      changes.push("features.file");
    }
    for (const [key] of fileFeatures)
      if (/^ls_file_\d+$/.test(key) && !wantedFiles.has(key))
        item.warnings.push(
          issue(
            "stale_feature_kept",
            `File feature ${key} is no longer in Lemon Squeezy; it is kept, so past buyers keep their download.`,
          ),
        );
    if (features.length) update.features = features;
    if (changes.length) {
      item.changes.push(...changes);
      item.action = "update";
      item.status = "pending";
      productRequests.push({
        type: "update_product",
        key: spec.key,
        request: { id: existing.id, updateProductRequestEntity: update },
      });
    } else if (item.adopted_from) {
      item.action = "update";
      item.status = "pending";
    } else item.action = "unchanged";
  }

  // ---- product groups: two or more migrated recurring variants of one LS product
  const plannedKeys = new Set(productItems.filter((i) => i.action !== "skip").map((i) => i.key));
  for (const product of productsInOrder) {
    const memberSpecs = specs.filter(
      (s) => s.product === product && s.recurring && plannedKeys.has(s.key),
    );
    const members = memberSpecs.map((s) => s.key);
    const memberNames = memberSpecs.map((s) => `"${s.create.name}"`).join(", ");
    if (members.length < 2) continue;
    const key = productKey(product.id);
    const item = newItem({
      kind: "product_group",
      key,
      name: product.attributes.name,
      source: { type: "product", id: product.id },
      action: "skip",
      members,
    });
    const existing = groupsByKey.get(key);
    if (existing) {
      item.creem_id = existing.id;
      const stored = existing.products.map((p) => p.externalId);
      if (stored.length === members.length && stored.every((k, i) => k === members[i]))
        item.action = "unchanged";
      else
        item.reason = issue(
          "product_group_write_unavailable",
          `The public API cannot update product groups yet; set its products to ${memberNames} in the dashboard.`,
        );
    } else
      item.reason = issue(
        "product_group_write_unavailable",
        `The public API cannot create product groups yet; create "${product.attributes.name}" with ${memberNames} in the dashboard.`,
      );
    groupItems.push(item);
  }

  // ---- discounts
  const migratedKeys = productItems
    .filter((i) => i.action === "create" || i.action === "update" || i.action === "unchanged")
    .map((i) => i.key);
  const keyOfProductId = new Map(
    creemCatalog.products.filter((p) => p.externalId).map((p) => [p.id, p.externalId as string]),
  );
  for (const discount of objects.discounts) {
    const item = newItem({
      kind: "discount",
      key: discountKey(discount.id),
      name: discount.attributes.code,
      source: { type: "discount", id: discount.id },
      action: "skip",
    });
    discountItems.push(item);
    const planned = planDiscount(discount, currency, options.now, migratedKeys, item);
    if (!planned) continue;
    const found = match(
      "discount",
      item.key,
      discountsByKey,
      creemCatalog.discounts.filter(
        (d) => d.code.toUpperCase() === discount.attributes.code.toUpperCase(),
      ),
      (d) => `same code as ${d.id}`,
      item,
    );
    if (found.pending) {
      item.creem_id = found.existing!.id;
      item.reason = issue(
        "adoption_unconfirmed",
        `Creem discount ${found.existing!.id} has the same code and no key. Confirm adopting it (interactively or with --adopt).`,
      );
      continue;
    }
    const existing = found.existing;
    if (!existing) {
      const codeTaken = creemCatalog.discounts.find(
        (d) =>
          d.code.toUpperCase() === discount.attributes.code.toUpperCase() &&
          d.externalId !== item.key,
      );
      if (codeTaken) {
        item.creem_id = codeTaken.id;
        item.reason = issue(
          "code_taken",
          `Creem discount ${codeTaken.id} already uses the code ${discount.attributes.code}.`,
        );
        continue;
      }
      item.action = "create";
      item.status = "pending";
      discountRequests.push({
        type: "create_discount",
        key: item.key,
        request: { createDiscountRequestEntity: planned },
      });
      continue;
    }
    item.creem_id = existing.id;
    if (item.adopted_from)
      adoptRequests.push({
        type: "adopt_discount",
        key: item.key,
        request: { id: existing.id, updateDiscountRequestEntity: { externalId: item.key } },
      });
    const update: UpdateDiscountBody = {};
    const changes: string[] = [];
    if (existing.code.toUpperCase() !== planned.code!.toUpperCase())
      item.warnings.push(
        issue(
          "discount_code_differs",
          `The Creem code is ${existing.code}; a code never changes, so create a new discount for ${planned.code}.`,
        ),
      );
    if (existing.name !== planned.name) {
      update.name = planned.name;
      changes.push("name");
    }
    if (existing.type !== planned.type) {
      update.type = planned.type;
      changes.push("type");
    }
    if (planned.type === "percentage" && existing.percentage !== planned.percentage) {
      update.percentage = planned.percentage;
      changes.push("percentage");
    }
    if (planned.type === "fixed") {
      if (existing.amount !== planned.amount) {
        update.amount = planned.amount;
        changes.push("amount");
      }
      if ((existing.currency ?? "").toUpperCase() !== planned.currency) {
        update.currency = planned.currency;
        changes.push("currency");
      }
    }
    if (existing.duration !== planned.duration) {
      update.duration = planned.duration;
      changes.push("duration");
    }
    if (
      planned.duration === "repeating" &&
      (existing.durationInMonths ?? null) !== (planned.durationInMonths ?? null)
    ) {
      update.durationInMonths = planned.durationInMonths;
      changes.push("duration_in_months");
    }
    if ((existing.maxRedemptions ?? null) !== (planned.maxRedemptions ?? null)) {
      update.maxRedemptions = planned.maxRedemptions ?? null;
      changes.push("max_redemptions");
    }
    if (isoDate(existing.expiryDate) !== isoDate(planned.expiryDate)) {
      update.expiryDate = planned.expiryDate ?? null;
      changes.push("expiry_date");
    }
    const storedKeys = (existing.appliesToProducts ?? []).map((id) => keyOfProductId.get(id) ?? id);
    const wanted = planned.appliesToProductExternalIds ?? [];
    if (storedKeys.length !== wanted.length || !wanted.every((k) => storedKeys.includes(k))) {
      update.appliesToProductExternalIds = wanted;
      changes.push("applies_to_products");
    }
    if (changes.length) {
      item.changes.push(...changes);
      item.action = "update";
      item.status = "pending";
      discountRequests.push({
        type: "update_discount",
        key: item.key,
        request: { id: existing.id, updateDiscountRequestEntity: update },
      });
    } else if (item.adopted_from) {
      item.action = "update";
      item.status = "pending";
    } else item.action = "unchanged";
  }

  const items = [...productItems, ...groupItems, ...fileItems, ...discountItems];
  const notMigrated = ["customers", "subscriptions", "orders", "license_keys"].map(
    (kind, index) => ({ kind, reason: NOT_MIGRATED[index] }),
  );
  if (objects.discountsExcluded)
    notMigrated.push({
      kind: "discounts",
      reason: issue("excluded", "Discounts were excluded with --exclude-discounts."),
    });
  const report: MigrationReport = {
    schema: MIGRATION_REPORT_SCHEMA,
    version: MIGRATION_REPORT_VERSION,
    source: {
      provider: "lemon_squeezy",
      store_id: objects.store.id,
      store_name: objects.store.attributes.name,
      currency,
    },
    mode: "plan",
    summary: summarize(items),
    items,
    proposals,
    not_migrated: notMigrated,
    fetch_failures: [],
  };
  return {
    requests: [...adoptRequests, ...uploadRequests, ...productRequests, ...discountRequests],
    report,
  };
}

/** The Creem discount for an LS discount, or `undefined` with the skip reason on the item. */
function planDiscount(
  discount: LSDiscount,
  currency: "USD" | "EUR",
  now: Date,
  migratedKeys: string[],
  item: MigrationItem,
): CreateDiscountBody | undefined {
  const a = discount.attributes;
  if (a.status !== "published") {
    item.reason = issue("discount_not_published", `The discount is ${a.status}, not published.`);
    return undefined;
  }
  if (a.expires_at && new Date(a.expires_at).getTime() <= now.getTime()) {
    item.reason = issue("discount_expired", `The discount expired at ${a.expires_at}.`);
    return undefined;
  }
  let applies = migratedKeys;
  if (a.is_limited_to_products) {
    const data = discount.relationships?.variants?.data;
    if (!Array.isArray(data)) {
      item.reason = issue(
        "limited_discount_variants_unknown",
        "The discount is limited to some products, and Lemon Squeezy did not say which.",
      );
      return undefined;
    }
    const limited = data.map((v) => variantKey(v.id));
    applies = limited.filter((k) => migratedKeys.includes(k));
    const missing = limited.filter((k) => !migratedKeys.includes(k));
    if (!applies.length) {
      item.reason = issue(
        "discount_variants_not_migrated",
        "None of the variants the discount is limited to is migrated.",
      );
      return undefined;
    }
    if (missing.length)
      item.warnings.push(
        issue(
          "discount_variants_partially_migrated",
          `The discount applies only to the migrated variants. Not migrated: ${missing.join(", ")}.`,
        ),
      );
  }
  if (!applies.length) {
    item.reason = issue("no_products", "No product is migrated to apply the discount to.");
    return undefined;
  }
  if (a.amount_type === "percent" && (a.amount < 1 || a.amount > 100)) {
    item.reason = issue("discount_amount_unsupported", "Creem percentages are 1 to 100.");
    return undefined;
  }
  if (a.amount_type === "fixed" && a.amount <= 1) {
    item.reason = issue("discount_amount_unsupported", "Creem fixed discounts are above 1.");
    return undefined;
  }
  if (a.starts_at && new Date(a.starts_at).getTime() > now.getTime())
    item.warnings.push(
      issue(
        "starts_at_unsupported",
        `The discount starts at ${a.starts_at} in Lemon Squeezy; Creem discounts are valid at once.`,
      ),
    );
  const body: CreateDiscountBody = {
    name: a.name,
    code: a.code,
    type: a.amount_type === "percent" ? "percentage" : "fixed",
    ...(a.amount_type === "percent" ? { percentage: a.amount } : { amount: a.amount, currency }),
    duration: a.duration,
  };
  if (a.duration === "repeating") body.durationInMonths = a.duration_in_months ?? 1;
  if (a.is_limited_redemptions && a.max_redemptions) body.maxRedemptions = a.max_redemptions;
  if (a.expires_at) body.expiryDate = new Date(a.expires_at);
  body.externalId = discountKey(discount.id);
  body.appliesToProductExternalIds = applies;
  return body;
}
