import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeCreem, productJson, type CreemState } from "./migrate-fixtures";
import { ACCOUNT_ID, ID, STRIPE_KEY, stripeDocs, stripeFetch } from "./migrate-stripe-fixtures";
import { fetchStripeCatalog, stripeClient } from "../src/lib/migration/stripe/source";
import { fromStripe } from "../src/lib/migration/stripe/map";
import { readCreemCatalog, type CreemCatalog } from "../src/lib/migration/catalog";
import type { MigrationRequest } from "../src/lib/migration/plan";
import { checkMigration, executeMigration } from "../src/lib/migration/writer";
import { adoptionMatcher, type MigrationPlan } from "../src/lib/migration/plan";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
  newItem,
  summarize,
  type MigrationItem,
} from "../src/lib/migration/report";

afterEach(() => vi.unstubAllGlobals());

const meterJson = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  store_id: "sto_1",
  name: "API calls",
  event_name: "api_call",
  aggregation: "sum",
  aggregation_property: "calls",
  filter: { conjunction: "and", clauses: [] },
  unit_label: "call",
  status: "active",
  external_id: null,
  locked: false,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  ...fields,
});

function planOf(items: MigrationItem[], requests: MigrationPlan["requests"]): MigrationPlan {
  return {
    requests,
    answerErrors: [],
    productGroupOf: {},
    report: {
      schema: MIGRATION_REPORT_SCHEMA,
      version: MIGRATION_REPORT_VERSION,
      source: { provider: "test", store_id: "s", store_name: "S", currency: "USD" },
      mode: "plan",
      summary: summarize(items),
      items,
      proposals: [],
      not_migrated: [],
      fetch_failures: [],
    },
  };
}

describe("shared layer: adopting a meter", () => {
  it("proposes an unkeyed meter with the same name, and adopts it only when answered", () => {
    const meters = [
      { id: "mtr_1", externalId: null, name: "API  Calls" },
      { id: "mtr_2", externalId: "other", name: "API calls" },
    ];
    const item = newItem({
      kind: "meter",
      key: "mtr_stripe",
      name: "api calls",
      source: { type: "meter", id: "mtr_stripe" },
      action: "skip",
    });
    const pending = adoptionMatcher({});
    const unanswered = pending.match(
      "meter",
      "mtr_stripe",
      new Map(),
      meters,
      meters,
      () => [],
      item,
    );
    expect(unanswered.pending?.map((m) => m.id)).toEqual(["mtr_1"]);
    expect(pending.proposals).toMatchObject([{ id: "adopt:mtr_stripe", kind: "meter" }]);
    expect(pending.unconfirmed("meter", "mtr_stripe", unanswered.pending!).message).toContain(
      "Creem meter mtr_1",
    );

    const answered = adoptionMatcher({ "adopt:mtr_stripe": "mtr_1" });
    const adopted = { ...item, changes: [] };
    expect(
      answered.match("meter", "mtr_stripe", new Map(), meters, meters, () => [], adopted).existing
        ?.id,
    ).toBe("mtr_1");
    expect(adopted.adopted_from).toBe("mtr_1");
    expect(answered.proposals[0]).toMatchObject({ decision: "accepted", creem_id: "mtr_1" });
  });

  it("checks the adoption PATCH with validate (by id), then sends it as a dry run and for real", async () => {
    const creem = fakeCreem({ meters: [meterJson("mtr_1")] });
    const item = newItem({
      kind: "meter",
      key: "mtr_stripe",
      name: "API calls",
      source: { type: "meter", id: "mtr_stripe" },
      action: "update",
      status: "pending",
      creem_id: "mtr_1",
      adopted_from: "mtr_1",
      changes: ["external_id"],
    });
    const plan = planOf(
      [item],
      [
        {
          type: "adopt_meter",
          key: "mtr_stripe",
          request: {
            id: "mtr_1",
            updateMeterApiRequestDto: { externalId: "mtr_stripe", name: "API calls" },
          },
        },
      ],
    );
    const checked = await checkMigration(creem.client, plan);
    expect(checked.report.items[0]).toMatchObject({ status: "pending", action: "update" });
    expect(creem.validations()[0].body).toEqual({
      items: [
        { kind: "meter", id: "mtr_1", body: { external_id: "mtr_stripe", name: "API calls" } },
      ],
    });
    expect(creem.writes()).toEqual([]);

    const report = await executeMigration(creem.client, checked, { files: {}, delayMs: 0 });
    expect(report.items[0]).toMatchObject({ status: "done", creem_id: "mtr_1" });
    const patches = creem.calls.filter((c) => c.method === "PATCH");
    expect(patches.map((c) => [c.path, c.dryRun ?? false])).toEqual([
      ["/v1/meters/mtr_1", true],
      ["/v1/meters/mtr_1", false],
    ]);
    expect(creem.state.meters[0].external_id).toBe("mtr_stripe");
  });
});

async function stripeObjects(
  options: {
    includeArchived?: boolean;
    pageSize?: number;
    docs?: ReturnType<typeof stripeDocs>;
  } = {},
) {
  const stripe = stripeFetch(options.docs, { pageSize: options.pageSize });
  const client = stripeClient(STRIPE_KEY, { fetch: stripe.fetcher });
  return {
    ...(await fetchStripeCatalog(client, { includeArchived: options.includeArchived })),
    stripe,
  };
}
const paths = (requests: { url: string }[]) => requests.map((r) => new URL(r.url).pathname);

describe("Stripe source", () => {
  it("reads the account, active products and prices, active meters and webhook endpoints with GETs only", async () => {
    const { objects, failures, stripe } = await stripeObjects();
    expect(failures).toEqual([]);
    expect(objects.account).toEqual({ id: ACCOUNT_ID, name: "eng2012 sandbox", currency: "EUR" });
    expect(objects.products.map((p) => p.id)).not.toContain(ID.productOld);
    expect(objects.products).toHaveLength(10);
    expect(objects.prices.map((p) => p.id)).not.toContain(ID.priceProLegacy);
    expect(objects.prices.map((p) => p.id)).toContain(ID.priceOld);
    expect(objects.prices.find((p) => p.id === ID.priceUkGbp)?.currency_options).toHaveProperty(
      "usd",
    );
    expect(objects.meters.map((m) => m.id)).toEqual(
      expect.arrayContaining([ID.meterCalls, ID.meterUsers, ID.meterStorage]),
    );
    expect(objects.webhookEndpoints).toBe(0);
    expect(new Set(paths(stripe.requests))).toEqual(
      new Set([
        "/v1/account",
        "/v1/products",
        "/v1/prices",
        "/v1/billing/meters",
        "/v1/webhook_endpoints",
      ]),
    );
    for (const r of stripe.requests) {
      expect(new URL(r.url).hostname).toBe("api.stripe.com");
      expect(r.authorization).toBe(`Bearer ${STRIPE_KEY}`);
    }
    const query = (path: string) =>
      new URL(stripe.requests.find((r) => new URL(r.url).pathname === path)!.url).searchParams;
    expect(query("/v1/products").get("active")).toBe("true");
    expect(query("/v1/prices").get("active")).toBe("true");
    expect(query("/v1/billing/meters").get("status")).toBe("active");
  });

  it("reads inactive products and prices too with includeArchived", async () => {
    const { objects } = await stripeObjects({ includeArchived: true });
    expect(objects.products.map((p) => p.id)).toContain(ID.productOld);
    expect(objects.prices.map((p) => p.id)).toContain(ID.priceProLegacy);
    expect(objects.prices).toHaveLength(15);
  });

  it("reads every page of a list", async () => {
    const { objects, stripe } = await stripeObjects({ pageSize: 4 });
    expect(objects.prices).toHaveLength(14);
    expect(paths(stripe.requests).filter((p) => p === "/v1/prices")).toHaveLength(4);
  });

  it("lists webhook endpoints as unknown when the key may not read them", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/webhook_endpoints", 403, {
      error: {
        type: "invalid_request_error",
        code: "secret_key_required",
        message: "The provided key does not have the required permissions.",
      },
    });
    const { objects, failures } = await fetchStripeCatalog(
      stripeClient(STRIPE_KEY, { fetch: stripe.fetcher }),
    );
    expect(failures).toEqual([]);
    expect(objects.webhookEndpoints).toBeNull();
  });

  it("reports a list it couldn't read as a fetch failure, without the key", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/prices", 403, {
      error: {
        type: "invalid_request_error",
        message: `The provided key '${STRIPE_KEY.slice(0, 12)}***' does not have the required permissions for this endpoint.`,
      },
    });
    const { failures } = await fetchStripeCatalog(
      stripeClient(STRIPE_KEY, { fetch: stripe.fetcher, maxNetworkRetries: 0 }),
    );
    expect(failures).toEqual([{ kind: "prices", message: expect.stringContaining("permissions") }]);
    expect(JSON.stringify(failures)).not.toContain(STRIPE_KEY);
  });

  it("throws the authentication error of a refused key", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/account", 401, {
      error: {
        type: "invalid_request_error",
        message: "Invalid API Key provided: rk_test_****0000",
      },
    });
    await expect(
      fetchStripeCatalog(stripeClient(STRIPE_KEY, { fetch: stripe.fetcher })),
    ).rejects.toMatchObject({ type: "StripeAuthenticationError" });
  });
});

const GOLDEN = join(__dirname, "fixtures", "stripe", "golden");
const KEY = /^[A-Za-z0-9_.:-]{1,255}$/;
const emptyCatalog: CreemCatalog = { products: [], productGroups: [], discounts: [], meters: [] };

async function plan(
  catalog: CreemCatalog = emptyCatalog,
  options: Parameters<typeof fromStripe>[2] = {},
  docs = stripeDocs(),
) {
  const { objects } = await stripeObjects({ includeArchived: options.includeArchived, docs });
  return fromStripe(objects, catalog, options);
}
const item = (p: Pick<MigrationPlan, "report">, key: string, kind?: string) =>
  p.report.items.find((i) => i.key === key && (!kind || i.kind === kind))!;
const request = (p: MigrationPlan, key: string, type?: MigrationRequest["type"]) =>
  p.requests.find((r) => r.key === key && (!type || r.type === type))!;
const productBody = (p: MigrationPlan, key: string) => {
  const r = request(p, key, "upsert_product");
  return r?.type === "upsert_product" ? r.request.createProductRequestEntity : undefined;
};

describe("fromStripe against an empty Creem store", () => {
  it("matches the golden requests and report", async () => {
    const p = await plan();
    await expect(JSON.stringify(p.requests, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.requests.json"),
    );
    await expect(JSON.stringify(p.report, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.report.json"),
    );
  });

  it("is pure: the same input gives the same plan, and the input is not changed", async () => {
    const { objects } = await stripeObjects();
    const frozen = structuredClone(objects);
    const deepFreeze = (o: any): any => {
      for (const v of Object.values(o)) if (v && typeof v === "object") deepFreeze(v);
      return Object.freeze(o);
    };
    deepFreeze(objects);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const a = fromStripe(objects, emptyCatalog);
    expect(fromStripe(objects, emptyCatalog)).toEqual(a);
    expect(objects).toEqual(frozen);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("puts every fetched Stripe object in an item or in not_migrated", async () => {
    const { objects } = await stripeObjects();
    const p = fromStripe(objects, emptyCatalog);
    const sources = new Set(p.report.items.flatMap((i) => [i.source.id, i.source.product_id]));
    for (const o of [...objects.products, ...objects.prices, ...objects.meters])
      expect(sources.has(o.id), o.id).toBe(true);
    expect(p.report.not_migrated.map((n) => n.kind)).toEqual(
      expect.arrayContaining(["customers", "subscriptions", "coupons", "webhooks"]),
    );
  });

  it("keys a price by its lookup key when Creem takes it, else by its id; never by a name", async () => {
    const p = await plan();
    expect(item(p, "eng2012_pro_yearly")).toMatchObject({
      source: { type: "price", id: ID.priceProYearly, product_id: ID.productPro },
    });
    expect(productBody(p, "eng2012_pro_yearly")?.metadata).not.toHaveProperty("stripe_lookup_key");
    const monthly = item(p, ID.priceProMonthly);
    expect(productBody(p, ID.priceProMonthly)?.metadata).toMatchObject({
      stripe_lookup_key: "Pro Monthly 2024",
    });
    expect(monthly.warnings).toContainEqual({
      code: "lookup_key_replaced",
      message: expect.stringContaining('"Pro Monthly 2024"'),
    });
    const ids = new Set<string>([ID.priceProMonthly, ...Object.values(ID), "eng2012_pro_yearly"]);
    for (const i of p.report.items) {
      expect(i.key).toMatch(KEY);
      expect(ids.has(i.key), i.key).toBe(true);
    }
  });

  it("maps a sum meter with its payload key, and takes the unit label from the product of its metered price", async () => {
    const p = await plan();
    expect(request(p, ID.meterCalls)).toEqual({
      type: "upsert_meter",
      key: ID.meterCalls,
      request: {
        createMeterApiRequestDto: {
          externalId: ID.meterCalls,
          name: "eng2012 API calls",
          eventName: "eng2012_api_call",
          aggregation: "sum",
          aggregationProperty: "calls",
          unitLabel: "API call",
        },
      },
    });
    expect(item(p, ID.meterCalls).warnings).toEqual([]);
  });

  it("maps a count meter, with the event name as unit label and a warning when no product names one", async () => {
    const p = await plan();
    const r = request(p, ID.meterUsers);
    expect(r.type === "upsert_meter" && r.request.createMeterApiRequestDto).toEqual({
      externalId: ID.meterUsers,
      name: "eng2012 Active users",
      eventName: "eng2012_active_user",
      aggregation: "count",
      unitLabel: "eng2012_active_user",
    });
    expect(item(p, ID.meterUsers).warnings.map((w) => w.code)).toEqual([
      "unit_label_from_event_name",
    ]);
  });

  it("skips a `last` meter", async () => {
    const p = await plan();
    expect(item(p, ID.meterStorage)).toMatchObject({
      kind: "meter",
      action: "skip",
      reason: { code: "aggregation_unsupported" },
    });
    expect(request(p, ID.meterStorage)).toBeUndefined();
  });

  it("maps monthly and yearly prices of one product to two products named by their nickname", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceProMonthly)).toMatchObject({
      externalId: ID.priceProMonthly,
      name: "eng2012-Pro - Monthly",
      description: "All features for growing teams.",
      price: 2900,
      currency: "USD",
      billingType: "recurring",
      billingPeriod: "every-month",
    });
    expect(productBody(p, "eng2012_pro_yearly")).toMatchObject({
      name: "eng2012-Pro - Yearly",
      price: 29000,
      billingPeriod: "every-year",
    });
  });

  it("names a product of one price by the product alone, and one without a nickname by its interval", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceEbook)).toMatchObject({
      name: "eng2012-Ebook",
      description: "eng2012-Ebook",
      price: 900,
      currency: "EUR",
      billingType: "onetime",
    });
    expect(productBody(p, ID.priceUsageBase)?.name).toBe("eng2012-Usage plan - Monthly");
  });

  it("sends the Stripe product's and price's metadata with the migrator's own keys", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceProMonthly)?.metadata).toEqual({
      eng2012_seed: "pro-monthly",
      tier: "pro",
      plan: "pro-monthly",
      stripe_product_id: ID.productPro,
      stripe_price_id: ID.priceProMonthly,
      stripe_lookup_key: "Pro Monthly 2024",
    });
  });

  it("maps a weekly price to a custom billing period, and skips one Creem can't bill", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceWeekly)).toMatchObject({
      name: "eng2012-Cycles - Weekly",
      billingPeriod: "custom",
      recurringInterval: "week",
      recurringIntervalCount: 1,
    });
    expect(item(p, ID.priceLong)).toMatchObject({
      name: "eng2012-Cycles - Every 400 days",
      action: "skip",
      reason: { code: "billing_interval_unsupported" },
    });
  });

  it("maps a one-time custom amount to pay what you want and drops the maximum with a warning", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceDonation)).toMatchObject({
      price: 500,
      payWhatYouWant: true,
      suggestedPrice: 1500,
      billingType: "onetime",
    });
    expect(item(p, ID.priceDonation).warnings).toEqual([
      { code: "pwyw_maximum_dropped", message: expect.stringContaining("10000") },
    ]);
  });

  it("skips a metered price on a meter, and still migrates the meter and the product's licensed price", async () => {
    const p = await plan();
    expect(item(p, ID.priceUsageMetered)).toMatchObject({
      action: "skip",
      source: { type: "price", id: ID.priceUsageMetered, product_id: ID.productUsage },
      reason: { code: "usage_price_without_base_price" },
    });
    expect(item(p, ID.priceMeteredOnly).reason?.code).toBe("usage_price_without_base_price");
    expect(item(p, ID.meterCalls).action).toBe("create");
    expect(item(p, ID.priceUsageBase).action).toBe("create");
  });

  it("skips a legacy metered price, a tiered price and a transform_quantity price", async () => {
    const p = await plan();
    expect(item(p, ID.priceLegacyUsage).reason?.code).toBe("legacy_metered_usage");
    expect(item(p, ID.priceTiered).reason?.code).toBe("tiered_pricing");
    expect(item(p, ID.priceSeats).reason?.code).toBe("transform_quantity");
  });

  it("skips a GBP price and names its USD and EUR currency options as a hint", async () => {
    const p = await plan();
    const gbp = item(p, ID.priceUkGbp);
    expect(gbp.reason?.code).toBe("currency_unsupported");
    expect(gbp.reason?.message).toContain("GBP");
    expect(gbp.reason?.message).toContain("USD 1900");
    expect(gbp.reason?.message).toContain("EUR 1700");
  });

  it("lists webhook endpoints once as not catalog data, and coupons once for v2", async () => {
    const p = await plan();
    expect(p.report.not_migrated).toContainEqual({
      kind: "webhooks",
      reason: { code: "not_catalog", message: expect.stringContaining("webhook") },
    });
    expect(p.report.not_migrated).toContainEqual({
      kind: "coupons",
      reason: { code: "not_yet_supported", message: expect.stringContaining("v2") },
    });
    expect(p.report.source).toEqual({
      provider: "stripe",
      store_id: ACCOUNT_ID,
      store_name: "eng2012 sandbox",
      currency: "EUR",
    });
  });

  it("skips an active price of an archived product, unless archived objects are included", async () => {
    const p = await plan();
    expect(item(p, ID.priceOld)).toMatchObject({
      action: "skip",
      reason: { code: "archived" },
    });
    expect(p.report.items.map((i) => i.key)).not.toContain(ID.priceProLegacy);
  });

  it("writes inactive prices and products as archived products with --include-archived", async () => {
    const p = await plan(emptyCatalog, { includeArchived: true });
    expect(productBody(p, ID.priceOld)).toMatchObject({
      name: "eng2012-Old plan",
      status: "archived",
    });
    expect(productBody(p, ID.priceProLegacy)).toMatchObject({
      name: "eng2012-Pro - Legacy monthly",
      price: 1900,
      status: "archived",
    });
    expect(productBody(p, ID.priceProMonthly)).not.toHaveProperty("status");
  });

  it("reports a product without a price", async () => {
    const docs = stripeDocs();
    docs.prices.data = docs.prices.data.filter((x) => x.product !== ID.productEbook);
    const p = await plan(emptyCatalog, {}, docs);
    expect(item(p, ID.productEbook)).toMatchObject({
      kind: "product",
      source: { type: "product", id: ID.productEbook },
      action: "skip",
      reason: { code: "no_price" },
    });
  });
});

const catalogOf = (state: Partial<CreemState>) =>
  readCreemCatalog(fakeCreem(state).client, { meters: true });

describe("fromStripe against a store with Creem objects", () => {
  it("updates a product that already has the key, keeping the merchant's metadata", async () => {
    const catalog = await catalogOf({
      products: [
        productJson("prod_1", {
          name: "Pro yearly",
          external_id: "eng2012_pro_yearly",
          billing_type: "recurring",
          billing_period: "every-year",
          metadata: { crm: "42", tier: "old" },
        }),
      ],
    });
    const p = await plan(catalog);
    expect(item(p, "eng2012_pro_yearly")).toMatchObject({
      action: "update",
      status: "pending",
      creem_id: "prod_1",
      adopted_from: null,
    });
    expect(p.report.proposals).toEqual([]);
    expect(productBody(p, "eng2012_pro_yearly")?.metadata).toEqual({
      crm: "42",
      tier: "pro",
      eng2012_seed: "pro-yearly",
      stripe_product_id: ID.productPro,
      stripe_price_id: ID.priceProYearly,
    });
  });

  it("proposes an unkeyed Creem product with the same name and writes nothing for it until answered", async () => {
    const catalog = await catalogOf({
      products: [productJson("prod_1", { name: "ENG2012-ebook " })],
    });
    const p = await plan(catalog);
    expect(p.report.proposals).toEqual([
      {
        id: `adopt:${ID.priceEbook}`,
        kind: "product",
        key: ID.priceEbook,
        name: "eng2012-Ebook",
        candidates: [
          {
            creem_id: "prod_1",
            creem_name: "ENG2012-ebook ",
            differences: ["price 1000 (Stripe: 900)"],
          },
        ],
        decision: "pending",
        creem_id: null,
      },
    ]);
    expect(item(p, ID.priceEbook)).toMatchObject({
      action: "skip",
      creem_id: "prod_1",
      reason: { code: "adoption_unconfirmed" },
    });
    expect(p.requests.filter((r) => r.key === ID.priceEbook)).toEqual([]);
  });

  it("adopts a confirmed match with a PATCH that gives it the key, written first", async () => {
    const catalog = await catalogOf({
      products: [productJson("prod_1", { name: "eng2012-Ebook" })],
    });
    const p = await plan(catalog, { adoption: { [`adopt:${ID.priceEbook}`]: "prod_1" } });
    expect(p.requests[0]).toMatchObject({
      type: "adopt_product",
      key: ID.priceEbook,
      request: {
        id: "prod_1",
        updateProductRequestEntity: { externalId: ID.priceEbook, price: 900 },
      },
    });
    expect(p.requests.slice(1, 3).map((r) => r.type)).toEqual(["upsert_meter", "upsert_meter"]);
    expect(item(p, ID.priceEbook)).toMatchObject({ action: "update", adopted_from: "prod_1" });
    expect(p.report.proposals[0]).toMatchObject({ decision: "accepted", creem_id: "prod_1" });
  });

  it("creates new products for unanswered proposals with createNewUnmatched", async () => {
    const catalog = await catalogOf({
      products: [productJson("prod_1", { name: "eng2012-Ebook" })],
    });
    const p = await plan(catalog, { createNewUnmatched: true });
    expect(p.report.proposals[0]).toMatchObject({ decision: "declined", creem_id: null });
    expect(item(p, ID.priceEbook)).toMatchObject({ action: "create", adopted_from: null });
    expect(p.answerErrors).toEqual([]);
  });

  it("proposes an unkeyed Creem meter with the same name, and adopts it with a meter PATCH", async () => {
    const meter = {
      id: "mtr_1",
      store_id: "sto_1",
      name: "eng2012 api calls",
      event_name: "api_call",
      aggregation: "sum",
      aggregation_property: "value",
      filter: { conjunction: "and", clauses: [] },
      unit_label: "call",
      status: "active",
      external_id: null,
      locked: false,
      created_at: "2026-11-01T00:00:00.000Z",
      updated_at: "2026-11-01T00:00:00.000Z",
    };
    const catalog = await catalogOf({ meters: [meter] });
    const pending = await plan(catalog);
    expect(pending.report.proposals).toMatchObject([
      {
        kind: "meter",
        key: ID.meterCalls,
        candidates: [
          {
            creem_id: "mtr_1",
            differences: [
              "event name api_call (Stripe: eng2012_api_call)",
              "aggregation property value (Stripe: calls)",
              "unit label call (Stripe: API call)",
            ],
          },
        ],
      },
    ]);
    expect(item(pending, ID.meterCalls).reason?.code).toBe("adoption_unconfirmed");
    const adopted = await plan(catalog, { adoption: { [`adopt:${ID.meterCalls}`]: "mtr_1" } });
    expect(adopted.requests[0]).toEqual({
      type: "adopt_meter",
      key: ID.meterCalls,
      request: {
        id: "mtr_1",
        updateMeterApiRequestDto: {
          externalId: ID.meterCalls,
          name: "eng2012 API calls",
          aggregation: "sum",
          aggregationProperty: "calls",
        },
      },
    });
    expect(item(adopted, ID.meterCalls)).toMatchObject({
      action: "update",
      creem_id: "mtr_1",
      adopted_from: "mtr_1",
    });
  });

  it("rejects an --adopt answer for a key the run doesn't migrate", async () => {
    const p = await plan(emptyCatalog, { adoption: { "adopt:nope": "prod_1" } });
    expect(p.answerErrors.map((e) => e.code)).toEqual(["adoption_answer_invalid"]);
  });
});
