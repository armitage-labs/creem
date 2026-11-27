import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { harness } from "./helpers";
import { fakeCreem, productJson, type CreemState } from "./migrate-fixtures";
import { ACCOUNT_ID, ID, STRIPE_KEY, stripeDocs, stripeFetch } from "./migrate-stripe-fixtures";
import { fetchStripeCatalog, stripeClient } from "../src/lib/migration/stripe/source";
import { fromStripe } from "../src/lib/migration/stripe/map";
import { readCreemCatalog, type CreemCatalog } from "../src/lib/migration/catalog";
import type { MigrationRequest } from "../src/lib/migration/plan";
import { DryRunIgnoredError, checkMigration, executeMigration } from "../src/lib/migration/writer";
import { adoptionMatcher, type MigrationPlan } from "../src/lib/migration/plan";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
  migrationExitCode,
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

  it("redacts the supplied key and any Stripe key shape from a fetch failure", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/prices", 403, {
      error: {
        type: "invalid_request_error",
        message: `The provided key '${STRIPE_KEY}' does not have the required permissions.`,
      },
    });
    stripe.fail("/v1/products", 403, {
      error: {
        type: "invalid_request_error",
        message:
          "The provided key 'rk_live_51Ab…***…1234' on account acct_1Xyz does not have the required permissions.",
      },
    });
    const { failures } = await fetchStripeCatalog(
      stripeClient(STRIPE_KEY, { fetch: stripe.fetcher, maxNetworkRetries: 0 }),
      { secrets: [STRIPE_KEY] },
    );
    expect(failures.map((f) => f.kind)).toEqual(["products", "prices"]);
    for (const f of failures) {
      expect(f.message).toContain("permissions");
      expect(f.message).not.toMatch(/\b(rk|sk)_(live|test)_/);
      expect(f.message).not.toContain("1234");
    }
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
  });

  it("counts only the prices that map when naming, so a skipped or archived price renames nothing", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceUsageBase)?.name).toBe("eng2012-Usage plan");
    expect(productBody(p, ID.priceWeekly)?.name).toBe("eng2012-Cycles");
    const docs = stripeDocs();
    docs.prices.data = docs.prices.data.filter((price) => price.id !== ID.priceProYearly);
    const active = await plan(emptyCatalog, {}, structuredClone(docs));
    const all = await plan(emptyCatalog, { includeArchived: true }, structuredClone(docs));
    expect(productBody(active, ID.priceProMonthly)?.name).toBe("eng2012-Pro");
    expect(productBody(all, ID.priceProMonthly)?.name).toBe("eng2012-Pro");
    expect(productBody(all, ID.priceProLegacy)?.name).toBe("eng2012-Pro - Legacy monthly");
  });

  it("names a price without a nickname by its interval, and adds the currency when two names would be the same", async () => {
    const docs = stripeDocs();
    const monthly = docs.prices.data.find((price) => price.id === ID.priceProMonthly)!;
    monthly.nickname = null;
    docs.prices.data.push({
      ...structuredClone(monthly),
      id: "price_eng2012_pro_monthly_eur",
      currency: "eur",
      lookup_key: null,
    });
    const p = await plan(emptyCatalog, {}, docs);
    expect(productBody(p, ID.priceProMonthly)?.name).toBe("eng2012-Pro - Monthly (USD)");
    expect(productBody(p, "price_eng2012_pro_monthly_eur")?.name).toBe(
      "eng2012-Pro - Monthly (EUR)",
    );
    expect(productBody(p, "eng2012_pro_yearly")?.name).toBe("eng2012-Pro - Yearly");
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

  it("fails both prices when one's lookup key is the other's id, and writes neither", async () => {
    const docs = stripeDocs();
    const ebook = docs.prices.data.find((price) => price.id === ID.priceEbook)!;
    ebook.lookup_key = ID.priceSeats;
    const p = await plan(emptyCatalog, {}, docs);
    const colliding = p.report.items.filter((i) => i.key === ID.priceSeats);
    expect(colliding.map((i) => i.source.id).sort()).toEqual([ID.priceEbook, ID.priceSeats].sort());
    for (const i of colliding) {
      expect(i).toMatchObject({ action: "skip", status: "failed", creem_id: null });
      expect(i.error).toMatchObject({ code: "key_collision", status: null });
      expect(i.error?.message).toContain(ID.priceEbook);
      expect(i.error?.message).toContain(ID.priceSeats);
    }
    expect(p.requests.filter((r) => r.key === ID.priceSeats)).toEqual([]);
    expect(p.report.summary.failed).toBe(2);
    expect(migrationExitCode(p.report)).toBe(8);
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

/**
 * The shipped report contract (`creem.migration_report` v1, `report.ts`): the
 * exact keys and their types, checked at runtime against what the command prints.
 */
function assertReportSchema(report: any) {
  const keys = (o: any) => Object.keys(o).sort();
  const issueOk = (i: any) =>
    i === null || (keys(i).join() === "code,message" && typeof i.code === "string");
  expect(keys(report)).toEqual([
    "fetch_failures",
    "items",
    "mode",
    "not_migrated",
    "proposals",
    "schema",
    "source",
    "summary",
    "version",
  ]);
  expect(report.schema).toBe("creem.migration_report");
  expect(report.version).toBe(1);
  expect(["plan", "dry_run", "run"]).toContain(report.mode);
  expect(keys(report.source)).toEqual(["currency", "provider", "store_id", "store_name"]);
  expect(keys(report.summary)).toEqual([
    "create",
    "failed",
    "skip",
    "unchanged",
    "update",
    "warnings",
  ]);
  for (const item of report.items) {
    const allowed = [
      "action",
      "adopted_from",
      "changes",
      "creem_id",
      "error",
      "key",
      "kind",
      "name",
      "reason",
      "source",
      "status",
      "warnings",
    ];
    expect(keys(item).filter((k) => !["members", "features"].includes(k))).toEqual(allowed);
    expect(["meter", "product", "product_group", "discount", "file"]).toContain(item.kind);
    expect(["create", "update", "unchanged", "skip"]).toContain(item.action);
    expect([null, "pending", "done", "failed"]).toContain(item.status);
    expect(item.key).toMatch(KEY);
    expect(issueOk(item.reason)).toBe(true);
    for (const w of item.warnings) expect(issueOk(w)).toBe(true);
    if (item.error) expect(keys(item.error)).toEqual(["code", "hint", "message", "status"]);
    expect(Array.isArray(item.changes)).toBe(true);
  }
  for (const p of report.proposals) {
    expect(keys(p)).toEqual(["candidates", "creem_id", "decision", "id", "key", "kind", "name"]);
    expect(["pending", "accepted", "declined"]).toContain(p.decision);
    for (const c of p.candidates)
      expect(keys(c)).toEqual(["creem_id", "creem_name", "differences"]);
  }
  for (const n of report.not_migrated) {
    expect(keys(n)).toEqual(["kind", "reason"]);
    expect(issueOk(n.reason)).toBe(true);
  }
  for (const f of report.fetch_failures) expect(keys(f)).toEqual(["kind", "message"]);
}

describe("the migration report", () => {
  it("the golden report has the shipped schema", () => {
    assertReportSchema(JSON.parse(readFileSync(join(GOLDEN, "empty-store.report.json"), "utf8")));
  });
});

describe("the writer with a Stripe plan", () => {
  it("aborts when a dry run comes back without write_result.dry_run, and writes nothing more", async () => {
    const creem = fakeCreem();
    const checked = await checkMigration(creem.client, await plan());
    creem.ignoreDryRun = true;
    const run = executeMigration(creem.client, checked, { files: {}, delayMs: 0 });
    await expect(run).rejects.toBeInstanceOf(DryRunIgnoredError);
    const error = await run.catch((e) => e);
    // The ignored dry run wrote the first meter; nothing after it was sent.
    expect(creem.writes()).toEqual([]);
    expect(creem.dryRuns()).toHaveLength(1);
    expect(error.report.items.filter((i: MigrationItem) => i.status === "failed")).toHaveLength(1);
  });

  it("waits as long as Retry-After says after a 429", async () => {
    const creem = fakeCreem();
    let once = false;
    creem.fail(
      (c) => c.method === "POST" && c.path === "/v1/meters" && !c.dryRun && !once && (once = true),
      429,
      { code: "rate_limited", message: "Slow down" },
      { "retry-after": "3" },
    );
    const sleep = vi.fn(async () => {});
    const checked = await checkMigration(creem.client, await plan());
    const report = await executeMigration(creem.client, checked, { files: {}, delayMs: 0, sleep });
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(report.summary.failed).toBe(0);
  });
});

describe("creem migrate stripe", () => {
  const base = ["migrate", "stripe", "--stripe-key", STRIPE_KEY];
  function setup(
    options: {
      isTTY?: boolean;
      confirm?: (message: string) => Promise<boolean>;
      state?: Partial<CreemState>;
      docs?: ReturnType<typeof stripeDocs>;
    } = {},
  ) {
    const stripe = stripeFetch(options.docs);
    vi.stubGlobal("fetch", stripe.fetcher);
    const creem = fakeCreem(options.state);
    const confirm = vi.fn(options.confirm ?? (async () => false));
    const h = harness(creem.client, { isTTY: options.isTTY ?? false, confirm });
    return { stripe, creem, h, confirm };
  }
  afterEach(() => vi.unstubAllEnvs());

  it("fails before any prompt or fetch without --yes or a key outside a terminal", async () => {
    vi.stubEnv("STRIPE_API_KEY", "");
    const { h, stripe } = setup();
    expect((await h.run(["migrate", "stripe", "--stripe-key", STRIPE_KEY])).code).toBe(2);
    const noKey = await h.run(["--json", "migrate", "stripe"]);
    expect(noKey.code).toBe(2);
    expect(JSON.parse(noKey.stderr).error.message).toContain("--stripe-key");
    expect(stripe.fetcher).not.toHaveBeenCalled();
  });

  it("--json without --yes prints the plan as a versioned report and writes nothing", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    assertReportSchema(report);
    expect(report).toMatchObject({ mode: "plan", source: { provider: "stripe" } });
    expect(report.summary).toMatchObject({ create: 8, skip: 9, failed: 0 });
    expect(creem.validations()).toHaveLength(1);
    expect(creem.writes()).toEqual([]);
  });

  it("takes the key from STRIPE_API_KEY", async () => {
    vi.stubEnv("STRIPE_API_KEY", STRIPE_KEY);
    const { h, stripe } = setup();
    const r = await h.run(["--json", "migrate", "stripe"]);
    expect(r.code, r.stderr).toBe(0);
    expect(stripe.requests[0].authorization).toBe(`Bearer ${STRIPE_KEY}`);
  });

  it("--yes checks with validate, then writes meters and products, each after its dry run; a second run writes nothing", async () => {
    const { creem, h } = setup();
    const first = await h.run(["--json", ...base, "--yes"]);
    expect(first.code, first.stderr).toBe(0);
    const report = JSON.parse(first.stdout);
    assertReportSchema(report);
    expect(report.mode).toBe("run");
    expect(report.summary).toMatchObject({ create: 8, failed: 0 });
    const firstWrite = creem.calls.findIndex(
      (c) => c.method !== "GET" && !c.dryRun && c.path !== "/v1/catalog/validate",
    );
    expect(creem.calls.findIndex((c) => c.path === "/v1/catalog/validate")).toBeLessThan(
      firstWrite,
    );
    expect(creem.writes().map((c) => c.path)).toEqual([
      "/v1/meters",
      "/v1/meters",
      ...Array(6).fill("/v1/products"),
    ]);
    for (const write of creem.writes()) {
      const index = creem.calls.indexOf(write);
      expect(creem.calls[index - 1]).toMatchObject({
        path: write.path,
        dryRun: true,
        body: write.body,
      });
    }
    expect(creem.state.meters).toHaveLength(2);
    expect(creem.state.products).toHaveLength(6);

    const writes = creem.writes().length;
    const second = await h.run(["--json", ...base, "--yes"]);
    expect(second.code, second.stderr).toBe(0);
    const again = JSON.parse(second.stdout);
    expect(again.summary).toMatchObject({ create: 0, update: 0, unchanged: 8 });
    expect(creem.writes()).toHaveLength(writes);
  });

  it("never sends the Stripe key to Creem, nor prints it", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(JSON.stringify(creem.calls)).not.toContain(STRIPE_KEY);
    expect(r.stdout + r.stderr).not.toContain(STRIPE_KEY);
    const plain = await h.run([...base, "--dry-run"]);
    expect(plain.stdout + plain.stderr).not.toContain(STRIPE_KEY);
  });

  it("--include-archived writes inactive prices and products archived", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", ...base, "--yes", "--include-archived"]);
    expect(r.code, r.stderr).toBe(0);
    const archived = creem.state.products.filter((p) => p.status === "archived");
    expect(archived.map((p) => p.external_id).sort()).toEqual(
      [ID.priceOld, ID.priceProLegacy].sort(),
    );
  });

  it("stops before the first write while a proposal is unanswered, even with --yes (exit 7)", async () => {
    const { creem, h } = setup({
      state: { products: [productJson("prod_1", { name: "eng2012-Ebook" })] },
    });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(7);
    expect(JSON.parse(r.stdout).proposals[0]).toMatchObject({
      key: ID.priceEbook,
      decision: "pending",
    });
    expect(creem.writes()).toEqual([]);
  });

  it("--adopt gives the confirmed match its key with a PATCH first", async () => {
    const { creem, h } = setup({
      state: { products: [productJson("prod_1", { name: "eng2012-Ebook" })] },
    });
    const r = await h.run(["--json", ...base, "--yes", "--adopt", `${ID.priceEbook}=prod_1`]);
    expect(r.code, r.stderr).toBe(0);
    expect(creem.writes()[0]).toMatchObject({ method: "PATCH", path: "/v1/products/prod_1" });
    expect(creem.state.products.find((p) => p.id === "prod_1")?.external_id).toBe(ID.priceEbook);
    expect(creem.state.products).toHaveLength(6);
  });

  it("--create-new-unmatched creates new products instead of adopting", async () => {
    const { creem, h } = setup({
      state: { products: [productJson("prod_1", { name: "eng2012-Ebook" })] },
    });
    const r = await h.run(["--json", ...base, "--yes", "--create-new-unmatched"]);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).proposals[0].decision).toBe("declined");
    expect(creem.state.products.find((p) => p.id === "prod_1")?.external_id).toBeNull();
    expect(creem.state.products).toHaveLength(7);
  });

  it("bare --adopt with --create-new-unmatched adopts single matches and creates new only for the rest", async () => {
    const { creem, h } = setup({
      state: {
        products: [
          productJson("prod_1", { name: "eng2012-Ebook" }),
          productJson("prod_2", { name: "eng2012-Donation" }),
          productJson("prod_3", { name: "eng2012-Donation" }),
        ],
      },
    });
    const r = await h.run(["--json", ...base, "--yes", "--adopt", "--create-new-unmatched"]);
    expect(r.code, r.stderr).toBe(0);
    const proposals = JSON.parse(r.stdout).proposals;
    expect(proposals.find((p: any) => p.key === ID.priceEbook)).toMatchObject({
      decision: "accepted",
      creem_id: "prod_1",
    });
    expect(proposals.find((p: any) => p.key === ID.priceDonation)).toMatchObject({
      decision: "declined",
    });
    expect(creem.state.products.find((p) => p.id === "prod_1")?.external_id).toBe(ID.priceEbook);
    expect(creem.state.products.filter((p) => p.external_id === ID.priceEbook)).toHaveLength(1);
    expect(creem.state.products.find((p) => p.id === "prod_2")?.external_id).toBeNull();
    expect(creem.state.products.find((p) => p.id === "prod_3")?.external_id).toBeNull();
    expect(creem.state.products.filter((p) => p.external_id === ID.priceDonation)).toHaveLength(1);
  });

  it("asks per proposal in a terminal, and never adopts without a yes", async () => {
    const asked: string[] = [];
    const { creem, h } = setup({
      isTTY: true,
      state: { products: [productJson("prod_1", { name: "eng2012-Ebook" })] },
      confirm: async (message) => {
        asked.push(message);
        return message.startsWith("TEST: Write");
      },
    });
    const r = await h.run(base);
    expect(r.code, r.stderr).toBe(0);
    expect(asked[0]).toContain("Adopt Creem product prod_1");
    expect(creem.state.products.find((p) => p.id === "prod_1")?.external_id).toBeNull();
  });

  it("--dry-run prints the plan and writes nothing", async () => {
    const { creem, h } = setup();
    const r = await h.run([...base, "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("Plan: Stripe");
    expect(r.stdout).toContain("Meters");
    expect(r.stdout).toContain("Dry run");
    expect(creem.writes()).toEqual([]);
  });

  it("exits 3 when Stripe refuses the key", async () => {
    const { h, stripe } = setup();
    stripe.fail("/v1/account", 401, {
      error: {
        type: "invalid_request_error",
        message: "Invalid API Key provided: rk_test_****0000",
      },
    });
    const r = await h.run(["--json", ...base]);
    expect(r.code).toBe(3);
    expect(r.stderr).not.toContain(STRIPE_KEY);
  });

  it("exits 5 when the connection to Stripe drops in the middle of the read", async () => {
    const { h, creem, stripe } = setup();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/v1/prices")) throw new TypeError("fetch failed");
      return stripe.fetcher(input, init);
    });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code, r.stderr).toBe(5);
    expect(creem.writes()).toEqual([]);
  }, 30_000);

  it("refuses to write when a Stripe list could not be read (exit 4)", async () => {
    const { h, creem, stripe } = setup();
    stripe.fail("/v1/billing/meters", 403, {
      error: {
        type: "invalid_request_error",
        message: "The provided key does not have the required permissions.",
      },
    });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(4);
    expect(JSON.parse(r.stdout).fetch_failures).toEqual([
      { kind: "meters", message: expect.stringContaining("permissions") },
    ]);
    expect(creem.writes()).toEqual([]);
  });

  it("prints a fetch failure without the key, in the report and in the text plan", async () => {
    const { h, stripe } = setup();
    stripe.fail("/v1/prices", 403, {
      error: {
        type: "invalid_request_error",
        message: `The provided key '${STRIPE_KEY}' does not have the required permissions.`,
      },
    });
    const json = await h.run(["--json", ...base]);
    expect(json.code).toBe(4);
    const plain = await h.run([...base, "--dry-run"]);
    expect(plain.code).toBe(4);
    for (const out of [json.stdout + json.stderr, plain.stdout + plain.stderr]) {
      expect(out).toContain("permissions");
      expect(out).not.toContain(STRIPE_KEY);
      expect(out).not.toMatch(/\b(rk|sk)_(live|test)_/);
    }
  });

  it("stops before any write on a key collision (exit 8), and says the item failed, not that Creem refused it", async () => {
    const docs = stripeDocs();
    docs.prices.data.find((price) => price.id === ID.priceEbook)!.lookup_key = ID.priceSeats;
    const { creem, h } = setup({ docs });
    const r = await h.run([...base, "--yes"]);
    expect(r.code).toBe(8);
    expect(r.stdout).toMatch(new RegExp(`${ID.priceSeats} .* FAILED`));
    expect(r.stdout).not.toContain("REFUSED by Creem");
    expect(r.stderr).not.toContain("Creem's check refused");
    expect(r.stderr).toContain(ID.priceSeats);
    expect(creem.writes()).toEqual([]);
  });

  it("is listed in creem migrate --help, and says customers are not migrated", async () => {
    const { h } = setup();
    expect((await h.run(["migrate", "--help"])).stdout).toContain("creem migrate stripe");
    const r = await h.run([...base, "--dry-run"]);
    expect(r.stdout).toMatch(/customers.*not migrated/i);
  });
});
