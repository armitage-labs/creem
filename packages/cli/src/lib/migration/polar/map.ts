import type {
  CreateMeterApiRequestDto,
  MeterApiResponseDto,
  ProductEntity,
} from "creem/models/components";
import type { CreateProductRequest } from "creem/models/operations";
import { billing, trialDays } from "../billing";
import type { CreemCatalog } from "../catalog";
import {
  adoptionMatcher,
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
  type MigrationIssue,
  type MigrationItem,
  type MigrationReport,
} from "../report";
import type {
  PolarFilterClause,
  PolarMeter,
  PolarObjects,
  PolarPrice,
  PolarProduct,
} from "./source";

type ProductBody = CreateProductRequest["createProductRequestEntity"];
type UsagePrice = NonNullable<ProductBody["usagePrices"]>[number];

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

/** The Creem meter for a Polar meter, or why it is skipped. */
function mapMeter(
  meter: PolarMeter,
  existing: MeterApiResponseDto | undefined,
  warnings: MigrationIssue[],
): { body: CreateMeterApiRequestDto } | { skip: MigrationIssue } {
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
  let unitLabel = meter.name;
  if (meter.unit === "custom" && meter.custom_label) unitLabel = meter.custom_label;
  else if (meter.unit === "token") unitLabel = "tokens";
  else
    warnings.push(
      issue(
        "unit_label_from_name",
        `The Polar meter has no unit label, so the Creem unit label is its name, "${meter.name}". It names the meter's credit bucket and can't change once the meter exists.`,
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
  body.unitLabel = unitLabel;
  return { body };
}

const STATIC_PRICES = new Set(["fixed", "custom", "free"]);
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

const BENEFIT_NAMES: Record<string, string> = {
  license_keys: "license-key",
  custom: "custom",
  meter_credit: "meter credit",
  downloadables: "downloadables",
  discord: "Discord",
  github_repository: "GitHub repository",
  feature_flag: "feature flag",
  slack_shared_channel: "Slack channel",
};

/** Lists each of a product's benefits on its item: none is migrated. */
function benefitWarnings(product: PolarProduct, warnings: MigrationIssue[]) {
  for (const benefit of product.benefits)
    warnings.push(
      issue(
        "benefit_unsupported",
        `The ${BENEFIT_NAMES[benefit.type] ?? benefit.type} benefit "${benefit.description}" is not migrated; set it up in Creem.`,
      ),
    );
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
  const preferred = (objects.organization.default_presentment_currency ?? "").toUpperCase();
  const requests: MigrationRequest[] = [];
  const meterItems: MigrationItem[] = [];
  const productItems: MigrationItem[] = [];

  // ---- meters
  /** The unit label of each migrated meter, by Polar id. */
  const meterLabels = new Map<string, string>();
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
    meterLabels.set(meter.id, mapped.body.unitLabel!);
    item.action = existing ? "update" : "create";
    item.status = "pending";
    requests.push({
      type: "upsert_meter",
      key: meter.id,
      request: { createMeterApiRequestDto: mapped.body },
    });
  }

  // ---- products
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
      skipAll(
        issue(
          "legacy_prices_unsupported",
          "The product is a legacy product with one price per billing interval; it is not migrated. Set it up in Creem.",
        ),
      );
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

  for (const { offer, item } of offers) {
    const { product } = offer;
    item.name = offer.name;
    const priced = mapPrice(offer.price, offer.interval, offer.count, item.warnings);
    if ("skip" in priced) {
      item.reason = priced.skip;
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
    benefitWarnings(product, item.warnings);

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

  adoption.finish();
  const items = [...meterItems, ...productItems];
  const report: MigrationReport = {
    schema: MIGRATION_REPORT_SCHEMA,
    version: MIGRATION_REPORT_VERSION,
    source: {
      provider: "polar",
      store_id: objects.organization.id,
      store_name: objects.organization.name,
      currency: preferred,
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
  return {
    requests,
    report,
    answerErrors: adoption.answerErrors,
    productGroupOf: Object.fromEntries(
      creemCatalog.productGroups.flatMap((g) =>
        g.products.map((p) => [p.id, { id: g.id, externalId: g.externalId }]),
      ),
    ),
  };
}
