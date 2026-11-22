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
  /**
   * Adoption answers that answer nothing or can't be applied (`adoption_answer_invalid`).
   * The plan must not run while there are any: the command stops with exit 2.
   */
  answerErrors: MigrationIssue[];
}

export interface FromLemonSqueezyOptions {
  /** Expired discounts are skipped relative to this time. */
  now: Date;
  /**
   * Answers to adoption proposals, by proposal id (`adopt:<key>`): the Creem id
   * of the candidate to adopt, or `new` to create a new object. A proposal
   * without an answer stays pending and skips its item. An answer may also name
   * an unkeyed object of the same kind that isn't a look-alike (a renamed
   * product). Any other answer, or one for a key the run doesn't migrate, is an
   * `answerErrors` entry.
   */
  adoption?: Record<string, string>;
}

export const UPLOAD_PREFIX = "upload:";
export const LICENSE_KEY_FEATURE_KEY = "ls_license_key";
/** The answer to an adoption proposal that creates a new object instead. */
export const ADOPT_NEW = "new";
const PWYW_METADATA_KEY = "ls_pwyw_suggested_price";
const OWNED_METADATA = /^ls_(file_\d+_(sha256|file_id)|pwyw_suggested_price)$/;
const DISCOUNT_CODE_MAX = 14;
const DISCOUNT_NAME_MAX = 40;

export const variantKey = (id: string) => `ls_variant_${id}`;
export const productKey = (id: string) => `ls_product_${id}`;
export const discountKey = (id: string) => `ls_discount_${id}`;
export const fileKey = (id: string) => `ls_file_${id}`;
const fileShaKey = (id: string) => `ls_file_${id}_sha256`;
/** The Creem file that stands for an LS file in its feature (`upload:<key>` until uploaded). */
const fileIdKey = (id: string) => `ls_file_${id}_file_id`;
/** The metadata keys the writer may resolve `upload:<key>` in; never the merchant's. */
export const FILE_ID_METADATA = /^ls_file_\d+_file_id$/;
const LS_VARIANT_KEY = /^ls_variant_\d+$/;

const issue = (code: string, message: string): MigrationIssue => ({ code, message });

const NOT_MIGRATED = [
  issue("out_of_scope", "Customers are not migrated: the migrator reads no customers."),
  issue("out_of_scope", "Subscriptions are not migrated; move subscribers as the guide describes."),
  issue("out_of_scope", "Orders are not migrated; export them from Lemon Squeezy."),
  issue("out_of_scope", "License keys already issued in Lemon Squeezy are not migrated."),
];

// Removes tags until none is left: one pass would turn "<<b>b>" into "<b>".
function stripTags(html: string): string {
  let text = html;
  for (;;) {
    const next = text.replace(/<[^<>]*>/g, "");
    if (next === text) return next.replace(/[<>]/g, "");
    text = next;
  }
}

/** Converts LS's HTML descriptions to plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return stripTags(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- "),
  )
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
  /** LS files of the variant this run doesn't write (draft, not downloaded). */
  otherFileIds: string[];
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
    // Creem refuses a pay-what-you-want minimum below 100. Free with no way to
    // pay, or a forced 1.00, would both change the merchant's terms.
    if (amount < 100)
      return {
        skip: issue(
          "pwyw_minimum_below_100",
          `Creem's pay what you want starts at a minimum of 100; this one is ${amount}. Set the product up in Creem.`,
        ),
      };
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
  // A missing feature is never the same as one, even with every setting unlimited.
  if (!a || !b) return false;
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

/** The file feature of one LS file, as planned against the stored product. */
interface FilePlan {
  spec: FileSpec;
  /** The stored feature it writes, if any (keyed, or the merchant's adopted one). */
  featureId?: string;
  description: string;
  /** The Creem file for the LS file: a stored id, or `upload:<key>`. */
  fileId: string;
  /** The merchant's other files in the feature, kept. */
  extras: { id: string }[];
  changed: boolean;
}

function fileFeature(plan: FilePlan): CreateFeature & UpdateFeature {
  return {
    ...(plan.featureId ? { id: plan.featureId } : {}),
    type: "file",
    externalId: plan.spec.key,
    description: plan.description,
    file: { files: [{ id: plan.fileId }, ...plan.extras] },
  };
}

function licenseFeature(
  license: LicenseKeyFeatureEntity,
  id?: string,
  description = "License key",
): CreateFeature & UpdateFeature {
  return {
    ...(id ? { id } : {}),
    type: "licenseKey",
    externalId: LICENSE_KEY_FEATURE_KEY,
    description,
    licenseKey: license,
  };
}

/** Names match ignoring case and spacing (ADR § 2.10 candidate rule). */
function sameName(a: string | null | undefined, b: string): boolean {
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(a ?? "") === normalize(b);
}

/** How a candidate differs from the product a variant maps to: shown, never matched on. */
function productDifferences(p: ProductEntity, create: CreateProductBody): string[] {
  const differences: string[] = [];
  const ls = (value: unknown) => ` (Lemon Squeezy: ${String(value)})`;
  if (p.name !== create.name) differences.push(`name "${p.name}"${ls(`"${create.name}"`)}`);
  if (p.price !== create.price) differences.push(`price ${p.price}${ls(create.price)}`);
  if (p.currency.toUpperCase() !== create.currency)
    differences.push(`currency ${p.currency}${ls(create.currency)}`);
  if (p.billingType !== create.billingType)
    differences.push(`billing type ${p.billingType}${ls(create.billingType)}`);
  else if (create.billingType === "recurring") {
    const period = (
      billingPeriod: string | undefined,
      interval: string | null | undefined,
      count: number | null | undefined,
    ) => (billingPeriod === "custom" ? `custom every ${count ?? 1} ${interval}(s)` : billingPeriod);
    const stored = period(p.billingPeriod, p.recurringInterval, p.recurringIntervalCount);
    const wanted = period(
      create.billingPeriod,
      create.recurringInterval,
      create.recurringIntervalCount,
    );
    if (stored !== wanted) differences.push(`billing period ${stored}${ls(wanted)}`);
  }
  if (p.status === "archived") differences.push("archived");
  return differences;
}

/** Candidates in order: same billing type, then active before archived, then closest price. */
function rankProducts(create: CreateProductBody) {
  return (a: ProductEntity, b: ProductEntity) =>
    Number(a.billingType !== create.billingType) - Number(b.billingType !== create.billingType) ||
    Number(a.status === "archived") - Number(b.status === "archived") ||
    Math.abs(a.price - create.price) - Math.abs(b.price - create.price);
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
  const decisions = options.adoption ?? {};
  /** Candidates an earlier item adopted, with the key they got. */
  const claimed = new Map<string, string>();
  /** Answers some item looked at; the others answer nothing. */
  const consulted = new Set<string>();
  const answerErrors: MigrationIssue[] = [];
  const rejectAnswer = (key: string, message: string) => {
    const error = issue(
      "adoption_answer_invalid",
      `--adopt ${key}=${decisions[`adopt:${key}`]}: ${message}`,
    );
    answerErrors.push(error);
    return error;
  };
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
  const proposals: AdoptionProposal[] = [];

  const adoptRequests: MigrationRequest[] = [];
  const uploadRequests: MigrationRequest[] = [];
  const productRequests: MigrationRequest[] = [];
  const discountRequests: MigrationRequest[] = [];
  const productItems: MigrationItem[] = [];
  const groupItems: MigrationItem[] = [];
  const fileItems: MigrationItem[] = [];
  const discountItems: MigrationItem[] = [];

  /**
   * Finds the Creem object a key matches. Without one, the look-alikes without
   * a key become one proposal (ADR § 2.6): adopted only when the answer names
   * one of them (or another unkeyed object of the kind), a new object when it
   * is `new`, and pending otherwise. An answer that can't be applied rejects
   * the item.
   */
  function match<T extends { id: string; externalId: string | null; name?: string }>(
    kind: "product" | "discount",
    key: string,
    byKey: Map<string, T>,
    all: T[],
    lookalikes: T[],
    differences: (candidate: T) => string[],
    item: MigrationItem,
  ): { existing?: T; pending?: T[]; rejected?: MigrationIssue } {
    const id = `adopt:${key}`;
    const answer = decisions[id];
    if (answer !== undefined) consulted.add(id);
    const existing = byKey.get(key);
    if (existing) {
      // The same answers re-run cleanly: the adopted or created object has the key now.
      if (answer !== undefined && answer !== ADOPT_NEW && answer !== existing.id)
        return {
          rejected: rejectAnswer(
            key,
            `Creem ${kind} ${existing.id} already has the key ${key}, so ${answer} can't get it.`,
          ),
        };
      return { existing };
    }
    const open = lookalikes.filter((c) => !c.externalId && !claimed.has(c.id));
    let chosen: T | undefined;
    if (answer !== undefined && answer !== ADOPT_NEW) {
      chosen = open.find((c) => c.id === answer);
      if (!chosen) {
        const named = all.find((c) => c.id === answer);
        const problem = !named
          ? `there is no Creem ${kind} ${answer}.`
          : named.externalId
            ? `Creem ${kind} ${answer} already has the key ${named.externalId}.`
            : claimed.has(answer)
              ? `Creem ${kind} ${answer} is already adopted as ${claimed.get(answer)}; two keys can't adopt one ${kind}.`
              : undefined;
        if (problem) return { rejected: rejectAnswer(key, problem) };
        // An unkeyed object the merchant named that isn't a look-alike (renamed).
        chosen = named;
      }
    }
    if (!open.length && !chosen) return {};
    const candidates = chosen && !open.includes(chosen) ? [chosen, ...open] : open;
    const proposal: AdoptionProposal = {
      id,
      kind,
      key,
      name: item.name,
      candidates: candidates.map((c) => ({
        creem_id: c.id,
        creem_name: c.name ?? "",
        differences: differences(c),
      })),
      decision: "pending",
      creem_id: null,
    };
    proposals.push(proposal);
    if (answer === ADOPT_NEW) {
      proposal.decision = "declined";
      return {};
    }
    if (!chosen) return { pending: open };
    claimed.set(chosen.id, key);
    proposal.decision = "accepted";
    proposal.creem_id = chosen.id;
    item.adopted_from = chosen.id;
    item.changes.push("external_id");
    return { existing: chosen };
  }

  /** The skip reason of an item whose proposal waits for an answer. */
  function unconfirmed(kind: "product" | "discount", key: string, pending: { id: string }[]) {
    const ids = pending.map((c) => c.id);
    const what =
      ids.length === 1
        ? `Creem ${kind} ${ids[0]} has no key and looks like this one.`
        : `${ids.length} Creem ${kind}s without a key look like this one (${ids.join(", ")}).`;
    return issue(
      "adoption_unconfirmed",
      `${what} Answer the proposal: adopt one (in a terminal, or with --adopt ${key}=<creem id>) or create a new ${kind} (--adopt ${key}=new).`,
    );
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
      if (variant.attributes.status === "draft") {
        item.reason = issue("variant_draft", "Draft variants are not sold in Lemon Squeezy.");
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
      const otherFileIds: string[] = [];
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
          otherFileIds.push(file.id);
          continue;
        }
        if (!digest) {
          const why = objects.fileFailures?.[file.id];
          fileItem.reason = issue(
            "file_not_downloaded",
            `The file could not be downloaded${why ? `: ${why}` : ""}. Re-run to retry it.`,
          );
          otherFileIds.push(file.id);
          continue;
        }
        files.push({
          file,
          key: fileKey(file.id),
          sha256: digest.sha256,
          size: digest.size,
          contentType: digest.contentType,
        });
      }
      specs.push({
        key,
        variant,
        product,
        recurring: create.billingType === "recurring",
        create,
        licenseKey: licenseKeyFeature(variant),
        files,
        otherFileIds,
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
      creemCatalog.products,
      creemCatalog.products.filter((p) => sameName(p.name, create.name)).sort(rankProducts(create)),
      (p) => productDifferences(p, create),
      item,
    );
    if (found.rejected) {
      item.action = "skip";
      item.reason = found.rejected;
      for (const f of spec.files)
        fileItems.find((i) => i.key === f.key)!.reason = issue(
          "adoption_answer_invalid",
          `Its product ${spec.key} has an adoption answer that can't be applied.`,
        );
      continue;
    }
    if (found.pending) {
      item.action = "skip";
      item.creem_id = found.pending.length === 1 ? found.pending[0].id : null;
      item.reason = unconfirmed("product", spec.key, found.pending);
      for (const f of spec.files) {
        const fileItem = fileItems.find((i) => i.key === f.key)!;
        fileItem.reason = issue(
          "adoption_unconfirmed",
          `Its product ${spec.key} waits for the answer to its adoption proposal.`,
        );
      }
      continue;
    }
    const existing = found.existing;
    const stored = existing?.features ?? [];
    const { owned: storedOwned, other: otherMeta } = ownedMetadata(existing?.metadata);
    const ownedMeta: Record<string, string | number> = { ...spec.ownedMetadata };
    // LS files this run doesn't write (draft, not downloaded) keep their state.
    for (const id of spec.otherFileIds)
      for (const key of [fileShaKey(id), fileIdKey(id)])
        if (typeof storedOwned[key] === "string" || typeof storedOwned[key] === "number")
          ownedMeta[key] = storedOwned[key] as string | number;

    // ---- files: each LS file is one file feature keyed `ls_file_<id>`
    const keyedFiles = new Map<string, FeatureEntity>();
    for (const feature of stored)
      if (feature.type === "file" && feature.externalId)
        keyedFiles.set(feature.externalId, feature);
    const adoptedFeatures = new Set<string>();
    const filePlans: FilePlan[] = [];
    for (const f of spec.files) {
      const fileItem = fileItems.find((i) => i.key === f.key)!;
      const lsName = f.file.attributes.name;
      let feature = keyedFiles.get(f.key);
      let adoptedFeature = false;
      if (!feature && existing) {
        // A keyless file feature of the merchant's that holds a file of this name.
        const named = stored.filter(
          (s) =>
            s.type === "file" &&
            !s.externalId &&
            !adoptedFeatures.has(s.id) &&
            s.file?.files.some((x) => x.fileName === lsName),
        );
        if (named.length > 1) {
          fileItem.reason = issue(
            "file_feature_ambiguous",
            `${named.length} file features without a key hold a file named ${lsName}; none is changed and none is added. Give the right one the key ${f.key} in Creem.`,
          );
          for (const key of [fileShaKey(f.file.id), fileIdKey(f.file.id)])
            if (storedOwned[key] !== undefined) ownedMeta[key] = storedOwned[key] as string;
          continue;
        }
        if (named.length === 1) {
          feature = named[0];
          adoptedFeature = true;
          adoptedFeatures.add(feature.id);
        }
      }
      const files = feature?.file?.files ?? [];
      // Only the file the migrator recorded stands for the LS file, and only its
      // recorded SHA-256 says its bytes. The API can't show a file's bytes, so a
      // merchant's file (even one with the same name and size) is never taken
      // as the LS file: the LS file is uploaded next to it, and it stays.
      const recordedId = storedOwned[fileIdKey(f.file.id)];
      const ours = files.find((x) => x.id === recordedId);
      const sameBytes = ours !== undefined && storedOwned[fileShaKey(f.file.id)] === f.sha256;
      const lookalikes = files.filter((x) => x !== ours && x.fileName === lsName);
      let fileId: string;
      if (ours && sameBytes) {
        fileId = ours.id;
        fileItem.action = "unchanged";
        fileItem.creem_id = ours.id;
      } else {
        fileId = `${UPLOAD_PREFIX}${f.key}`;
        fileItem.action = ours ? "update" : "create";
        fileItem.status = "pending";
        if (ours) fileItem.changes.push("sha256");
        for (const x of lookalikes)
          item.warnings.push(
            issue(
              "file_kept_unverified",
              `${x.id} (${x.fileName}) has the Lemon Squeezy file's name, but the API can't show its bytes, so the Lemon Squeezy file is uploaded next to it and it stays. Remove one in Creem if they are the same.`,
            ),
          );
        uploadRequests.push({
          type: "upload_file",
          key: f.key,
          lsFileId: f.file.id,
          request: {
            purpose: "product_file",
            filename: lsName,
            contentType: f.contentType,
            size: f.size,
            sha256: f.sha256,
          },
        });
      }
      ownedMeta[fileShaKey(f.file.id)] = f.sha256;
      ownedMeta[fileIdKey(f.file.id)] = fileId;
      // A stored feature keeps its description, so the merchant's wording stays.
      const description = feature ? feature.description : lsName;
      filePlans.push({
        spec: f,
        featureId: feature?.id,
        description,
        fileId,
        extras: files.filter((x) => x !== ours).map((x) => ({ id: x.id })),
        changed: !feature || adoptedFeature || ours?.id !== fileId,
      });
      if (adoptedFeature && feature)
        item.warnings.push(
          issue(
            "feature_adopted",
            `File feature ${feature.id} gets the key ${f.key}, and the Lemon Squeezy file is added next to its files.`,
          ),
        );
    }

    if (!existing) {
      const body: CreateProductBody = { ...create };
      const features: CreateFeature[] = [];
      if (spec.licenseKey) features.push(licenseFeature(spec.licenseKey));
      for (const p of filePlans) features.push(fileFeature(p));
      if (features.length) body.features = features;
      if (Object.keys(ownedMeta).length) body.metadata = { ...ownedMeta };
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
    // The API can't clear a suggested price (`suggested_price: null` is refused),
    // so a removed suggestion is not recorded as done and is reported every run.
    const storedSuggestion = storedOwned[PWYW_METADATA_KEY];
    if (
      create.payWhatYouWant &&
      create.suggestedPrice === undefined &&
      typeof storedSuggestion === "number" &&
      storedSuggestion > 0
    ) {
      ownedMeta[PWYW_METADATA_KEY] = storedSuggestion;
      item.warnings.push(
        issue(
          "pwyw_suggestion_not_clearable",
          `Lemon Squeezy no longer suggests a price, and the API can't remove Creem's suggested price of ${storedSuggestion}. Remove it in the dashboard; this warning repeats on every run.`,
        ),
      );
    }
    if (!sameRecord(storedOwned, ownedMeta)) {
      set("metadata", { ...otherMeta, ...ownedMeta }, "metadata");
      if ((storedOwned[PWYW_METADATA_KEY] ?? null) !== (ownedMeta[PWYW_METADATA_KEY] ?? null)) {
        update.payWhatYouWant = Boolean(create.payWhatYouWant);
        if (create.suggestedPrice !== undefined) update.suggestedPrice = create.suggestedPrice;
        changes.push("pay_what_you_want");
      }
    }

    // Features: a PATCH replaces the features of each type it names, so every
    // other stored feature of that type is sent back unchanged.
    const features: UpdateFeature[] = [];
    const keyedLicense = stored.find(
      (f) => f.type === "licenseKey" && f.externalId === LICENSE_KEY_FEATURE_KEY,
    );
    if (spec.licenseKey) {
      const licenses = stored.filter((f) => f.type === "licenseKey");
      const keyless = licenses.filter((f) => !f.externalId);
      // Without the keyed feature, the merchant's only keyless one gets the key.
      const target = keyedLicense ?? (keyless.length === 1 ? keyless[0] : undefined);
      if (!target && licenses.length)
        item.warnings.push(
          issue(
            "license_key_feature_ambiguous",
            `The Creem product has license-key features, none with the key ${LICENSE_KEY_FEATURE_KEY}; none is changed and none is added. Give the one buyers should get the key ${LICENSE_KEY_FEATURE_KEY} in Creem.`,
          ),
        );
      else if (
        !target ||
        target !== keyedLicense ||
        !sameLicense(target.licenseKey, spec.licenseKey)
      ) {
        features.push(
          // A stored feature keeps its description, so the merchant's wording stays.
          licenseFeature(spec.licenseKey, target?.id, target?.description),
        );
        for (const f of licenses) if (f !== target) features.push(keepFeature(f)!);
        changes.push("features.license_key");
        if (target && target !== keyedLicense)
          item.warnings.push(
            issue(
              "feature_adopted",
              `License-key feature ${target.id} gets the key ${LICENSE_KEY_FEATURE_KEY} and the Lemon Squeezy settings.`,
            ),
          );
      }
    } else if (keyedLicense)
      item.warnings.push(
        issue(
          "stale_feature_kept",
          "The variant no longer has license keys; the Creem license-key feature is kept. Remove it in Creem if you want to.",
        ),
      );
    if (filePlans.some((p) => p.changed)) {
      for (const p of filePlans) features.push(fileFeature(p));
      const planned = new Set(filePlans.map((p) => p.featureId).filter(Boolean));
      for (const f of stored)
        if (f.type === "file" && !planned.has(f.id)) features.push(keepFeature(f)!);
      changes.push("features.file");
    }
    const lsFileKeys = new Set([
      ...spec.files.map((f) => f.key),
      ...spec.otherFileIds.map(fileKey),
    ]);
    for (const [key] of keyedFiles)
      if (/^ls_file_\d+$/.test(key) && !lsFileKeys.has(key))
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

  // ---- orphans: keyed Creem products this run doesn't migrate still sell
  const itemKeys = new Set(productItems.map((i) => i.key));
  const orphaned = (id: string) =>
    issue(
      "orphaned",
      `Creem product ${id} has this key and stays as it is, so it can still be sold. Archive it in Creem if it shouldn't be.`,
    );
  for (const item of productItems) {
    const stored = item.action === "skip" ? productsByKey.get(item.key) : undefined;
    if (!stored) continue;
    item.creem_id = stored.id;
    if (stored.status !== "archived") item.warnings.push(orphaned(stored.id));
  }
  for (const product of creemCatalog.products) {
    const id = /^ls_variant_(\d+)$/.exec(product.externalId ?? "")?.[1];
    if (!id || itemKeys.has(product.externalId!) || product.status === "archived") continue;
    productItems.push(
      newItem({
        kind: "product",
        key: product.externalId!,
        name: product.name,
        source: { type: "variant", id },
        action: "skip",
        creem_id: product.id,
        reason: issue("variant_not_found", `This Lemon Squeezy store has no variant ${id}.`),
        warnings: [orphaned(product.id)],
      }),
    );
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
  for (const item of productItems)
    if (item.adopted_from) keyOfProductId.set(item.adopted_from, item.key);
  // Like a product orphan: a keyed Creem discount this run doesn't migrate still
  // redeems. Reported, never expired: that would be a write nobody asked for.
  const stillRedeemable = (id: string) =>
    issue(
      "orphaned",
      `Creem discount ${id} has this key and stays active, so buyers can still redeem it. Expire or delete it in Creem if they shouldn't.`,
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
    const planned = planDiscount(
      discount,
      currency,
      options.now,
      migratedKeys,
      objects.discountRedemptions?.[discount.id],
      item,
    );
    if (!planned) {
      const stored = discountsByKey.get(item.key);
      if (stored) {
        item.creem_id = stored.id;
        if (stored.status === "active") item.warnings.push(stillRedeemable(stored.id));
      }
      continue;
    }
    const found = match(
      "discount",
      item.key,
      discountsByKey,
      creemCatalog.discounts,
      creemCatalog.discounts.filter(
        (d) => d.code.toUpperCase() === discount.attributes.code.toUpperCase(),
      ),
      (d) => discountDifferences(d, planned),
      item,
    );
    if (found.rejected) {
      item.reason = found.rejected;
      continue;
    }
    if (found.pending) {
      item.creem_id = found.pending.length === 1 ? found.pending[0].id : null;
      item.reason = unconfirmed("discount", item.key, found.pending);
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
    // The API keeps no record of which products the migrator put on a
    // discount, so it can't tell a variant LS dropped from one the merchant
    // added. The set only grows: missing migrated products are added, every
    // stored product is sent back, and LS-keyed ones LS doesn't list are
    // reported, never removed.
    const storedIds = existing.appliesToProducts ?? [];
    const storedKeys = new Set(
      storedIds
        .map((id) => keyOfProductId.get(id))
        .filter((k): k is string => k !== undefined && LS_VARIANT_KEY.test(k)),
    );
    const wanted = planned.appliesToProductExternalIds ?? [];
    const missing = wanted.filter((k) => !storedKeys.has(k));
    const unlisted = [...storedKeys].filter((k) => !wanted.includes(k));
    if (missing.length) {
      if (storedIds.length) update.appliesToProducts = [...storedIds];
      update.appliesToProductExternalIds = missing;
      changes.push("applies_to_products");
    }
    if (unlisted.length)
      item.warnings.push(
        issue(
          "discount_product_kept",
          `Lemon Squeezy doesn't apply this discount to ${unlisted.join(", ")}. The migrator can't tell whether Lemon Squeezy dropped them or you added them in Creem, so they stay; remove them in Creem if the discount shouldn't apply. This warning repeats on every run.`,
        ),
      );
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

  // Keyed Creem discounts whose LS discount is gone. Not with
  // --exclude-discounts: then every keyed discount would look gone.
  if (!objects.discountsExcluded) {
    const discountKeys = new Set(discountItems.map((i) => i.key));
    for (const d of creemCatalog.discounts) {
      const id = /^ls_discount_(\d+)$/.exec(d.externalId ?? "")?.[1];
      if (!id || discountKeys.has(d.externalId!) || d.status !== "active") continue;
      discountItems.push(
        newItem({
          kind: "discount",
          key: d.externalId!,
          name: d.code,
          source: { type: "discount", id },
          action: "skip",
          creem_id: d.id,
          reason: issue("discount_not_found", `This Lemon Squeezy store has no discount ${id}.`),
          warnings: [stillRedeemable(d.id)],
        }),
      );
    }
  }

  for (const id of Object.keys(decisions))
    if (!consulted.has(id))
      rejectAnswer(
        id.slice("adopt:".length),
        "the run migrates nothing with this key (a typo, or an item skipped by a mapping rule: see its reason in the plan).",
      );

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
    answerErrors,
  };
}

/** The Creem discount for an LS discount, or `undefined` with the skip reason on the item. */
function planDiscount(
  discount: LSDiscount,
  currency: "USD" | "EUR",
  now: Date,
  migratedKeys: string[],
  redeemed: number | undefined,
  item: MigrationItem,
): CreateDiscountBody | undefined {
  const a = discount.attributes;
  if (a.status !== "published") {
    item.reason = issue("discount_not_published", `The discount is ${a.status}, not published.`);
    return undefined;
  }
  if (a.code.length > DISCOUNT_CODE_MAX) {
    item.reason = issue(
      "discount_code_too_long",
      `Creem codes have at most ${DISCOUNT_CODE_MAX} characters; ${a.code} has ${a.code.length}. Create it in Creem with a shorter code.`,
    );
    return undefined;
  }
  if (a.expires_at && new Date(a.expires_at).getTime() <= now.getTime()) {
    item.reason = issue("discount_expired", `The discount expired at ${a.expires_at}.`);
    return undefined;
  }
  // LS's cap is for the code's lifetime and Creem counts from zero: only what's
  // left carries over. While LS still sells, a re-run lowers it to match.
  let remaining: number | undefined;
  if (a.is_limited_redemptions && a.max_redemptions) {
    if (redeemed === undefined) {
      item.reason = issue(
        "discount_redemptions_unknown",
        "The discount has a redemption limit, and Lemon Squeezy did not say how many are used.",
      );
      return undefined;
    }
    remaining = a.max_redemptions - redeemed;
    if (remaining <= 0) {
      item.reason = issue(
        "discount_used_up",
        `All ${a.max_redemptions} redemptions are used in Lemon Squeezy.`,
      );
      return undefined;
    }
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
  let name = a.name;
  if (name.length > DISCOUNT_NAME_MAX) {
    name = name.slice(0, DISCOUNT_NAME_MAX).trimEnd();
    item.warnings.push(
      issue(
        "discount_name_truncated",
        `Creem discount names have at most ${DISCOUNT_NAME_MAX} characters; the name becomes "${name}".`,
      ),
    );
  }
  const body: CreateDiscountBody = {
    name,
    code: a.code,
    type: a.amount_type === "percent" ? "percentage" : "fixed",
    ...(a.amount_type === "percent" ? { percentage: a.amount } : { amount: a.amount, currency }),
    duration: a.duration,
  };
  if (a.duration === "repeating") body.durationInMonths = a.duration_in_months ?? 1;
  if (remaining !== undefined) body.maxRedemptions = remaining;
  if (a.expires_at) body.expiryDate = new Date(a.expires_at);
  body.externalId = discountKey(discount.id);
  body.appliesToProductExternalIds = applies;
  return body;
}

/** How a candidate discount differs from the planned one: shown, never matched on. */
function discountDifferences(d: DiscountEntity, planned: CreateDiscountBody): string[] {
  const differences: string[] = [];
  const ls = (value: unknown) => ` (Lemon Squeezy: ${String(value)})`;
  if (d.code !== planned.code) differences.push(`code ${d.code}${ls(planned.code)}`);
  if (d.name !== planned.name) differences.push(`name "${d.name}"${ls(`"${planned.name}"`)}`);
  const value = (type: string, percentage?: number | null, amount?: number | null) =>
    type === "percentage" ? `${percentage}%` : `${amount}`;
  const stored = value(d.type, d.percentage, d.amount);
  const wanted = value(planned.type, planned.percentage, planned.amount);
  if (d.type !== planned.type || stored !== wanted)
    differences.push(`${d.type} ${stored}${ls(`${planned.type} ${wanted}`)}`);
  if (d.duration !== planned.duration)
    differences.push(`duration ${d.duration}${ls(planned.duration)}`);
  return differences;
}
