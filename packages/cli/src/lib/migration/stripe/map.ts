import type Stripe from "stripe";
import type {
  CreateMeterApiRequestDto,
  MeterApiResponseDto,
  ProductEntity,
} from "creem/models/components";
import type { CreateProductRequest, UpdateMeterRequest } from "creem/models/operations";
import { billing, trialDays } from "../billing";
import type { CreemCatalog } from "../catalog";
import { adoptionMatcher, issue, sameName, type MigrationPlan } from "../plan";
import type { MigrationRequest } from "../plan";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
  newItem,
  summarize,
  type MigrationIssue,
  type MigrationItem,
  type MigrationReport,
} from "../report";
import type { StripeObjects } from "./source";

type ProductBody = CreateProductRequest["createProductRequestEntity"];
type MeterUpdate = UpdateMeterRequest["updateMeterApiRequestDto"];

export interface FromStripeOptions {
  /** Answers to adoption proposals by id (`adopt:<key>`): a Creem id, or `new`. */
  adoption?: Record<string, string>;
  /** Write inactive Stripe prices and products as archived Creem products. */
  includeArchived?: boolean;
}

/** What Creem takes as an `external_id`. */
export const CREEM_KEY = /^[A-Za-z0-9_.:-]{1,255}$/;

/**
 * A price's key: its lookup key when Creem takes it as a key, else its id.
 * Never a slug of a name, which would change with a rename.
 */
export const priceKey = (price: Stripe.Price): string =>
  price.lookup_key && CREEM_KEY.test(price.lookup_key) ? price.lookup_key : price.id;

const NOT_MIGRATED: [string, string, string][] = [
  ["customers", "out_of_scope", "Customers are not migrated: the migrator reads no customers."],
  [
    "subscriptions",
    "out_of_scope",
    "Subscriptions are not migrated; move subscribers as the guide describes.",
  ],
  [
    "meter_events",
    "out_of_scope",
    "Usage already recorded on Stripe meters is not migrated; send new usage events to Creem.",
  ],
  [
    "coupons",
    "not_yet_supported",
    "Coupons and promotion codes are not migrated yet: discounts come with v2 of the Stripe migrator.",
  ],
];

const INTERVAL_NAMES: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};
function intervalName(price: Stripe.Price): string {
  const r = price.recurring;
  if (!r) return "One-time";
  if (r.interval_count === 1) return INTERVAL_NAMES[r.interval];
  return `Every ${r.interval_count} ${r.interval}s`;
}

const productIdOf = (price: Stripe.Price) =>
  typeof price.product === "string" ? price.product : price.product.id;

/** Why a price is not migrated, before its amount and period are looked at. */
function unsupported(price: Stripe.Price): MigrationIssue | undefined {
  const r = price.recurring;
  if (r?.usage_type === "metered")
    return r.meter
      ? issue(
          "usage_price_without_base_price",
          `The price bills usage on meter ${r.meter} in arrears. Creem refuses a recurring product at price 0, so it has no base price to bill the usage on; the meter itself is migrated. Add a usage price on it to a Creem product.`,
        )
      : issue(
          "legacy_metered_usage",
          "The price bills legacy usage records, not a Billing Meter; Creem meters count usage events. Move it to a Billing Meter in Stripe, or set it up in Creem.",
        );
  if (price.billing_scheme === "tiered")
    return issue("tiered_pricing", "Tiered prices are not migrated: Creem has no tiered prices.");
  if (price.transform_quantity)
    return issue(
      "transform_quantity",
      `The price bills per package of ${price.transform_quantity.divide_by} units (transform_quantity); Creem bills per unit.`,
    );
  const currency = price.currency.toUpperCase();
  if (currency !== "USD" && currency !== "EUR") {
    const options = Object.entries(price.currency_options ?? {})
      .filter(([c, o]) => (c === "usd" || c === "eur") && o.unit_amount != null)
      .map(([c, o]) => `${c.toUpperCase()} ${o.unit_amount}`);
    return issue(
      "currency_unsupported",
      `The price is in ${currency}; Creem prices are in USD or EUR, and the migrator converts no currency.` +
        (options.length
          ? ` Its currency options name ${options.join(" and ")}: set the product up in Creem at one of them.`
          : ""),
    );
  }
  return undefined;
}

/** The price fields of a product body, or why the price is skipped. */
function mapPrice(
  price: Stripe.Price,
  warnings: MigrationIssue[],
): { body: Omit<ProductBody, "externalId" | "name" | "description"> } | { skip: MigrationIssue } {
  const skip = (code: string, message: string) => ({ skip: issue(code, message) });
  const currency = price.currency.toUpperCase() as "USD" | "EUR";
  const r = price.recurring;
  const body: Omit<ProductBody, "externalId" | "name" | "description"> = {
    price: 0,
    currency,
    billingType: r ? "recurring" : "onetime",
  };
  const custom = price.custom_unit_amount;
  if (custom) {
    const minimum = custom.minimum ?? 0;
    if (minimum < 100)
      return skip(
        "pwyw_minimum_below_100",
        `Creem's pay what you want starts at a minimum of 100; this one is ${custom.minimum ?? "not set"}. Set the product up in Creem.`,
      );
    body.price = minimum;
    body.payWhatYouWant = true;
    if (custom.preset != null && custom.preset >= minimum) body.suggestedPrice = custom.preset;
    if (custom.maximum != null)
      warnings.push(
        issue(
          "pwyw_maximum_dropped",
          `Creem's pay what you want has no maximum; Stripe's ${custom.maximum} is dropped.`,
        ),
      );
  } else if (price.unit_amount == null)
    return skip(
      "decimal_amount_unsupported",
      `The price is ${price.unit_amount_decimal} cents; Creem prices are whole cents.`,
    );
  else body.price = price.unit_amount;
  if (r) {
    const period = billing(r.interval, r.interval_count);
    if ("skip" in period) return period;
    Object.assign(body, period);
    if (body.price === 0)
      return skip("free_recurring_unsupported", "Creem refuses a recurring product at price 0.");
    const days = trialDays("day", r.trial_period_days, warnings);
    if (days) body.trialPeriodDays = days;
  }
  if (body.price !== 0 && body.price! < 100)
    return skip(
      "price_below_minimum",
      `Creem prices are 0 or at least 100 (one whole unit); this one is ${body.price}.`,
    );
  if (price.tax_behavior === "inclusive") body.taxMode = "inclusive";
  else if (price.tax_behavior === "exclusive") body.taxMode = "exclusive";
  return { body };
}

/**
 * The Creem product names of a product's prices: the product name, plus the
 * nickname or interval when more than one of its prices maps (an active price
 * counts its active siblings only, so `--include-archived` renames nothing),
 * plus the currency when two names would still be the same.
 */
function priceNames(product: Stripe.Product, prices: Stripe.Price[]): Map<string, string> {
  const maps = prices.filter((p) => !unsupported(p) && !("skip" in mapPrice(p, [])));
  const live = maps.filter((p) => p.active);
  const base = new Map(
    prices.map((p) => {
      const siblings = !maps.includes(p) ? prices : p.active ? live : maps;
      const name =
        siblings.length > 1
          ? `${product.name} - ${p.nickname?.trim() || intervalName(p)}`
          : product.name;
      return [p.id, name];
    }),
  );
  return new Map(
    prices.map((p) => {
      const name = base.get(p.id)!;
      const twin =
        maps.includes(p) &&
        maps.some((o) => o !== p && base.get(o.id) === name && o.currency !== p.currency);
      return [p.id, twin ? `${name} (${p.currency.toUpperCase()})` : name];
    }),
  );
}

/** The Creem meter for a Billing Meter, or why it is skipped. */
function mapMeter(
  meter: Stripe.Billing.Meter,
  unitLabel: string | undefined,
  warnings: MigrationIssue[],
):
  | { body: CreateMeterApiRequestDto & { aggregation: "sum" | "count" } }
  | { skip: MigrationIssue } {
  const formula = meter.default_aggregation.formula;
  const aggregation = formula === "sum" ? "sum" : formula === "count" ? "count" : undefined;
  if (!aggregation)
    return {
      skip: issue(
        "aggregation_unsupported",
        `Creem meters don't take Stripe's "${formula}" aggregation; set this meter up in Creem.`,
      ),
    };
  const body: CreateMeterApiRequestDto & { aggregation: "sum" | "count" } = {
    externalId: meter.id,
    name: meter.display_name,
    eventName: meter.event_name,
    aggregation,
  };
  if (aggregation === "sum") body.aggregationProperty = meter.value_settings?.event_payload_key;
  if (!unitLabel)
    warnings.push(
      issue(
        "unit_label_from_event_name",
        `No Stripe product of a price on this meter has a unit label, so the Creem unit label is the event name, "${meter.event_name}". It names the meter's credit bucket and can't change once the meter exists.`,
      ),
    );
  body.unitLabel = unitLabel ?? meter.event_name;
  return { body };
}

const stripe = (value: unknown) => ` (Stripe: ${String(value)})`;

/** How a Creem meter differs from what a Billing Meter maps to: shown, never matched on. */
function meterDifferences(m: MeterApiResponseDto, body: CreateMeterApiRequestDto): string[] {
  const list: string[] = [];
  if (m.eventName !== body.eventName)
    list.push(`event name ${m.eventName}${stripe(body.eventName)}`);
  if (m.aggregation !== body.aggregation)
    list.push(`aggregation ${m.aggregation}${stripe(body.aggregation)}`);
  else if (body.aggregationProperty && m.aggregationProperty !== body.aggregationProperty)
    list.push(`aggregation property ${m.aggregationProperty}${stripe(body.aggregationProperty)}`);
  if (m.unitLabel !== body.unitLabel)
    list.push(`unit label ${m.unitLabel}${stripe(body.unitLabel)}`);
  if (m.status === "archived") list.push("archived");
  return list;
}

/** How a Creem product differs from what a price maps to: shown, never matched on. */
function productDifferences(p: ProductEntity, body: ProductBody): string[] {
  const list: string[] = [];
  if (p.price !== body.price) list.push(`price ${p.price}${stripe(body.price)}`);
  if (p.currency.toUpperCase() !== body.currency)
    list.push(`currency ${p.currency}${stripe(body.currency)}`);
  if (p.billingType !== body.billingType)
    list.push(`billing type ${p.billingType}${stripe(body.billingType)}`);
  else if (body.billingPeriod && p.billingPeriod !== body.billingPeriod)
    list.push(`billing period ${p.billingPeriod}${stripe(body.billingPeriod)}`);
  if (p.status === "archived") list.push("archived");
  return list;
}

/**
 * Maps a Stripe account's catalog (Billing Meters, and one product per price)
 * onto a Creem store: the requests that make the store match it, and the
 * report of every item. Pure: it reads nothing and writes nothing.
 *
 * `creemCatalog` is the store's existing products and meters. A stored object
 * with the key gets the keyed upsert, which changes only what differs; an
 * unkeyed look-alike is a proposal, adopted only when `adoption` answers it.
 */
export function fromStripe(
  objects: StripeObjects,
  creemCatalog: CreemCatalog,
  options: FromStripeOptions = {},
): MigrationPlan {
  const byKey = <T extends { externalId: string | null }>(list: T[]) =>
    new Map(list.filter((o) => o.externalId).map((o) => [o.externalId as string, o]));
  const creemMeters = creemCatalog.meters ?? [];
  const metersByKey = byKey<MeterApiResponseDto>(creemMeters);
  const productsByKey = byKey<ProductEntity>(creemCatalog.products);
  // A product migrated under another key of the price: its lookup key changed in Stripe since.
  const movedFrom = new Map<string, ProductEntity>();
  for (const price of objects.prices) {
    const key = priceKey(price);
    const moved = creemCatalog.products.find(
      (p) => p.externalId && p.externalId !== key && p.metadata?.stripe_price_id === price.id,
    );
    if (moved && !productsByKey.has(key)) movedFrom.set(key, moved);
  }
  // Moving a key is proposed like an adoption; the shared matcher proposes unkeyed objects only.
  const answers = Object.entries(options.adoption ?? {});
  const isMove = ([id]: [string, string]) => movedFrom.has(id.slice("adopt:".length));
  const adoption = adoptionMatcher(Object.fromEntries(answers.filter((a) => !isMove(a))));
  const keyMoves = adoptionMatcher(Object.fromEntries(answers.filter(isMove)));
  const productsById = new Map(objects.products.map((p) => [p.id, p]));
  const adoptions: MigrationRequest[] = [];
  const meterRequests: MigrationRequest[] = [];
  const productRequests: MigrationRequest[] = [];
  const meterItems: MigrationItem[] = [];
  const productItems: MigrationItem[] = [];

  // ---- meters; a meter's unit label is the unit label of a product priced on it
  const unitLabels = new Map<string, string>();
  for (const price of objects.prices) {
    const meter = price.recurring?.meter;
    const label = productsById.get(productIdOf(price))?.unit_label;
    if (meter && label && !unitLabels.has(meter)) unitLabels.set(meter, label);
  }
  for (const meter of objects.meters) {
    const item = newItem({
      kind: "meter",
      key: meter.id,
      name: meter.display_name,
      source: { type: "meter", id: meter.id },
      action: "skip",
    });
    meterItems.push(item);
    const mapped = mapMeter(meter, unitLabels.get(meter.id), item.warnings);
    if ("skip" in mapped) {
      item.reason = mapped.skip;
      item.creem_id = metersByKey.get(meter.id)?.id ?? null;
      continue;
    }
    const { body } = mapped;
    const found = adoption.match(
      "meter",
      meter.id,
      metersByKey,
      creemMeters,
      creemMeters.filter((m) => sameName(m.name, body.name!)),
      (m) => meterDifferences(m, body),
      item,
    );
    if (found.rejected || found.pending) {
      item.creem_id = found.pending?.length === 1 ? found.pending[0].id : null;
      item.reason = found.rejected ?? adoption.unconfirmed("meter", meter.id, found.pending!);
      continue;
    }
    item.status = "pending";
    const existing = found.existing;
    item.action = existing ? "update" : "create";
    item.creem_id = existing?.id ?? null;
    if (item.adopted_from) {
      // The PATCH gives the key; event name and unit label can't change after create.
      const update: MeterUpdate = {
        externalId: meter.id,
        name: body.name,
        aggregation: body.aggregation,
      };
      if (body.aggregationProperty) update.aggregationProperty = body.aggregationProperty;
      adoptions.push({
        type: "adopt_meter",
        key: meter.id,
        request: { id: existing!.id, updateMeterApiRequestDto: update },
      });
    } else
      meterRequests.push({
        type: "upsert_meter",
        key: meter.id,
        request: { createMeterApiRequestDto: body },
      });
  }

  // ---- products: one per price
  const pricesOf = new Map<string, Stripe.Price[]>();
  for (const price of objects.prices) {
    const id = productIdOf(price);
    pricesOf.set(id, [...(pricesOf.get(id) ?? []), price]);
  }
  // A lookup key can be another price's id: one Creem key for two prices.
  const pricesByKey = new Map<string, Stripe.Price[]>();
  for (const price of objects.prices)
    pricesByKey.set(priceKey(price), [...(pricesByKey.get(priceKey(price)) ?? []), price]);
  /** Fails an item whose key another price has too; nothing is written for either. */
  const collides = (item: MigrationItem, price: Stripe.Price): boolean => {
    const others = (pricesByKey.get(item.key) ?? []).filter((p) => p.id !== price.id);
    if (!others.length) return false;
    const whose = (p: Stripe.Price) =>
      p.id === item.key
        ? `the id of Stripe price ${p.id}`
        : `the lookup key of Stripe price ${p.id}`;
    item.status = "failed";
    item.error = {
      code: "key_collision",
      message: `The key ${item.key} is ${[price, ...others].map(whose).join(" and ")}; one Creem product can't stand for both, so neither is migrated.`,
      status: null,
      hint: "Give the price another lookup key in Stripe, then re-run.",
    };
    return true;
  };
  const mapProductPrice = (price: Stripe.Price, product: Stripe.Product, name: string) => {
    const key = priceKey(price);
    const item = newItem({
      kind: "product",
      key,
      name,
      source: { type: "price", id: price.id, product_id: product.id },
      action: "skip",
    });
    productItems.push(item);
    if (collides(item, price)) return;
    item.creem_id = productsByKey.get(key)?.id ?? null;
    const reason = unsupported(price);
    if (reason) {
      item.reason = reason;
      return;
    }
    const priced = mapPrice(price, item.warnings);
    if ("skip" in priced) {
      item.reason = priced.skip;
      return;
    }
    const body: ProductBody = {
      externalId: key,
      name,
      description: product.description?.trim() || name,
      ...priced.body,
    };
    if (!price.active || !product.active) body.status = "archived";
    if (product.images?.length)
      item.warnings.push(
        issue("image_not_migrated", "The product images are not migrated; add them in Creem."),
      );
    const moved = movedFrom.get(key);
    // The moved product is offered as if it had no key; its PATCH gives it the new one.
    const movable = moved && [{ ...moved, externalId: null }];
    const found = movable
      ? keyMoves.match(
          "product",
          key,
          new Map(),
          movable,
          movable,
          (p) => [`key ${moved.externalId}${stripe(key)}`, ...productDifferences(p, body)],
          item,
        )
      : adoption.match(
          "product",
          key,
          productsByKey,
          creemCatalog.products,
          creemCatalog.products
            .filter((p) => sameName(p.name, name))
            .sort(
              (a, b) =>
                Number(a.billingType !== body.billingType) -
                  Number(b.billingType !== body.billingType) ||
                Number(a.status === "archived") - Number(b.status === "archived") ||
                Math.abs(a.price - body.price!) - Math.abs(b.price - body.price!),
            ),
          (p) => productDifferences(p, body),
          item,
        );
    if (found.rejected || found.pending) {
      item.creem_id = found.pending?.length === 1 ? found.pending[0].id : null;
      item.reason =
        found.rejected ??
        (moved
          ? issue(
              "adoption_unconfirmed",
              `Creem product ${moved.id} was migrated from this price with the key ${moved.externalId}; the price's key is now ${key}. Answer the proposal: move the key to it (in a terminal, or with --adopt ${key}=${moved.id}) or create a new product (--adopt ${key}=new).`,
            )
          : adoption.unconfirmed("product", key, found.pending!));
      return;
    }
    const existing = found.existing;
    // A sent `metadata` replaces the stored one: the stored keys are sent back,
    // without a lookup key that no longer applies.
    const { stripe_lookup_key: _replaced, ...stored } = existing?.metadata ?? {};
    body.metadata = {
      ...stored,
      ...product.metadata,
      ...price.metadata,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      ...(key !== price.lookup_key && price.lookup_key
        ? { stripe_lookup_key: price.lookup_key }
        : {}),
    };
    if (price.lookup_key && key !== price.lookup_key)
      item.warnings.push(
        issue(
          "lookup_key_replaced",
          `Stripe's lookup key "${price.lookup_key}" isn't a valid Creem key (letters, digits, _ - . : and at most 255 characters), so the key is the price id ${price.id}; the lookup key is kept in metadata.stripe_lookup_key.`,
        ),
      );
    if (existing?.payWhatYouWant && !body.payWhatYouWant && body.billingType === "onetime")
      body.payWhatYouWant = false;
    if (existing?.status === "archived" && body.status !== "archived")
      item.warnings.push(
        issue("creem_product_archived", "The Creem product is archived; it stays archived."),
      );
    item.status = "pending";
    if (!existing) {
      item.action = "create";
      productRequests.push({
        type: "upsert_product",
        key,
        request: { createProductRequestEntity: body },
      });
      return;
    }
    item.creem_id = existing.id;
    item.action = "update";
    const { externalId: _key, ...update } = body;
    // Only a PATCH by id can adopt, or clear a trial (the upsert takes no `null`).
    const clearsTrial = Boolean(existing.trialPeriodDays) && !body.trialPeriodDays;
    if (item.adopted_from || clearsTrial)
      (item.adopted_from ? adoptions : productRequests).push({
        type: item.adopted_from ? "adopt_product" : "update_product",
        key,
        request: {
          id: existing.id,
          updateProductRequestEntity: {
            ...(item.adopted_from ? { externalId: key } : {}),
            ...update,
            ...(clearsTrial ? { trialPeriodDays: null } : {}),
          },
        },
      });
    else
      productRequests.push({
        type: "upsert_product",
        key,
        request: { createProductRequestEntity: body },
      });
  };

  for (const product of objects.products) {
    const prices = pricesOf.get(product.id) ?? [];
    if (!prices.length) {
      productItems.push(
        newItem({
          kind: "product",
          key: product.id,
          name: product.name,
          source: { type: "product", id: product.id },
          action: "skip",
          reason: issue(
            "no_price",
            `The Stripe product has no ${options.includeArchived ? "" : "active "}price, so there is nothing to sell in Creem.`,
          ),
        }),
      );
      continue;
    }
    const names = priceNames(product, prices);
    for (const price of prices) mapProductPrice(price, product, names.get(price.id)!);
  }
  // Active prices of a product that wasn't read: an archived one.
  for (const price of objects.prices) {
    const productId = productIdOf(price);
    if (productsById.has(productId)) continue;
    const item = newItem({
      kind: "product",
      key: priceKey(price),
      name: price.nickname?.trim() || price.id,
      source: { type: "price", id: price.id, product_id: productId },
      action: "skip",
      reason: options.includeArchived
        ? issue("product_not_found", `Stripe returned no product ${productId} for the price.`)
        : issue(
            "archived",
            `The Stripe product ${productId} is archived (--include-archived writes it archived).`,
          ),
    });
    productItems.push(item);
    collides(item, price);
  }

  adoption.finish();
  keyMoves.finish();
  const items = [...meterItems, ...productItems];
  const notMigrated: MigrationReport["not_migrated"] = NOT_MIGRATED.map(
    ([kind, code, message]) => ({ kind, reason: issue(code, message) }),
  );
  const endpoints = objects.webhookEndpoints;
  const counted =
    endpoints === null
      ? "Webhook endpoints are"
      : endpoints === 0
        ? "The account has no webhook endpoint; webhooks are"
        : endpoints === 1
          ? "The account's webhook endpoint is"
          : `The account's ${endpoints} webhook endpoints are`;
  notMigrated.push({
    kind: "webhooks",
    reason: issue(
      "not_catalog",
      `${counted} not migrated: they are not catalog data. Add your endpoint in Creem and handle Creem's events.`,
    ),
  });
  const report: MigrationReport = {
    schema: MIGRATION_REPORT_SCHEMA,
    version: MIGRATION_REPORT_VERSION,
    source: {
      provider: "stripe",
      store_id: objects.account.id,
      store_name: objects.account.name,
      // Unknown when the key may not read the account.
      currency: objects.account.currency || null,
    },
    mode: "plan",
    summary: summarize(items),
    items,
    proposals: [...adoption.proposals, ...keyMoves.proposals],
    not_migrated: notMigrated,
    fetch_failures: [],
  };
  return {
    requests: [...adoptions, ...meterRequests, ...productRequests],
    report,
    answerErrors: [...adoption.answerErrors, ...keyMoves.answerErrors],
    productGroupOf: Object.fromEntries(
      creemCatalog.productGroups.flatMap((g) =>
        g.products.map((p) => [p.id, { id: g.id, externalId: g.externalId }]),
      ),
    ),
  };
}
