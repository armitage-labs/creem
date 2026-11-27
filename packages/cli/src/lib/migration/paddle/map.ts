import type { ProductEntity, ProductGroupEntity } from "creem/models/components";
import type { CreateProductRequest, UpdateProductRequest } from "creem/models/operations";
import type { CreemCatalog } from "../catalog";
import { billing, trialDays } from "../billing";
import {
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
  type MigrationIssue,
  type MigrationItem,
  type MigrationReport,
} from "../report";
import type { PaddleMoney, PaddleObjects, PaddlePrice, PaddleProduct } from "./source";

export type { PaddleObjects } from "./source";

type UpsertProductBody = CreateProductRequest["createProductRequestEntity"];
/** A create body: the fields a new product needs are always set by the mapping. */
type CreateProductBody = UpsertProductBody &
  Required<Pick<UpsertProductBody, "name" | "description" | "price" | "currency" | "billingType">>;
type UpdateProductBody = UpdateProductRequest["updateProductRequestEntity"];
export interface FromPaddleOptions {
  /** Expired discounts are skipped relative to this time. */
  now: Date;
  /** Answers to adoption proposals, by proposal id (`adopt:<key>`), as for Lemon Squeezy. */
  adoption?: Record<string, string>;
  /** Write archived prices as archived Creem products instead of skipping them. */
  includeArchived?: boolean;
}

const PRICE_KEY = /^pri_/;

const NOT_MIGRATED: [string, string][] = [
  ["customers", "Customers are not migrated: the migrator reads no customers."],
  ["subscriptions", "Subscriptions are not migrated; move subscribers as the guide describes."],
  ["transactions", "Transactions are not migrated; export them from Paddle."],
  ["notification_settings", "Notification settings are not migrated; set up Creem webhooks."],
];

const TAX: Record<string, "saas" | "ebooks"> = { saas: "saas", ebooks: "ebooks" };
const PERIOD_DAYS: Record<string, number> = {
  "every-day": 1,
  "every-month": 30,
  "every-three-months": 90,
  "every-six-months": 180,
  "every-year": 365,
};
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

const money = (m: PaddleMoney) => `${m.amount} ${m.currency_code.toUpperCase()}`;
const isCreemCurrency = (code: string | null | undefined): code is "USD" | "EUR" =>
  code?.toUpperCase() === "USD" || code?.toUpperCase() === "EUR";
const overrides = (price: PaddlePrice, only?: (code: string) => boolean) =>
  (price.unit_price_overrides ?? [])
    .filter((o) => !only || only(o.unit_price.currency_code))
    .map((o) => `${o.country_codes.join(", ")}: ${money(o.unit_price)}`)
    .join("; ");

/** How long a billing period is, in days, to order a group's members. */
function periodDays(body: CreateProductBody): number {
  if (body.billingPeriod === "custom")
    return (UNIT_DAYS[body.recurringInterval ?? ""] ?? 0) * (body.recurringIntervalCount ?? 1);
  return PERIOD_DAYS[body.billingPeriod ?? ""] ?? 0;
}

/** Product and price `custom_data` as Creem metadata, which holds strings and numbers only. */
function metadataOf(...sources: (Record<string, unknown> | null)[]) {
  const metadata: Record<string, string | number> = {};
  const dropped: string[] = [];
  for (const source of sources)
    for (const [key, value] of Object.entries(source ?? {}))
      if (typeof value === "string" || typeof value === "number") metadata[key] = value;
      else if (!dropped.includes(key)) dropped.push(key);
  return { metadata, dropped };
}

/** Maps one price to its Creem product body, or the reason it is skipped. */
function mapPrice(
  price: PaddlePrice,
  product: PaddleProduct,
  includeArchived: boolean,
  warnings: MigrationIssue[],
):
  | { body: Omit<CreateProductBody, "name" | "description" | "externalId"> }
  | { skip: MigrationIssue } {
  if (price.type === "custom" || product.type === "custom")
    return {
      skip: issue(
        "non_catalog",
        "Non-catalog prices are made for one Paddle transaction; they are not part of the catalog.",
      ),
    };
  const archived = price.status === "archived" || product.status === "archived";
  if (archived && !includeArchived)
    return {
      skip: issue(
        "archived",
        `The ${price.status === "archived" ? "price" : "product"} is archived in Paddle. Pass --include-archived to write it as an archived Creem product.`,
      ),
    };
  const currency = price.unit_price.currency_code.toUpperCase();
  if (!isCreemCurrency(currency)) {
    const hint = overrides(price, isCreemCurrency);
    return {
      skip: issue(
        "currency_unsupported",
        `Creem sells in USD and EUR; this price is in ${currency}.` +
          (hint ? ` Its country prices in USD or EUR: ${hint}.` : ""),
      ),
    };
  }
  const amount = Number(price.unit_price.amount);
  const recurring = price.billing_cycle != null;
  if (!Number.isInteger(amount) || amount < 0)
    return {
      skip: issue("price_unsupported", `The amount ${price.unit_price.amount} is not whole cents.`),
    };
  if (recurring && amount === 0)
    return {
      skip: issue("free_recurring_unsupported", "Creem refuses a recurring product at price 0."),
    };
  if (amount !== 0 && amount < 100)
    return {
      skip: issue(
        "price_below_minimum",
        `Creem prices are 0 or at least 100 (one whole unit); this one is ${amount}.`,
      ),
    };
  const body: Omit<CreateProductBody, "name" | "description" | "externalId"> = {
    price: amount,
    currency,
    billingType: recurring ? "recurring" : "onetime",
  };
  if (price.billing_cycle) {
    const period = billing(price.billing_cycle.interval, price.billing_cycle.frequency);
    if ("skip" in period) return period;
    Object.assign(body, period);
    const days = trialDays(price.trial_period?.interval, price.trial_period?.frequency, warnings);
    if (days) body.trialPeriodDays = days;
  }
  if (price.unit_price_overrides?.length)
    warnings.push(
      issue(
        "price_overrides_not_migrated",
        `Creem has one price per product and no country prices, so these are not migrated: ${overrides(price)}. Every buyer pays ${money(price.unit_price)}.`,
      ),
    );
  const q = price.quantity;
  if (q && (q.minimum !== 1 || q.maximum !== 100))
    warnings.push(
      issue(
        "quantity_not_migrated",
        `Paddle limits the quantity to ${q.minimum}–${q.maximum}; the limit is not migrated.`,
      ),
    );
  const tax = TAX[product.tax_category] ?? "digital-goods-service";
  if (tax === "ebooks" && recurring) {
    body.taxCategory = "digital-goods-service";
    warnings.push(
      issue(
        "tax_category_changed",
        "Creem's ebooks tax category is one-time only; the subscription gets digital-goods-service.",
      ),
    );
  } else body.taxCategory = tax;
  if (archived) body.status = "archived";
  return { body };
}

/** How a candidate differs from the product a price maps to: shown, never matched on. */
function productDifferences(p: ProductEntity, create: CreateProductBody): string[] {
  const paddle = (value: unknown) => ` (Paddle: ${String(value)})`;
  const differences: string[] = [];
  if (p.name !== create.name) differences.push(`name "${p.name}"${paddle(`"${create.name}"`)}`);
  if (p.price !== create.price) differences.push(`price ${p.price}${paddle(create.price)}`);
  if (p.currency.toUpperCase() !== create.currency)
    differences.push(`currency ${p.currency}${paddle(create.currency)}`);
  if (p.billingType !== create.billingType)
    differences.push(`billing type ${p.billingType}${paddle(create.billingType)}`);
  else if (p.billingPeriod !== (create.billingPeriod ?? p.billingPeriod))
    differences.push(`billing period ${p.billingPeriod}${paddle(create.billingPeriod)}`);
  if (p.status === "archived") differences.push("archived");
  return differences;
}

interface ProductSpec {
  key: string;
  product: PaddleProduct;
  create: CreateProductBody;
  item: MigrationItem;
}

/**
 * Maps a Paddle Billing catalog onto a Creem store: the requests that make the
 * store match it, and the report of every item. Pure: it reads nothing and
 * writes nothing. Paddle has no SKU or lookup key, so Paddle ids are the keys:
 * `pri_…` for products, `pro_…` for product groups, `dsc_…` for discounts.
 */
export function fromPaddle(
  objects: PaddleObjects,
  creemCatalog: CreemCatalog,
  options: FromPaddleOptions,
): MigrationPlan {
  const adoption = adoptionMatcher(options.adoption ?? {});
  const { match, unconfirmed, proposals, answerErrors } = adoption;
  const byKey = <T extends { externalId: string | null }>(list: T[]) =>
    new Map(list.filter((o) => o.externalId).map((o) => [o.externalId as string, o]));
  const productsByKey = byKey<ProductEntity>(creemCatalog.products);
  const groupsByKey = byKey<ProductGroupEntity>(creemCatalog.productGroups);
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const productRequests: MigrationRequest[] = [];
  const groupRequests: MigrationRequest[] = [];
  const productItems: MigrationItem[] = [];
  const groupItems: MigrationItem[] = [];
  const specs: ProductSpec[] = [];

  // ---- products: one per price
  const products = [...objects.products].sort(byId);
  const pricesOf = new Map<string, PaddlePrice[]>();
  for (const price of [...objects.prices].sort(byId))
    pricesOf.set(price.product_id, [...(pricesOf.get(price.product_id) ?? []), price]);
  const productIds = new Set(products.map((p) => p.id));
  for (const [productId, prices] of pricesOf)
    if (!productIds.has(productId))
      for (const price of prices)
        productItems.push(
          newItem({
            kind: "product",
            key: price.id,
            name: price.description,
            source: { type: "price", id: price.id, product_id: productId },
            action: "skip",
            reason: issue("product_not_found", `Paddle listed no product ${productId}.`),
          }),
        );
  for (const product of products) {
    const prices = pricesOf.get(product.id) ?? [];
    const mapped = prices.map((price) => {
      const item = newItem({
        kind: "product",
        key: price.id,
        name: product.name,
        source: { type: "price", id: price.id, product_id: product.id },
        action: "skip",
      });
      const body = mapPrice(price, product, Boolean(options.includeArchived), item.warnings);
      if ("skip" in body) item.reason = body.skip;
      return { price, item, body };
    });
    const several = mapped.filter((m) => !("skip" in m.body)).length > 1;
    for (const { price, item, body } of mapped) {
      productItems.push(item);
      const named = "skip" in body ? prices.length > 1 : several;
      item.name = named ? `${product.name} - ${price.description}` : product.name;
      if ("skip" in body) continue;
      const { metadata, dropped } = metadataOf(product.custom_data, price.custom_data);
      if (dropped.length)
        item.warnings.push(
          issue(
            "metadata_not_migrated",
            `Creem metadata holds strings and numbers; these custom_data keys are not migrated: ${dropped.join(", ")}.`,
          ),
        );
      const create: CreateProductBody = {
        name: item.name,
        description: product.description?.trim() || item.name,
        ...body.body,
        ...(Object.keys(metadata).length ? { metadata } : {}),
        externalId: price.id,
      };
      specs.push({ key: price.id, product, create, item });
    }
  }

  for (const { key, create, item } of specs) {
    const found = match(
      "product",
      key,
      productsByKey,
      creemCatalog.products,
      creemCatalog.products
        .filter((p) => sameName(p.name, create.name))
        .sort(
          (a, b) =>
            Number(a.billingType !== create.billingType) -
              Number(b.billingType !== create.billingType) ||
            Number(a.status === "archived") - Number(b.status === "archived") ||
            Math.abs(a.price - create.price) - Math.abs(b.price - create.price),
        ),
      (p) => productDifferences(p, create),
      item,
    );
    if (found.rejected || found.pending) {
      item.action = "skip";
      if (found.pending) item.creem_id = found.pending.length === 1 ? found.pending[0].id : null;
      item.reason = found.rejected ?? unconfirmed("product", key, found.pending!);
      continue;
    }
    const existing = found.existing;
    item.status = "pending";
    if (!existing) {
      item.action = "create";
      productRequests.push({
        type: "upsert_product",
        key,
        request: { createProductRequestEntity: create },
      });
      continue;
    }
    item.creem_id = existing.id;
    const update: UpdateProductBody = {};
    const changes: string[] = [];
    const set = <K extends keyof UpdateProductBody>(
      field: K,
      value: UpdateProductBody[K],
      label: string,
    ) => {
      update[field] = value;
      changes.push(label);
    };
    if (existing.name !== create.name) set("name", create.name, "name");
    if (existing.description !== create.description)
      set("description", create.description, "description");
    if (existing.price !== create.price) set("price", create.price, "price");
    if (existing.currency.toUpperCase() !== create.currency)
      set("currency", create.currency, "currency");
    if (existing.billingType !== create.billingType)
      set("billingType", create.billingType, "billing_type");
    if (
      create.billingType === "recurring" &&
      (existing.billingPeriod !== create.billingPeriod ||
        (create.billingPeriod === "custom" &&
          (existing.recurringInterval !== create.recurringInterval ||
            existing.recurringIntervalCount !== create.recurringIntervalCount)))
    ) {
      set("billingPeriod", create.billingPeriod, "billing_period");
      if (create.billingPeriod === "custom") {
        update.recurringInterval = create.recurringInterval;
        update.recurringIntervalCount = create.recurringIntervalCount;
      }
    }
    if ((existing.trialPeriodDays ?? null) !== (create.trialPeriodDays ?? null))
      set("trialPeriodDays", create.trialPeriodDays ?? null, "trial_period_days");
    // A sent `metadata` replaces the stored one, so the merchant's keys go back with it.
    const stored = existing.metadata ?? {};
    if (Object.entries(create.metadata ?? {}).some(([k, v]) => stored[k] !== v))
      set("metadata", { ...stored, ...create.metadata }, "metadata");
    if (create.status === "archived" && existing.status !== "archived")
      set("status", "archived", "status");
    if (create.status !== "archived" && existing.status === "archived")
      item.warnings.push(
        issue("creem_product_archived", "The Creem product is archived; it stays archived."),
      );
    if (existing.taxCategory !== create.taxCategory)
      item.warnings.push(
        issue(
          "tax_category_not_updatable",
          `The tax category is ${existing.taxCategory} in Creem and ${create.taxCategory} from Paddle; the API cannot change it, so change it in the dashboard.`,
        ),
      );
    item.changes.push(...changes);
    if (item.adopted_from)
      // Adopting gives the product its key and makes the changes in one PATCH by id.
      productRequests.push({
        type: "adopt_product",
        key,
        request: { id: existing.id, updateProductRequestEntity: { externalId: key, ...update } },
      });
    else if (!changes.length) {
      item.action = "unchanged";
      item.status = null;
      continue;
    } else
      productRequests.push(
        clearsField(update)
          ? {
              type: "update_product",
              key,
              request: { id: existing.id, updateProductRequestEntity: update },
            }
          : {
              type: "upsert_product",
              key,
              request: {
                createProductRequestEntity: { ...(update as UpsertProductBody), externalId: key },
              },
            },
      );
    item.action = "update";
  }

  // ---- orphans: keyed Creem products this run doesn't migrate still sell
  const orphaned = (id: string) =>
    issue(
      "orphaned",
      `Creem product ${id} has this key and stays as it is, so it can still be sold. Archive it in Creem if it shouldn't be.`,
    );
  for (const item of productItems) {
    const stored = item.action === "skip" ? productsByKey.get(item.key) : undefined;
    if (!stored || item.adopted_from) continue;
    item.creem_id = stored.id;
    if (stored.status !== "archived") item.warnings.push(orphaned(stored.id));
  }
  const itemKeys = new Set(productItems.map((i) => i.key));
  if (!objects.catalogUnread)
    for (const product of creemCatalog.products) {
      const key = product.externalId ?? "";
      if (!PRICE_KEY.test(key) || itemKeys.has(key) || product.status === "archived") continue;
      productItems.push(
        newItem({
          kind: "product",
          key,
          name: product.name,
          source: { type: "price", id: key },
          action: "skip",
          creem_id: product.id,
          reason: issue("price_not_found", `Paddle has no price ${key}.`),
          warnings: [orphaned(product.id)],
        }),
      );
    }

  // A Creem product's key after this run: its own, or the one its adoption gives it.
  const keyOfProductId = new Map(
    creemCatalog.products.filter((p) => p.externalId).map((p) => [p.id, p.externalId as string]),
  );
  const adoptedIdOfKey = new Map<string, string>();
  for (const item of productItems)
    if (item.adopted_from) {
      keyOfProductId.set(item.adopted_from, item.key);
      adoptedIdOfKey.set(item.key, item.adopted_from);
    }
  const planned = new Map(
    specs.filter((s) => s.item.action !== "skip").map((s) => [s.key, s.create]),
  );

  // ---- product groups: two or more migrated recurring prices of one product
  for (const product of products) {
    const members = specs
      .filter((s) => s.product === product && planned.has(s.key))
      .map((s) => s.create)
      .filter((c) => c.billingType === "recurring" && c.status !== "archived")
      .sort((a, b) => periodDays(a) - periodDays(b) || a.price - b.price)
      .map((c) => c.externalId!);
    if (members.length < 2) continue;
    const key = product.id;
    const item = newItem({
      kind: "product_group",
      key,
      name: product.name,
      source: { type: "product", id: product.id },
      action: "create",
      status: "pending",
      members,
    });
    groupItems.push(item);
    const existing = groupsByKey.get(key);
    // A stored member this run adopts is named by its id: it stays in the group
    // whether its adoption works or not.
    const storedIds = new Set(existing?.products.map((p) => p.id));
    const list: ({ externalId: string } | { id: string })[] = members.map((externalId) => {
      const adopted = adoptedIdOfKey.get(externalId);
      return adopted && storedIds.has(adopted) ? { id: adopted } : { externalId };
    });
    if (existing) {
      item.creem_id = existing.id;
      // The members only grow: the API keeps no record of which members the
      // migrator added, so every other stored member stays after these, by id.
      const wanted = new Set(members);
      const keyOf = (p: { id: string; externalId?: string | null }) =>
        p.externalId ?? keyOfProductId.get(p.id) ?? null;
      const stored = existing.products.map(keyOf).filter((k) => k !== null && wanted.has(k));
      const others = existing.products.filter((p) => !wanted.has(keyOf(p) ?? ""));
      const kept = others.map(keyOf).filter((k): k is string => k !== null && PRICE_KEY.test(k));
      if (kept.length)
        item.warnings.push(
          issue(
            "group_product_kept",
            `Paddle doesn't group ${kept.join(", ")} with this product's prices. The migrator can't tell whether Paddle dropped them or you added them in Creem, so they stay in the group; remove them in Creem if they shouldn't be in it.`,
          ),
        );
      if (stored.length === members.length && stored.every((k, i) => k === members[i])) {
        item.action = "unchanged";
        item.status = null;
        continue;
      }
      list.push(...others.map((p) => ({ id: p.id })));
      item.action = "update";
      item.changes.push("products");
    }
    groupRequests.push({
      type: "upsert_product_group",
      key,
      request: {
        createProductGroupRequestEntity: existing
          ? { externalId: key, products: list }
          : { externalId: key, name: product.name, products: list },
      },
    });
  }

  adoption.finish();

  const items = [...productItems, ...groupItems];
  // The report's one currency: the one most migrated prices are in.
  const counts = { USD: 0, EUR: 0 };
  for (const create of planned.values()) counts[create.currency as "USD" | "EUR"] += 1;
  const report: MigrationReport = {
    schema: MIGRATION_REPORT_SCHEMA,
    version: MIGRATION_REPORT_VERSION,
    source: {
      provider: "paddle",
      store_id: objects.environment,
      store_name: `Paddle ${objects.environment}`,
      currency: counts.EUR > counts.USD ? "EUR" : "USD",
    },
    mode: "plan",
    summary: summarize(items),
    items,
    proposals,
    not_migrated: NOT_MIGRATED.map(([kind, message]) => ({
      kind,
      reason: issue("out_of_scope", message),
    })),
    fetch_failures: [],
  };
  return {
    requests: [...productRequests, ...groupRequests],
    report,
    answerErrors,
    productGroupOf: Object.fromEntries(
      creemCatalog.productGroups.flatMap((g) =>
        g.products.map((p) => [p.id, { id: g.id, externalId: g.externalId }]),
      ),
    ),
  };
}
