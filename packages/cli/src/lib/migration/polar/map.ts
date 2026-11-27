import type {
  CreateMeterApiRequestDto,
  DiscountEntity,
  FeatureEntity,
  MeterApiResponseDto,
  ProductEntity,
  ProductGroupEntity,
} from "creem/models/components";
import type {
  CreateDiscountRequest,
  CreateProductRequest,
  UpdateDiscountRequest,
} from "creem/models/operations";
import { billing, trialDays } from "../billing";
import type { CreemCatalog } from "../catalog";
import {
  UPLOAD_PREFIX,
  adoptionMatcher,
  clearsField,
  issue,
  sameName,
  type MigrationPlan,
  type MigrationRequest,
} from "../plan";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
  newItem,
  summarize,
  type MigrationError,
  type MigrationIssue,
  type MigrationItem,
  type MigrationReport,
} from "../report";
import type {
  PolarDiscount,
  PolarFilterClause,
  PolarMeter,
  PolarObjects,
  PolarPrice,
  PolarProduct,
} from "./source";

type ProductBody = CreateProductRequest["createProductRequestEntity"];
type Feature = NonNullable<ProductBody["features"]>[number];
type UsagePrice = NonNullable<ProductBody["usagePrices"]>[number];
type DiscountBody = CreateDiscountRequest["createDiscountRequestEntity"];

export interface FromPolarOptions {
  now?: Date;
  /** Answers to adoption proposals by id (`adopt:<key>`): a Creem id, or `new`. */
  adoption?: Record<string, string>;
  /** Write archived Polar products as archived Creem products instead of skipping them. */
  includeArchived?: boolean;
}

const NOT_MIGRATED: [string, string][] = [
  ["customers", "Customers are not migrated: the migrator reads no customers."],
  ["subscriptions", "Subscriptions are not migrated; move subscribers as the guide describes."],
  ["orders", "Orders are not migrated; export them from Polar."],
  ["license_keys", "License keys already issued in Polar are not migrated."],
  ["checkout_links", "Checkout links are not migrated; create checkouts in Creem."],
  ["webhooks", "Webhooks are not migrated; add your endpoint in Creem."],
  ["benefits", "Benefits no product grants are not read; only a product's benefits are migrated."],
];

type Operator = NonNullable<CreateMeterApiRequestDto["filter"]>["clauses"][number]["operator"];
/** Polar's filter operators that Creem names differently; `gt`, `gte`, `lt` and `lte` are the same. */
const OPERATORS: Record<string, Operator> = {
  eq: "equals",
  ne: "not_equals",
  like: "contains",
  not_like: "not_contains",
};

/**
 * The Creem meter for a Polar meter and the unit label its credit features
 * use, or why it is skipped, or why a stored meter can't take it (`fail`).
 */
function mapMeter(
  meter: PolarMeter,
  existing: MeterApiResponseDto | undefined,
  warnings: MigrationIssue[],
):
  | { body: CreateMeterApiRequestDto; unitLabel: string }
  | { skip: MigrationIssue }
  | { fail: MigrationError } {
  const unsupported = (why: string) => ({
    skip: issue(
      "meter_filter_unsupported",
      `${why} A Creem meter counts one event name, narrowed by flat clauses; set this meter up in Creem.`,
    ),
  });
  const { conjunction, clauses } = meter.filter;
  if (clauses.some((c) => "clauses" in c)) return unsupported("The filter has nested clauses.");
  const flat = clauses as PolarFilterClause[];
  const names = flat.filter((c) => c.property === "name");
  const name = names[0];
  if (names.length !== 1 || name.operator !== "eq" || typeof name.value !== "string")
    return unsupported(
      names.length
        ? "The filter tests the event name with something other than one `name eq` clause."
        : "The filter has no `name eq` clause to take the event name from.",
    );
  const rest = flat.filter((c) => c !== name);
  if (conjunction === "or" && rest.length)
    return unsupported("The filter joins its clauses with `or`, so they don't narrow the event.");
  // Creem ignores a changed event name: usage would go on counting the stored one.
  if (existing && existing.eventName !== name.value)
    return {
      fail: {
        code: "meter_event_name_changed",
        message: `The Polar meter counts the event "${name.value}"; the Creem meter counts "${existing.eventName}", and a meter's event name can't change. Neither the meter nor the products priced on it are written.`,
        status: null,
        hint: `Send the events to Creem as "${existing.eventName}", or create a Creem meter for "${name.value}" and move the usage prices to it by hand.`,
      },
    };
  let unitLabel = meter.name;
  if (meter.unit === "custom" && meter.custom_label) unitLabel = meter.custom_label;
  else if (meter.unit === "token") unitLabel = "tokens";
  else if (!existing)
    warnings.push(
      issue(
        "unit_label_from_name",
        `The Polar meter has no unit label, so the Creem unit label is its name, "${meter.name}". It names the meter's credit bucket and can't change once the meter exists.`,
      ),
    );
  // A stored meter keeps its unit label, which also names its credit bucket.
  if (existing && existing.unitLabel !== unitLabel)
    warnings.push(
      issue(
        "unit_label_not_writable",
        `The Polar unit label is "${unitLabel}"; the Creem meter keeps "${existing.unitLabel}", which can't change and names the credit bucket of its credit features.`,
      ),
    );
  const { aggregation } = meter;
  const body: CreateMeterApiRequestDto = {
    externalId: meter.id,
    name: meter.name,
    eventName: name.value,
    aggregation: aggregation.func === "avg" ? "average" : aggregation.func,
  };
  if ("property" in aggregation) body.aggregationProperty = aggregation.property;
  // A sent filter replaces the stored one, so a stored meter gets it even when empty.
  if (rest.length || existing)
    body.filter = {
      conjunction,
      clauses: rest.map((c) => ({
        property: c.property,
        operator: OPERATORS[c.operator] ?? c.operator,
        value: c.value,
      })),
    };
  if (!existing) body.unitLabel = unitLabel;
  return { body, unitLabel: existing?.unitLabel ?? unitLabel };
}

const STATIC_PRICES = new Set(["fixed", "custom", "free"]);
const INTERVAL_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
const INTERVAL_NAMES: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};
/** The base price of a product body, or why it is skipped. */
function mapPrice(
  price: PolarPrice,
  interval: string | null | undefined,
  count: number | null | undefined,
  warnings: MigrationIssue[],
): { body: Omit<ProductBody, "externalId" | "name" | "description"> } | { skip: MigrationIssue } {
  const amount =
    price.amount_type === "fixed"
      ? (price.price_amount ?? 0)
      : price.amount_type === "custom"
        ? (price.minimum_amount ?? 0)
        : 0;
  const pwyw = price.amount_type === "custom";
  const currency = price.price_currency.toUpperCase();
  if (currency !== "USD" && currency !== "EUR")
    return {
      skip: issue(
        "currency_unsupported",
        `The price is in ${currency}; Creem prices are in USD or EUR, and the migrator converts no currency.`,
      ),
    };
  const body: Omit<ProductBody, "externalId" | "name" | "description"> = {
    price: amount,
    currency,
    billingType: interval ? "recurring" : "onetime",
  };
  const skip = (code: string, message: string) => ({ skip: issue(code, message) });
  if (interval) {
    if (amount === 0)
      return skip("free_recurring_unsupported", "Creem refuses a recurring product at price 0.");
    const period = billing(interval, count);
    if ("skip" in period) return period;
    Object.assign(body, period);
    if (pwyw)
      warnings.push(
        issue(
          "pwyw_recurring_unsupported",
          `Pay what you want is one-time only in Creem; the subscription gets its minimum price, ${amount} cents, as a fixed price.`,
        ),
      );
  } else if (pwyw) {
    if (amount < 100)
      return skip(
        "pwyw_minimum_below_100",
        `Creem's pay what you want starts at a minimum of 100; this one is ${amount}. Set the product up in Creem.`,
      );
    body.payWhatYouWant = true;
    const preset = price.preset_amount ?? 0;
    if (preset >= 100 && preset >= amount) body.suggestedPrice = preset;
  }
  if (amount !== 0 && amount < 100)
    return skip(
      "price_below_minimum",
      `Creem prices are 0 or at least 100 (one whole unit); this one is ${amount}.`,
    );
  return { body };
}

/** A stored feature sent back as it is, so a per-type replace keeps it. */
function keepFeature(feature: FeatureEntity): Feature | undefined {
  const base = { id: feature.id, description: feature.description };
  if (feature.type === "licenseKey" && feature.licenseKey)
    return { ...base, type: "licenseKey", licenseKey: feature.licenseKey };
  if (feature.type === "custom")
    return { ...base, type: "custom", privateNote: feature.privateNote ?? "" };
  if (feature.type === "customerCredits" && feature.customerCredits)
    return { ...base, type: "customerCredits", customerCredits: feature.customerCredits };
  if (feature.type === "file" && feature.file)
    return {
      ...base,
      type: "file",
      file: { files: feature.file.files.map((f) => ({ id: f.id })) },
    };
  return undefined;
}

const BENEFIT_NAMES: Record<string, string> = {
  discord: "Discord",
  github_repository: "GitHub repository",
  downloadables: "downloadables",
  feature_flag: "feature flag",
  slack_shared_channel: "Slack channel",
};

/** A product's benefits as Creem features, keyed by the benefit id. */
function mapBenefits(
  product: PolarProduct,
  recurring: boolean,
  meterLabels: Map<string, string>,
  warnings: MigrationIssue[],
): Feature[] {
  const features: Feature[] = [];
  for (const benefit of product.benefits) {
    const p = benefit.properties;
    const base = { externalId: benefit.id, description: benefit.description };
    if (benefit.type === "license_keys") {
      const activations = p.activations as {
        limit?: number;
        enable_customer_admin?: boolean;
      } | null;
      const expires = p.expires as { ttl: number; timeframe: "day" | "month" | "year" } | null;
      const other = [
        p.prefix ? `prefix (${String(p.prefix)})` : "",
        p.limit_usage ? `usage limit (${String(p.limit_usage)})` : "",
        activations?.enable_customer_admin ? "customer self-service deactivation" : "",
      ].filter(Boolean);
      if (other.length)
        warnings.push(
          issue(
            "license_key_settings_not_migrated",
            `The license key's ${other.join(", ")} ${other.length > 1 ? "are" : "is"} not migrated: Creem license keys have no such setting. The activation limit and expiry are.`,
          ),
        );
      features.push({
        ...base,
        type: "licenseKey",
        licenseKey: {
          activationLimit: activations?.limit ?? null,
          expiry: expires ? { interval: expires.timeframe, intervalCount: expires.ttl } : null,
        },
      });
    } else if (benefit.type === "custom") {
      if (typeof p.note === "string" && p.note.trim())
        features.push({ ...base, type: "custom", privateNote: p.note });
      else
        warnings.push(
          issue(
            "benefit_note_empty",
            `The custom benefit "${benefit.description}" has no note to migrate.`,
          ),
        );
    } else if (benefit.type === "meter_credit") {
      const label = meterLabels.get(String(p.meter_id));
      if (!label) {
        warnings.push(
          issue(
            "meter_not_migrated",
            `The credit benefit "${benefit.description}" is on meter ${String(p.meter_id)}, which isn't migrated, so it isn't either.`,
          ),
        );
        continue;
      }
      features.push({
        ...base,
        type: "customerCredits",
        customerCredits: {
          amount: String(p.units),
          unitLabel: label,
          bucketName: label,
          ...(recurring ? { resetsEachPeriod: !p.rollover } : {}),
        },
      });
      warnings.push(
        issue(
          "credits_not_spent_by_postpaid",
          `The ${String(p.units)} credits land in the customer's "${label}" bucket. Creem bills postpaid usage at renewal and never from credits, so they don't reduce a postpaid usage price as Polar's do; a prepaid usage price on the meter spends them.`,
        ),
      );
    } else if (benefit.type !== "downloadables")
      warnings.push(
        issue(
          "benefit_unsupported",
          `The ${BENEFIT_NAMES[benefit.type] ?? benefit.type} benefit "${benefit.description}" is not migrated: Creem has no equivalent. Set it up outside Creem.`,
        ),
      );
  }
  return features;
}

/** How a candidate differs from the product a Polar product maps to: shown, never matched on. */
function differences(p: ProductEntity, body: ProductBody): string[] {
  const polar = (value: unknown) => ` (Polar: ${String(value)})`;
  const list: string[] = [];
  if (p.price !== body.price) list.push(`price ${p.price}${polar(body.price)}`);
  if (p.currency.toUpperCase() !== body.currency)
    list.push(`currency ${p.currency}${polar(body.currency)}`);
  if (p.billingType !== body.billingType)
    list.push(`billing type ${p.billingType}${polar(body.billingType)}`);
  else if (p.billingPeriod !== body.billingPeriod)
    list.push(`billing period ${p.billingPeriod}${polar(body.billingPeriod)}`);
  if (p.status === "archived") list.push("archived");
  return list;
}

const DISCOUNT_CODE_MAX = 14;
const DISCOUNT_NAME_MAX = 40;

/** The Creem discount for a Polar discount, or `undefined` with the skip reason on the item. */
function planDiscount(
  d: PolarDiscount,
  now: Date,
  keysOf: Map<string, string[]>,
  item: MigrationItem,
): (DiscountBody & { code: string }) | undefined {
  const skip = (code: string, message: string) => {
    item.reason = issue(code, message);
    return undefined;
  };
  if (!d.code)
    return skip(
      "discount_code_missing",
      "The discount has no code: Polar applies it through checkout links, and a Creem discount is redeemed by its code.",
    );
  if (d.code.length > DISCOUNT_CODE_MAX)
    return skip(
      "discount_code_too_long",
      `Creem codes have at most ${DISCOUNT_CODE_MAX} characters; ${d.code} has ${d.code.length}. Create it in Creem with a shorter code.`,
    );
  if (d.ends_at && Date.parse(d.ends_at) <= now.getTime())
    return skip("discount_expired", `The discount ended at ${d.ends_at}.`);
  if (d.starts_at && Date.parse(d.starts_at) > now.getTime())
    return skip(
      "start_date_unsupported",
      `The discount starts at ${d.starts_at}; a Creem discount is valid once it exists. Run the migration again from then.`,
    );
  // Polar's limit is for the code's lifetime and Creem counts from zero: only what's left carries over.
  const remaining = d.max_redemptions == null ? undefined : d.max_redemptions - d.redemptions_count;
  if (remaining !== undefined && remaining <= 0)
    return skip("discount_used_up", `All ${d.max_redemptions} redemptions are used in Polar.`);
  let applies = [...keysOf.values()].flat();
  if (d.products.length) {
    applies = d.products.flatMap((p) => keysOf.get(p.id) ?? []);
    const missing = d.products.filter((p) => !keysOf.has(p.id)).map((p) => p.id);
    if (missing.length && applies.length)
      item.warnings.push(
        issue(
          "discount_products_partially_migrated",
          `The discount applies only to the migrated products; not migrated: ${missing.join(", ")}.`,
        ),
      );
  } else if (applies.length)
    item.warnings.push(
      issue(
        "applies_to_migrated_products",
        `Polar applies the discount to every product, also to later ones; in Creem it applies to the ${applies.length} migrated products. Add new products to it in Creem.`,
      ),
    );
  if (!applies.length)
    return skip("discount_products_not_migrated", "None of the discount's products is migrated.");
  const body: DiscountBody & { code: string } = {
    externalId: d.id,
    name: d.name,
    code: d.code,
    type: d.type,
    duration: d.duration,
  };
  if (d.type === "percentage") body.percentage = (d.basis_points ?? 0) / 100;
  else {
    const currency = (d.currency ?? "").toUpperCase();
    if (currency !== "USD" && currency !== "EUR")
      return skip(
        "currency_unsupported",
        `The discount is in ${currency}; Creem's are in USD or EUR.`,
      );
    Object.assign(body, { amount: d.amount, currency });
  }
  if (d.duration === "repeating") body.durationInMonths = d.duration_in_months ?? 1;
  if (remaining !== undefined) body.maxRedemptions = remaining;
  if (d.ends_at) body.expiryDate = new Date(d.ends_at);
  if (d.max_redemptions_per_customer)
    item.warnings.push(
      issue(
        "per_customer_limit_not_migrated",
        `Polar limits the code to ${d.max_redemptions_per_customer} redemption(s) per customer; Creem has no such limit.`,
      ),
    );
  if (d.name.length > DISCOUNT_NAME_MAX) {
    body.name = d.name.slice(0, DISCOUNT_NAME_MAX).trimEnd();
    item.warnings.push(
      issue(
        "discount_name_truncated",
        `Creem discount names have at most ${DISCOUNT_NAME_MAX} characters; the name becomes "${body.name}".`,
      ),
    );
  }
  body.appliesToProductExternalIds = applies;
  return body;
}

interface Offer {
  key: string;
  name: string;
  product: PolarProduct;
  price: PolarPrice;
  metered: PolarPrice[];
  interval: string | null | undefined;
  count: number | null | undefined;
}

/**
 * Maps a Polar organization's catalog onto a Creem store: the requests that
 * make the store match it, and the report of every item. Pure: it reads
 * nothing and writes nothing.
 *
 * Every request carries the whole mapped object; a stored object gets it as a
 * keyed upsert, which changes only what differs, and Creem's dry run says
 * which fields that is (`changes`) or that it is `unchanged`.
 */
export function fromPolar(
  objects: PolarObjects,
  creemCatalog: CreemCatalog,
  options: FromPolarOptions = {},
): MigrationPlan {
  const adoption = adoptionMatcher(options.adoption ?? {});
  const byKey = <T extends { externalId: string | null }>(list: T[]) =>
    new Map(list.filter((o) => o.externalId).map((o) => [o.externalId as string, o]));
  const metersByKey = byKey<MeterApiResponseDto>(creemCatalog.meters ?? []);
  const productsByKey = byKey<ProductEntity>(creemCatalog.products);
  const groupsByKey = byKey<ProductGroupEntity>(creemCatalog.productGroups);
  const preferred = (objects.organization.default_presentment_currency ?? "").toUpperCase();
  const requests: MigrationRequest[] = [];
  const meterItems: MigrationItem[] = [];
  const productItems: MigrationItem[] = [];
  const groupItems: MigrationItem[] = [];
  const discountItems: MigrationItem[] = [];
  const fileItems = new Map<string, MigrationItem>();
  const uploads: MigrationRequest[] = [];
  const filesById = new Map(objects.files.map((f) => [f.id, f]));
  /**
   * The file feature of a downloadables benefit, keyed by the benefit id. A
   * Polar file the stored feature holds (same name and SHA-256) is kept; any
   * other is uploaded from its local copy in the real run, once per run.
   */
  const fileFeature = (
    benefit: PolarProduct["benefits"][number],
    product: PolarProduct,
    existing: ProductEntity | undefined,
    warnings: MigrationIssue[],
  ): Feature | undefined => {
    const archived = (benefit.properties.archived ?? {}) as Record<string, boolean>;
    const ids = ((benefit.properties.files ?? []) as string[]).filter((id) => !archived[id]);
    const stored = existing?.features?.find(
      (f) => f.type === "file" && f.externalId === benefit.id,
    );
    const storedFiles = stored?.file?.files ?? [];
    const kept = new Set<string>();
    const files: { id: string }[] = [];
    for (const id of ids) {
      const file = filesById.get(id);
      const fileItem =
        fileItems.get(id) ??
        newItem({
          kind: "file",
          key: id,
          name: file?.name ?? id,
          source: { type: "file", id, product_id: product.id },
          action: "skip",
        });
      fileItems.set(id, fileItem);
      if (!file?.is_uploaded) {
        fileItem.reason = issue("file_not_found", "Polar has no uploaded file with this id.");
        continue;
      }
      const sha256 = file.checksum_sha256_base64 ?? objects.fileDigests[id]?.sha256;
      const same = storedFiles.find((f) => f.fileName === file.name && f.sha256 === sha256);
      if (same) {
        kept.add(same.id);
        files.push({ id: same.id });
        if (fileItem.action === "skip")
          Object.assign(fileItem, { action: "unchanged", creem_id: same.id });
        continue;
      }
      const digest = objects.fileDigests[id];
      if (!digest) {
        fileItem.reason =
          objects.fileProblems[id] ??
          issue(
            "file_not_available",
            `Polar's API hands out no file downloads, so the migrator uploads your own copy: download ${file.name} from Polar into a folder and pass it with --polar-files-dir.`,
          );
        continue;
      }
      files.push({ id: `${UPLOAD_PREFIX}${id}` });
      if (fileItem.status === "pending") continue;
      Object.assign(fileItem, { action: "create", status: "pending", reason: null });
      uploads.push({
        type: "upload_file",
        key: id,
        lsFileId: id,
        request: {
          purpose: "product_file",
          filename: file.name,
          contentType: digest.contentType,
          size: digest.size,
          sha256: digest.sha256,
        },
      });
    }
    // A stored file Polar no longer lists stays, so past buyers keep their download.
    for (const f of storedFiles)
      if (!kept.has(f.id)) {
        files.push({ id: f.id });
        warnings.push(
          issue(
            "file_kept",
            `Creem file ${f.id} (${f.fileName}) isn't one of the Polar benefit's files; it stays in the feature. Remove it in Creem if buyers shouldn't get it.`,
          ),
        );
      }
    if (!files.length) return undefined;
    return {
      type: "file",
      externalId: benefit.id,
      description: stored?.description ?? benefit.description,
      file: { files },
    };
  };

  // ---- meters
  /** The unit label of each migrated meter, by Polar id. */
  const meterLabels = new Map<string, string>();
  /** Stored meters this run can't write, by Polar id: their products fail too. */
  const failedMeters = new Set<string>();
  for (const meter of objects.meters) {
    const item = newItem({
      kind: "meter",
      key: meter.id,
      name: meter.name,
      source: { type: "meter", id: meter.id },
      action: "skip",
    });
    meterItems.push(item);
    const existing = metersByKey.get(meter.id);
    if (existing) item.creem_id = existing.id;
    if (meter.archived_at) {
      item.reason = issue("archived", "The meter is archived in Polar.");
      continue;
    }
    const mapped = mapMeter(meter, existing, item.warnings);
    if ("skip" in mapped) {
      item.reason = mapped.skip;
      continue;
    }
    if ("fail" in mapped) {
      Object.assign(item, { action: "update", status: "failed", error: mapped.fail });
      failedMeters.add(meter.id);
      continue;
    }
    meterLabels.set(meter.id, mapped.unitLabel);
    item.action = existing ? "update" : "create";
    item.status = "pending";
    requests.push({
      type: "upsert_meter",
      key: meter.id,
      request: { createMeterApiRequestDto: mapped.body },
    });
  }

  // ---- products: one per Polar product, or per price of a legacy product
  const offers: { offer: Offer; item: MigrationItem }[] = [];
  for (const product of objects.products) {
    const prices = product.prices.filter((p) => !p.is_archived);
    const legacy = !product.recurring_interval && prices.some((p) => p.legacy);
    const statics = prices.filter((p) => STATIC_PRICES.has(p.amount_type));
    const productItem = (key: string, source: MigrationItem["source"], name = product.name) => {
      const item = newItem({ kind: "product", key, name, source, action: "skip" });
      productItems.push(item);
      return item;
    };
    const skipAll = (reason: MigrationIssue) => {
      const keys = legacy && statics.length ? statics : [undefined];
      for (const price of keys)
        productItem(
          price?.id ?? product.id,
          price
            ? { type: "price", id: price.id, product_id: product.id }
            : { type: "product", id: product.id },
        ).reason = reason;
    };
    if (product.is_archived && !options.includeArchived) {
      skipAll(
        issue(
          "archived",
          "The product is archived in Polar (--include-archived writes it archived).",
        ),
      );
      continue;
    }
    if (product.visibility === "draft") {
      skipAll(issue("product_draft", "The product is a draft in Polar, so it isn't sold."));
      continue;
    }
    if (prices.some((p) => p.amount_type === "seat_based")) {
      skipAll(
        issue(
          "seat_pricing_unsupported",
          "Seat-based prices are not migrated: Creem has no seat pricing.",
        ),
      );
      continue;
    }
    const other = prices.find(
      (p) => !STATIC_PRICES.has(p.amount_type) && p.amount_type !== "metered_unit",
    );
    if (other) {
      skipAll(
        issue(
          "tiered_price_unsupported",
          `The "${other.amount_type}" price is not migrated: Creem has no tiered prices.`,
        ),
      );
      continue;
    }
    if (!statics.length) {
      skipAll(
        issue(
          "usage_price_without_base_price",
          "The product has only metered prices: Creem refuses a recurring product at price 0, so there's no base price to put the usage on.",
        ),
      );
      continue;
    }
    if (legacy) {
      for (const price of statics) {
        offers.push({
          offer: {
            key: price.id,
            name:
              statics.length > 1
                ? `${product.name} - ${INTERVAL_NAMES[price.recurring_interval ?? ""] ?? "One-time"}`
                : product.name,
            product,
            price,
            metered: [],
            interval: price.recurring_interval,
            count: 1,
          },
          item: productItem(price.id, { type: "price", id: price.id, product_id: product.id }),
        });
      }
      continue;
    }
    // One currency per Creem product: the organization's default, else USD, else EUR.
    const currency = [preferred, "USD", "EUR"].find(
      (c) =>
        (c === "USD" || c === "EUR") && statics.some((p) => p.price_currency.toUpperCase() === c),
    );
    const item = productItem(product.id, { type: "product", id: product.id });
    if (!currency) {
      item.reason = issue(
        "currency_unsupported",
        `The product is priced in ${[...new Set(statics.map((p) => p.price_currency.toUpperCase()))].join(", ")}; Creem prices are in USD or EUR, and the migrator converts no currency.`,
      );
      continue;
    }
    const others = [...new Set(prices.map((p) => p.price_currency.toUpperCase()))].filter(
      (c) => c !== currency,
    );
    if (others.length)
      item.warnings.push(
        issue(
          "currency_prices_not_migrated",
          `The ${others.join(", ")} prices are not migrated: a Creem product has one currency, ${currency}.`,
        ),
      );
    const inCurrency = prices.filter((p) => p.price_currency.toUpperCase() === currency);
    offers.push({
      offer: {
        key: product.id,
        name: product.name,
        product,
        price: inCurrency.find((p) => STATIC_PRICES.has(p.amount_type))!,
        metered: inCurrency.filter((p) => p.amount_type === "metered_unit"),
        interval: product.recurring_interval,
        count: product.recurring_interval_count,
      },
      item,
    });
  }

  /** The planned body of each migrated offer, for the product groups. */
  const planned = new Map<string, ProductBody>();
  for (const { offer, item } of offers) {
    const { product } = offer;
    item.name = offer.name;
    const priced = mapPrice(offer.price, offer.interval, offer.count, item.warnings);
    if ("skip" in priced) {
      item.reason =
        offer.metered.length && priced.skip.code === "free_recurring_unsupported"
          ? issue(
              "usage_price_without_base_price",
              "The product's base price is free and it has metered prices: Creem refuses a recurring product at price 0, so there's no base price to put the usage on.",
            )
          : priced.skip;
      continue;
    }
    const body: ProductBody = {
      externalId: offer.key,
      name: offer.name,
      description: product.description?.trim() || offer.name,
      ...priced.body,
    };
    if (body.billingType === "recurring") {
      const days = trialDays(product.trial_interval, product.trial_interval_count, item.warnings);
      if (days) body.trialPeriodDays = days;
    }
    const failedMeter = offer.metered.find((m) => failedMeters.has(m.meter_id ?? ""));
    if (failedMeter) {
      const stored = productsByKey.get(offer.key);
      Object.assign(item, {
        action: stored ? "update" : "create",
        status: "failed",
        creem_id: stored?.id ?? null,
        error: {
          code: "dependency_failed",
          message: `Its meter ${failedMeter.meter_id} can't be written (see the meter), so the product was not written.`,
          status: null,
          hint: "Resolve the meter, then run the migration again.",
        },
      });
      continue;
    }
    const missingMeter = offer.metered.find((m) => !meterLabels.has(m.meter_id ?? ""));
    if (missingMeter) {
      item.reason = issue(
        "meter_not_migrated",
        `The metered price is on meter ${missingMeter.meter_id}, which isn't migrated; without it buyers would pay less.`,
      );
      continue;
    }
    if (offer.metered.length) {
      body.usagePrices = offer.metered.map(
        (m): UsagePrice => ({
          meterExternalId: m.meter_id!,
          unitPrice: Number(m.unit_amount),
          ...(m.cap_amount != null ? { cap: m.cap_amount } : {}),
          settlementMode: "postpaid",
        }),
      );
      const cycle = `${product.meter_interval_count ?? 1} ${product.meter_interval}(s)`;
      if (product.meter_interval && cycle !== `${offer.count ?? 1} ${offer.interval}(s)`)
        item.warnings.push(
          issue(
            "meter_interval_unsupported",
            `Polar bills the usage every ${cycle}; Creem at renewal.`,
          ),
        );
    }
    if (product.is_archived) body.status = "archived";
    if (product.medias?.length)
      item.warnings.push(
        issue("image_not_migrated", "The product images are not migrated; add them in Creem."),
      );
    if (product.attached_custom_fields?.length)
      item.warnings.push(
        issue(
          "custom_fields_not_migrated",
          "The checkout custom fields are not migrated; add them in Creem.",
        ),
      );
    const features = mapBenefits(
      product,
      body.billingType === "recurring",
      meterLabels,
      item.warnings,
    );

    const found = adoption.match(
      "product",
      offer.key,
      productsByKey,
      creemCatalog.products,
      creemCatalog.products
        .filter((p) => sameName(p.name, offer.name))
        .sort(
          (a, b) =>
            Number(a.billingType !== body.billingType) -
              Number(b.billingType !== body.billingType) ||
            Number(a.status === "archived") - Number(b.status === "archived") ||
            Math.abs(a.price - body.price!) - Math.abs(b.price - body.price!),
        ),
      (p) => differences(p, body),
      item,
    );
    if (found.rejected || found.pending) {
      item.creem_id = found.pending?.length === 1 ? found.pending[0].id : null;
      item.reason = found.rejected ?? adoption.unconfirmed("product", offer.key, found.pending!);
      continue;
    }
    const existing = found.existing;
    for (const benefit of product.benefits) {
      const feature =
        benefit.type === "downloadables" && fileFeature(benefit, product, existing, item.warnings);
      if (feature) features.push(feature);
    }
    if (features.length) {
      // `features` replaces the stored features of each type it names: the
      // merchant's other features of those types are sent back as they are.
      const types = new Set(features.map((f) => f.type));
      const keys = new Set(features.map((f) => f.externalId));
      for (const stored of existing?.features ?? []) {
        if (!types.has(stored.type as Feature["type"]) || keys.has(stored.externalId ?? undefined))
          continue;
        const kept = keepFeature(stored);
        if (!kept) continue;
        features.push(kept);
        if (!stored.externalId)
          item.warnings.push(
            issue(
              "feature_kept",
              `Creem feature ${stored.id} (${stored.type}) has no key, so it stays next to the migrated one. Remove it in Creem if it's the same.`,
            ),
          );
      }
      body.features = features;
      item.features = features.flatMap((f) => (f.externalId ? [f.externalId] : []));
    }
    if (existing && body.usagePrices) {
      // `usage_prices` is the complete set: the merchant's own are sent back.
      const ours = new Set(body.usagePrices.map((u) => metersByKey.get(u.meterExternalId!)?.id));
      for (const u of existing.usagePrices ?? [])
        if (!ours.has(u.meterId)) body.usagePrices.push({ ...u, cap: u.cap ?? null });
    }
    if (existing?.payWhatYouWant && !body.payWhatYouWant && body.billingType === "onetime")
      body.payWhatYouWant = false;
    if (existing?.status === "archived" && !product.is_archived)
      item.warnings.push(
        issue("creem_product_archived", "The Creem product is archived; it stays archived."),
      );
    planned.set(offer.key, body);
    item.status = "pending";
    if (!existing) {
      item.action = "create";
      requests.push({
        type: "upsert_product",
        key: offer.key,
        request: { createProductRequestEntity: body },
      });
      continue;
    }
    item.creem_id = existing.id;
    item.action = "update";
    const { externalId: _key, ...update } = body;
    // Only a PATCH by id can adopt, or clear a trial (the upsert takes no `null`).
    const clearsTrial = Boolean(existing.trialPeriodDays) && !body.trialPeriodDays;
    if (item.adopted_from || clearsTrial)
      requests.push({
        type: item.adopted_from ? "adopt_product" : "update_product",
        key: offer.key,
        request: {
          id: existing.id,
          updateProductRequestEntity: {
            ...(item.adopted_from ? { externalId: offer.key } : {}),
            ...update,
            ...(clearsTrial ? { trialPeriodDays: null } : {}),
          },
        },
      });
    else
      requests.push({
        type: "upsert_product",
        key: offer.key,
        request: { createProductRequestEntity: body },
      });
  }

  // ---- product groups: the migrated recurring prices of a legacy product
  const length = (b: ProductBody) =>
    b.billingPeriod === "custom"
      ? INTERVAL_DAYS[b.recurringInterval ?? "month"] * (b.recurringIntervalCount ?? 1)
      : ({
          "every-day": 1,
          "every-month": 30,
          "every-three-months": 90,
          "every-six-months": 180,
          "every-year": 365,
        }[b.billingPeriod as string] ?? 0);
  for (const product of objects.products) {
    const members = offers
      .filter(({ offer }) => offer.product === product && offer.key !== product.id)
      .map(({ offer }) => [offer.key, planned.get(offer.key)] as const)
      .filter((m): m is readonly [string, ProductBody] => m[1]?.billingType === "recurring")
      .sort(([, a], [, b]) => length(a) - length(b) || a.price! - b.price!)
      .map(([key]) => key);
    if (members.length < 2) continue;
    const existing = groupsByKey.get(product.id);
    const item = newItem({
      kind: "product_group",
      key: product.id,
      name: product.name,
      source: { type: "product", id: product.id },
      action: existing ? "update" : "create",
      status: "pending",
      creem_id: existing?.id ?? null,
      members,
    });
    groupItems.push(item);
    // `products` is the complete ordered list: the merchant's other members stay after these.
    const keys = new Set(members);
    const others = (existing?.products ?? []).filter(
      (p) => !p.externalId || !keys.has(p.externalId),
    );
    requests.push({
      type: "upsert_product_group",
      key: product.id,
      request: {
        createProductGroupRequestEntity: {
          externalId: product.id,
          ...(existing ? {} : { name: product.name }),
          products: [
            ...members.map((externalId) => ({ externalId })),
            ...others.map((p) => ({ id: p.id })),
          ],
        },
      },
    });
  }

  // ---- discounts
  const discountsByKey = byKey<DiscountEntity>(creemCatalog.discounts);
  /** The Creem keys of each migrated Polar product: its own, or its legacy prices'. */
  const keysOf = new Map<string, string[]>();
  for (const i of productItems)
    if (i.action !== "skip") {
      const id = i.source.product_id ?? i.source.id;
      keysOf.set(id, [...(keysOf.get(id) ?? []), i.key]);
    }
  const keyOfProductId = new Map(
    creemCatalog.products.filter((p) => p.externalId).map((p) => [p.id, p.externalId as string]),
  );
  for (const discount of objects.discounts) {
    const item = newItem({
      kind: "discount",
      key: discount.id,
      name: discount.code ?? discount.name,
      source: { type: "discount", id: discount.id },
      action: "skip",
    });
    discountItems.push(item);
    item.creem_id = discountsByKey.get(discount.id)?.id ?? null;
    const body = planDiscount(discount, options.now ?? new Date(), keysOf, item);
    if (!body) continue;
    const found = adoption.match(
      "discount",
      discount.id,
      discountsByKey,
      creemCatalog.discounts,
      creemCatalog.discounts.filter((d) => d.code.toUpperCase() === body.code.toUpperCase()),
      (d) =>
        [
          d.name !== body.name ? `name "${d.name}" (Polar: "${body.name}")` : "",
          d.type !== body.type ? `type ${d.type} (Polar: ${body.type})` : "",
          d.duration !== body.duration ? `duration ${d.duration} (Polar: ${body.duration})` : "",
        ].filter(Boolean),
      item,
    );
    if (found.rejected || found.pending) {
      item.creem_id = found.pending?.length === 1 ? found.pending[0].id : null;
      item.reason = found.rejected ?? adoption.unconfirmed("discount", discount.id, found.pending!);
      continue;
    }
    const existing = found.existing;
    if (!existing) {
      const taken = creemCatalog.discounts.find(
        (d) => d.code.toUpperCase() === body.code.toUpperCase(),
      );
      if (taken) {
        item.creem_id = taken.id;
        item.reason = issue(
          "code_taken",
          `Creem discount ${taken.id} already uses the code ${body.code}.`,
        );
        continue;
      }
      item.action = "create";
      item.status = "pending";
      requests.push({
        type: "upsert_discount",
        key: discount.id,
        request: { createDiscountRequestEntity: body },
      });
      continue;
    }
    // Products are only added: the stored ones stay, and the migrated ones it lacks are named by key.
    const stored = existing.appliesToProducts ?? [];
    const storedKeys = new Set(stored.map((id) => keyOfProductId.get(id)));
    const missing = (body.appliesToProductExternalIds ?? []).filter((k) => !storedKeys.has(k));
    const { externalId: _key, appliesToProductExternalIds: _keys, ...update } = body;
    const changes: UpdateDiscountRequest["updateDiscountRequestEntity"] = { ...update };
    if (missing.length) {
      changes.appliesToProducts = stored;
      changes.appliesToProductExternalIds = missing;
    }
    // Clearing a limit or an end date takes `null`, which only a PATCH by id sends.
    if (existing.maxRedemptions != null && body.maxRedemptions === undefined)
      changes.maxRedemptions = null;
    if (existing.expiryDate && !body.expiryDate) changes.expiryDate = null;
    item.creem_id = existing.id;
    item.action = "update";
    item.status = "pending";
    if (item.adopted_from || clearsField(changes))
      requests.push({
        type: item.adopted_from ? "adopt_discount" : "update_discount",
        key: discount.id,
        request: {
          id: existing.id,
          updateDiscountRequestEntity: {
            ...(item.adopted_from ? { externalId: discount.id } : {}),
            ...changes,
          },
        },
      });
    else
      requests.push({
        type: "upsert_discount",
        key: discount.id,
        request: {
          createDiscountRequestEntity: { ...(changes as DiscountBody), externalId: discount.id },
        },
      });
  }

  // Files of products this run doesn't write are reported too.
  for (const file of objects.files)
    if (!fileItems.has(file.id))
      fileItems.set(
        file.id,
        newItem({
          kind: "file",
          key: file.id,
          name: file.name,
          source: { type: "file", id: file.id },
          action: "skip",
          reason: issue("product_not_migrated", "No migrated product grants this file."),
        }),
      );

  adoption.finish();
  const items = [
    ...meterItems,
    ...productItems,
    ...groupItems,
    ...fileItems.values(),
    ...discountItems,
  ];
  const report: MigrationReport = {
    schema: MIGRATION_REPORT_SCHEMA,
    version: MIGRATION_REPORT_VERSION,
    source: {
      provider: "polar",
      store_id: objects.organization.id,
      store_name: objects.organization.name,
      currency: preferred || null,
    },
    mode: "plan",
    summary: summarize(items),
    items,
    proposals: adoption.proposals,
    not_migrated: NOT_MIGRATED.map(([kind, message]) => ({
      kind,
      reason: issue("out_of_scope", message),
    })),
    fetch_failures: [],
  };
  const meters = requests.filter((r) => r.type === "upsert_meter");
  return {
    requests: [...meters, ...uploads, ...requests.filter((r) => r.type !== "upsert_meter")],
    report,
    answerErrors: adoption.answerErrors,
    productGroupOf: Object.fromEntries(
      creemCatalog.productGroups.flatMap((g) =>
        g.products.map((p) => [p.id, { id: g.id, externalId: g.externalId }]),
      ),
    ),
  };
}
