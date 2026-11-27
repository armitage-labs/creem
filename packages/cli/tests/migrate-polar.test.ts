import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { harness } from "./helpers";
import { fakeCreem, productJson } from "./migrate-fixtures";
import { ID, POLAR_ORG_ID, POLAR_TOKEN, polarDocs, polarFetch } from "./migrate-polar-fixtures";
import { readCreemCatalog } from "../src/lib/migration/catalog";
import { checkMigration, executeMigration } from "../src/lib/migration/writer";
import { PolarClient, fetchPolarCatalog } from "../src/lib/migration/polar/source";
import { fromPolar } from "../src/lib/migration/polar/map";
import type { MigrationPlan, MigrationRequest } from "../src/lib/migration/plan";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const GOLDEN = join(__dirname, "fixtures", "polar", "golden");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const emptyCatalog = { products: [], productGroups: [], discounts: [], meters: [] };
afterEach(() => vi.unstubAllGlobals());

async function polarObjects(docs = polarDocs(), options: { pageSize?: number } = {}) {
  const polar = polarFetch(docs, options);
  const client = new PolarClient(POLAR_TOKEN, { server: "sandbox", fetch: polar.fetcher });
  return { ...(await fetchPolarCatalog(client)), polar };
}
async function plan(catalog = emptyCatalog, options: Parameters<typeof fromPolar>[2] = {}) {
  const { objects } = await polarObjects();
  return fromPolar(objects, catalog, { now: NOW, ...options });
}
const item = (p: Pick<MigrationPlan, "report">, key: string, kind?: string) =>
  p.report.items.find((i) => i.key === key && (!kind || i.kind === kind))!;
const request = (p: MigrationPlan, key: string, type?: MigrationRequest["type"]) =>
  p.requests.find((r) => r.key === key && (!type || r.type === type))!;
const productBody = (p: MigrationPlan, key: string) => {
  const r = request(p, key, "upsert_product");
  return r.type === "upsert_product" ? r.request.createProductRequestEntity : undefined;
};

async function migrate(
  creem: ReturnType<typeof fakeCreem>,
  options: { adoption?: Record<string, string>; force?: boolean; includeArchived?: boolean } = {},
) {
  const { objects } = await polarObjects();
  const catalog = await readCreemCatalog(creem.client, { meters: true });
  const planned = fromPolar(objects, catalog, {
    now: NOW,
    adoption: options.adoption,
    includeArchived: options.includeArchived,
  });
  const checked = planned.answerErrors.length
    ? planned
    : await checkMigration(creem.client, planned);
  if (checked.report.items.some((i) => i.status === "failed") && !options.force)
    return { plan: planned, checked, report: undefined };
  const report = await executeMigration(creem.client, checked, {
    files: {},
    delayMs: 0,
    force: options.force,
  });
  return { plan: planned, checked, report };
}

describe("Polar source", () => {
  it("reads the organization's products and meters with GETs only, and never customers or orders", async () => {
    const { objects, failures, polar } = await polarObjects();
    expect(failures).toEqual([]);
    expect(objects.organization.id).toBe(POLAR_ORG_ID);
    expect(objects.products).toHaveLength(19);
    expect(objects.meters.map((m) => m.id)).toContain(ID.meterApiCalls);
    expect(objects.discounts).toHaveLength(5);
    for (const r of polar.requests) {
      expect(new URL(r.url).hostname).toBe("sandbox-api.polar.sh");
      expect(r.authorization).toBe(`Bearer ${POLAR_TOKEN}`);
    }
    expect(polar.requests.map((r) => new URL(r.url).pathname)).toEqual(
      expect.arrayContaining([
        "/v1/organizations/",
        "/v1/products/",
        "/v1/meters/",
        "/v1/discounts/",
      ]),
    );
  });

  it("reads every page of a list", async () => {
    const { objects, polar } = await polarObjects(polarDocs(), { pageSize: 4 });
    expect(objects.products).toHaveLength(19);
    expect(polar.requests.filter((r) => r.url.includes("/v1/products/"))).toHaveLength(5);
  });

  it("uses api.polar.sh for the production server", async () => {
    const polar = polarFetch();
    await fetchPolarCatalog(new PolarClient(POLAR_TOKEN, { fetch: polar.fetcher }));
    expect(new Set(polar.requests.map((r) => new URL(r.url).hostname))).toEqual(
      new Set(["api.polar.sh"]),
    );
  });

  it("reports a list it couldn't read as a fetch failure, without the token", async () => {
    const polar = polarFetch();
    polar.fail("/v1/meters");
    const client = new PolarClient(POLAR_TOKEN, {
      server: "sandbox",
      fetch: polar.fetcher,
      delayMs: 0,
    });
    const { failures } = await fetchPolarCatalog(client);
    expect(failures).toEqual([{ kind: "meters", message: expect.stringContaining("500") }]);
    expect(JSON.stringify(failures)).not.toContain(POLAR_TOKEN);
  });
});

describe("fromPolar against an empty Creem store", () => {
  it("matches the golden requests and report", async () => {
    const p = await plan();
    await expect(JSON.stringify(p.requests, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.requests.json"),
    );
    await expect(JSON.stringify(p.report, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.report.json"),
    );
  });

  it("keys every object by its Polar id, never by a name", async () => {
    const p = await plan();
    const { objects } = await polarObjects();
    const ids = new Set<string>([
      ...objects.meters.map((m) => m.id),
      ...objects.discounts.map((d) => d.id),
      ...objects.products.flatMap((pr) => [
        pr.id,
        ...pr.prices.map((x) => x.id),
        ...pr.benefits.map((b) => b.id),
      ]),
    ]);
    for (const r of p.requests) expect(ids.has(r.key), r.key).toBe(true);
    for (const i of p.report.items) expect(i.key).toMatch(UUID);
    const body = JSON.stringify(p.requests);
    for (const [, key] of body.matchAll(/"(?:externalId|meterExternalId)":"([^"]+)"/g))
      expect(ids.has(key), key).toBe(true);
  });

  it("maps a meter's top-level `name eq` clause to its event name and the other clauses to Creem's operators", async () => {
    const p = await plan();
    expect(request(p, ID.meterApiCalls)).toEqual({
      type: "upsert_meter",
      key: ID.meterApiCalls,
      request: {
        createMeterApiRequestDto: {
          externalId: ID.meterApiCalls,
          name: "API calls",
          eventName: "api.call",
          aggregation: "count",
          filter: {
            conjunction: "and",
            clauses: [{ property: "tier", operator: "not_equals", value: "free" }],
          },
          unitLabel: "API calls",
        },
      },
    });
    expect(item(p, ID.meterApiCalls).warnings.map((w) => w.code)).toEqual(["unit_label_from_name"]);
  });

  it("uses a meter's custom unit label and maps its aggregation property", async () => {
    const p = await plan();
    const r = request(p, ID.meterImages);
    expect(r.type === "upsert_meter" && r.request.createMeterApiRequestDto).toEqual({
      externalId: ID.meterImages,
      name: "Image generations",
      eventName: "image.generated",
      aggregation: "sum",
      aggregationProperty: "images",
      unitLabel: "image",
    });
    expect(item(p, ID.meterImages).warnings).toEqual([]);
  });

  it("skips a meter without a `name eq` clause, and one with a nested filter", async () => {
    const p = await plan();
    expect(item(p, ID.meterStorage)).toMatchObject({
      kind: "meter",
      action: "skip",
      reason: { code: "meter_filter_unsupported" },
    });
    expect(item(p, ID.meterNested)).toMatchObject({
      action: "skip",
      reason: { code: "meter_filter_unsupported" },
    });
    expect(p.requests.some((r) => r.key === ID.meterStorage || r.key === ID.meterNested)).toBe(
      false,
    );
  });

  it("maps a fixed and a metered price to a product with a postpaid usage price on the meter", async () => {
    const p = await plan();
    expect(productBody(p, ID.productUsage)).toMatchObject({
      externalId: ID.productUsage,
      name: "Pro with usage",
      price: 2000,
      currency: "USD",
      billingType: "recurring",
      billingPeriod: "every-month",
      usagePrices: [
        {
          meterExternalId: ID.meterApiCalls,
          unitPrice: 0.5,
          cap: 10000,
          settlementMode: "postpaid",
        },
      ],
    });
  });

  it("skips a product with only metered prices", async () => {
    const p = await plan();
    expect(item(p, ID.productMeteredOnly)).toMatchObject({
      action: "skip",
      reason: { code: "usage_price_without_base_price" },
    });
  });

  it("maps pay what you want: one-time keeps it, a subscription gets its minimum as a fixed price", async () => {
    const p = await plan();
    expect(productBody(p, ID.productPwyw)).toMatchObject({
      price: 500,
      billingType: "onetime",
      payWhatYouWant: true,
      suggestedPrice: 1500,
    });
    expect(productBody(p, ID.productPwywRecurring)).toMatchObject({
      price: 1000,
      billingType: "recurring",
    });
    expect(productBody(p, ID.productPwywRecurring)?.payWhatYouWant).toBeUndefined();
    expect(item(p, ID.productPwywRecurring).warnings.map((w) => w.code)).toContain(
      "pwyw_recurring_unsupported",
    );
  });

  it("skips a seat-based product", async () => {
    const p = await plan();
    expect(item(p, ID.productSeats).reason?.code).toBe("seat_pricing_unsupported");
  });

  it("maps free prices to a free one-time product and skips a free subscription", async () => {
    const p = await plan();
    expect(productBody(p, ID.productFree)).toMatchObject({ price: 0, billingType: "onetime" });
    expect(productBody(p, ID.productLegacyFree)).toMatchObject({
      price: 0,
      billingType: "onetime",
    });
    expect(item(p, ID.productFreeRecurring).reason?.code).toBe("free_recurring_unsupported");
  });

  it("maps billing intervals and a trial in days", async () => {
    const p = await plan();
    expect(productBody(p, ID.productYearly)).toMatchObject({
      billingPeriod: "every-year",
      trialPeriodDays: 14,
    });
    expect(productBody(p, ID.productQuarterly)).toMatchObject({
      billingPeriod: "every-three-months",
    });
  });

  it("migrates one currency per product: USD or EUR, the organization's default first", async () => {
    const p = await plan();
    expect(productBody(p, ID.productEur)).toMatchObject({ price: 2000, currency: "USD" });
    expect(item(p, ID.productEur).warnings.map((w) => w.code)).toContain(
      "currency_prices_not_migrated",
    );
    expect(productBody(p, ID.productGbp)).toMatchObject({ price: 2000, currency: "USD" });
    expect(item(p, ID.productPoundOnly).reason?.code).toBe("currency_unsupported");
  });

  it("makes one product per price of a legacy product, and a product group keyed by the product", async () => {
    const p = await plan();
    expect(productBody(p, ID.priceLegacyMonthly)).toMatchObject({
      name: "Legacy Pro - Monthly",
      price: 1000,
      billingPeriod: "every-month",
    });
    expect(productBody(p, ID.priceLegacyYearly)).toMatchObject({
      name: "Legacy Pro - Yearly",
      price: 10000,
      billingPeriod: "every-year",
    });
    expect(item(p, ID.priceLegacyMonthly).source).toEqual({
      type: "price",
      id: ID.priceLegacyMonthly,
      product_id: ID.productLegacy,
    });
    expect(request(p, ID.productLegacy, "upsert_product_group")).toEqual({
      type: "upsert_product_group",
      key: ID.productLegacy,
      request: {
        createProductGroupRequestEntity: {
          externalId: ID.productLegacy,
          name: "Legacy Pro",
          products: [{ externalId: ID.priceLegacyMonthly }, { externalId: ID.priceLegacyYearly }],
        },
      },
    });
    expect(item(p, ID.productLegacy, "product_group").members).toEqual([
      ID.priceLegacyMonthly,
      ID.priceLegacyYearly,
    ]);
  });

  it("maps license-key, note and credit benefits to features keyed by the benefit id", async () => {
    const p = await plan();
    expect(productBody(p, ID.productLicense)?.features).toEqual([
      {
        type: "licenseKey",
        externalId: ID.benefitLicense,
        description: "License key",
        licenseKey: { activationLimit: 3, expiry: { interval: "year", intervalCount: 1 } },
      },
      {
        type: "custom",
        externalId: ID.benefitNote,
        description: "Private community",
        privateNote: "Join the community at https://example.com/community",
      },
    ]);
    const warnings = item(p, ID.productLicense).warnings;
    expect(warnings.map((w) => w.code)).toEqual([
      "license_key_settings_not_migrated",
      "benefit_unsupported",
    ]);
    expect(warnings[0].message).toContain("prefix");
    expect(item(p, ID.productLicense).features).toEqual([ID.benefitLicense, ID.benefitNote]);
    expect(productBody(p, ID.productCredits)?.features).toEqual([
      {
        type: "customerCredits",
        externalId: ID.benefitCredit,
        description: "1,000 image credits",
        customerCredits: {
          amount: "1000",
          unitLabel: "image",
          bucketName: "image",
          resetsEachPeriod: true,
        },
      },
    ]);
    expect(item(p, ID.productCredits).warnings.map((w) => w.code)).toContain(
      "credits_not_spent_by_postpaid",
    );
  });

  it("lists Discord, GitHub and other benefits per product as unsupported", async () => {
    const p = await plan();
    const community = item(p, ID.productCommunity);
    expect(community.action).toBe("create");
    expect(community.warnings.filter((w) => w.code === "benefit_unsupported")).toHaveLength(2);
    expect(productBody(p, ID.productCommunity)?.features).toBeUndefined();
  });

  it("skips archived products, or writes them archived with includeArchived", async () => {
    expect(item(await plan(), ID.productArchived).reason?.code).toBe("archived");
    const p = await plan(emptyCatalog, { includeArchived: true });
    expect(productBody(p, ID.productArchived)).toMatchObject({ status: "archived" });
  });

  it("maps a percentage discount to every migrated product, and says so", async () => {
    const p = await plan();
    const r = request(p, ID.discountPercentage);
    expect(r.type).toBe("upsert_discount");
    const body = r.type === "upsert_discount" ? r.request.createDiscountRequestEntity : undefined;
    const migrated = p.report.items
      .filter((i) => i.kind === "product" && i.action === "create")
      .map((i) => i.key);
    expect(body).toEqual({
      externalId: ID.discountPercentage,
      name: "Launch 25%",
      code: "SAVE25",
      type: "percentage",
      percentage: 25,
      duration: "once",
      appliesToProductExternalIds: migrated,
    });
    expect(item(p, ID.discountPercentage)).toMatchObject({
      kind: "discount",
      name: "SAVE25",
      warnings: [{ code: "applies_to_migrated_products" }],
    });
  });

  it("maps a fixed discount with its duration, redemption limit and end date", async () => {
    const p = await plan();
    const r = request(p, ID.discountFixed);
    expect(r.type === "upsert_discount" && r.request.createDiscountRequestEntity).toMatchObject({
      code: "FIVEOFF",
      type: "fixed",
      amount: 500,
      currency: "USD",
      duration: "repeating",
      durationInMonths: 3,
      maxRedemptions: 100,
      expiryDate: new Date("2027-12-31T23:59:59Z"),
    });
  });

  it("limits a discount to its migrated products, and skips one that starts later or has no code", async () => {
    const p = await plan();
    const r = request(p, ID.discountOneProduct);
    expect(
      r.type === "upsert_discount" &&
        r.request.createDiscountRequestEntity.appliesToProductExternalIds,
    ).toEqual([ID.productLicense]);
    expect(item(p, ID.discountOneProduct).warnings).toEqual([]);
    expect(item(p, ID.discountNextMonth)).toMatchObject({
      action: "skip",
      reason: { code: "start_date_unsupported" },
    });
    expect(item(p, ID.discountNoCode).reason?.code).toBe("discount_code_missing");
  });

  it("lists every fetched Polar object in the report, and what isn't catalog once", async () => {
    const p = await plan();
    const { objects } = await polarObjects();
    const keys = new Set(p.report.items.map((i) => i.key));
    for (const m of objects.meters) expect(keys.has(m.id), m.name).toBe(true);
    for (const d of objects.discounts) expect(keys.has(d.id), d.name).toBe(true);
    for (const pr of objects.products)
      expect(
        keys.has(pr.id) || p.report.items.some((i) => i.source.product_id === pr.id),
        pr.name,
      ).toBe(true);
    expect(p.report.not_migrated.map((n) => n.kind)).toEqual([
      "customers",
      "subscriptions",
      "orders",
      "license_keys",
      "checkout_links",
      "webhooks",
      "benefits",
    ]);
    expect(p.report.source).toEqual({
      provider: "polar",
      store_id: POLAR_ORG_ID,
      store_name: "Polar sandbox",
      currency: "USD",
    });
  });
});

describe("Polar migration against Creem", () => {
  it("validates meters and products together before the first write, then writes meters, products and groups", async () => {
    const creem = fakeCreem();
    const { report } = await migrate(creem);
    expect(report!.summary.failed).toBe(0);
    const first = creem.calls.findIndex(
      (c) => c.method === "POST" && !c.dryRun && c.path !== "/v1/catalog/validate",
    );
    const validate = creem.calls.findIndex((c) => c.path === "/v1/catalog/validate");
    expect(validate).toBeGreaterThanOrEqual(0);
    expect(validate).toBeLessThan(first);
    const kinds = creem.validations()[0].body!.items.map((i: { kind: string }) => i.kind);
    expect(kinds.slice(0, 2)).toEqual(["meter", "meter"]);
    expect(kinds).toContain("product");
    const order = creem.writes().map((c) => c.path);
    expect(order.lastIndexOf("/v1/meters")).toBeLessThan(order.indexOf("/v1/products"));
    expect(order.lastIndexOf("/v1/products")).toBeLessThan(order.indexOf("/v1/product-groups"));
    expect(order.lastIndexOf("/v1/product-groups")).toBeLessThan(order.indexOf("/v1/discounts"));
    expect(creem.state.discounts.map((d) => d.code).sort()).toEqual([
      "FIVEOFF",
      "LICENSE10",
      "SAVE25",
    ]);
    expect(creem.state.meters).toHaveLength(2);
    const usage = creem.state.products.find((pr) => pr.external_id === ID.productUsage)!;
    expect(usage.usage_prices).toEqual([
      expect.objectContaining({ meter_id: creem.state.meters[0].id, settlement_mode: "postpaid" }),
    ]);
  });

  it("dry-runs every write right before it is sent", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const calls = creem.calls.filter(
      (c) => c.method !== "GET" && c.path !== "/v1/catalog/validate",
    );
    calls.forEach((call, index) => {
      if (call.dryRun) return;
      expect(calls[index - 1]).toMatchObject({ path: call.path, body: call.body, dryRun: true });
    });
  });

  it("finds everything on a second run: every item unchanged and nothing written", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const writes = creem.writes().length;
    const { checked } = await migrate(creem);
    const planned = checked.report.items.filter((i) => i.action !== "skip");
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((i) => i.action === "unchanged")).toBe(true);
    expect(creem.writes()).toHaveLength(writes);
  });

  it("fails a product with a metered price on a store without postpaid usage billing, and writes none of it", async () => {
    const creem = fakeCreem({}, { postpaidUsageBilling: false });
    const { checked, report } = await migrate(creem);
    expect(report).toBeUndefined();
    expect(item(checked, ID.productUsage)).toMatchObject({
      status: "failed",
      error: {
        code: "postpaid_usage_billing_unavailable",
        status: 422,
        hint: "Ask Creem support to enable postpaid usage billing, then run the migration again.",
      },
    });
    expect(creem.writes()).toEqual([]);
    const forced = await migrate(creem, { force: true });
    expect(item({ report: forced.report! }, ID.productUsage).status).toBe("failed");
    expect(creem.writes().some((c) => c.body?.external_id === ID.productUsage)).toBe(false);
    expect(creem.state.products.some((pr) => pr.external_id === ID.productUsage)).toBe(false);
    expect(creem.state.products.some((pr) => pr.external_id === ID.productLicense)).toBe(true);
  });

  it("proposes adopting an unkeyed Creem product with the same name, and PATCHes its key when accepted", async () => {
    const creem = fakeCreem({
      products: [
        productJson("prod_1", { name: "Desktop app license", price: 4900, currency: "USD" }),
      ],
    });
    const pending = await migrate(creem);
    expect(pending.plan.report.proposals).toMatchObject([
      {
        id: `adopt:${ID.productLicense}`,
        decision: "pending",
        candidates: [{ creem_id: "prod_1" }],
      },
    ]);
    expect(item(pending.plan, ID.productLicense).reason?.code).toBe("adoption_unconfirmed");
    const accepted = await migrate(creem, {
      adoption: { [`adopt:${ID.productLicense}`]: "prod_1" },
    });
    expect(item({ report: accepted.report! }, ID.productLicense)).toMatchObject({
      adopted_from: "prod_1",
      status: "done",
    });
    expect(creem.writes()).toContainEqual(
      expect.objectContaining({
        method: "PATCH",
        path: "/v1/products/prod_1",
        body: expect.objectContaining({ external_id: ID.productLicense }),
      }),
    );
  });

  it("proposes adopting an unkeyed Creem discount with the same code", async () => {
    const creem = fakeCreem({
      discounts: [
        {
          id: "disc_1",
          object: "discount",
          mode: "test",
          status: "active",
          name: "Old launch code",
          code: "SAVE25",
          type: "percentage",
          percentage: 25,
          duration: "once",
          applies_to_products: [],
          redeem_count: 0,
          external_id: null,
        },
      ],
    });
    const { plan: planned } = await migrate(creem);
    expect(planned.report.proposals).toContainEqual(
      expect.objectContaining({
        id: `adopt:${ID.discountPercentage}`,
        kind: "discount",
        candidates: [expect.objectContaining({ creem_id: "disc_1" })],
      }),
    );
    expect(item(planned, ID.discountPercentage).reason?.code).toBe("adoption_unconfirmed");
  });

  it("keeps the merchant's own features and usage prices of the types it writes", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const license = creem.state.products.find((pr) => pr.external_id === ID.productLicense)!;
    license.features.push({
      id: "feat_own",
      type: "licenseKey",
      description: "Merchant's own key",
      external_id: null,
      license_key: { activation_limit: 1, expiry: null },
    });
    license.name = "Renamed in Creem";
    await migrate(creem);
    const after = creem.state.products.find((pr) => pr.external_id === ID.productLicense)!;
    expect(after.name).toBe("Desktop app license");
    expect(after.features.map((f: { id: string }) => f.id)).toContain("feat_own");
  });

  it("fails a product whose meter failed in the run, and goes on", async () => {
    const creem = fakeCreem();
    creem.refuse(ID.meterApiCalls, 409, "meter_name_taken");
    const { checked } = await migrate(creem);
    expect(item(checked, ID.meterApiCalls).status).toBe("failed");
    const forced = await migrate(creem, { force: true });
    expect(item({ report: forced.report! }, ID.productUsage).status).toBe("failed");
    expect(item({ report: forced.report! }, ID.productLicense).status).toBe("done");
  });
});

describe("creem migrate polar", () => {
  const base = ["migrate", "polar", "--polar-token", POLAR_TOKEN, "--polar-server", "sandbox"];
  function setup(options: { isTTY?: boolean } = {}) {
    const polar = polarFetch();
    vi.stubGlobal("fetch", polar.fetcher);
    const creem = fakeCreem();
    const h = harness(creem.client, { isTTY: options.isTTY ?? false });
    return { polar, creem, h };
  }

  it("fails before any fetch without a token or approval", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("POLAR_ACCESS_TOKEN", "");
    const h = harness();
    expect((await h.run(["migrate", "polar"])).code).toBe(2);
    const noToken = await h.run(["migrate", "polar", "--json"]);
    expect(noToken.code).toBe(2);
    expect(JSON.parse(noToken.stderr).error.message).toContain("--polar-token");
    expect(
      (
        await h.run([
          "migrate",
          "polar",
          "--json",
          "--polar-token",
          "x",
          "--polar-server",
          "staging",
        ])
      ).code,
    ).toBe(2);
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("--json prints the plan as a versioned report and writes nothing", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report).toMatchObject({
      schema: "creem.migration_report",
      version: 1,
      mode: "plan",
      source: { provider: "polar", store_id: POLAR_ORG_ID },
    });
    expect(creem.writes()).toEqual([]);
  });

  it("reads the token from POLAR_ACCESS_TOKEN, and never sends it to Creem", async () => {
    const { creem, h, polar } = setup();
    vi.stubEnv("POLAR_ACCESS_TOKEN", POLAR_TOKEN);
    const r = await h.run(["--json", "migrate", "polar", "--polar-server", "sandbox", "--yes"]);
    vi.unstubAllEnvs();
    expect(r.code, r.stderr).toBe(0);
    expect(polar.requests.length).toBeGreaterThan(0);
    expect(JSON.stringify(creem.calls)).not.toContain(POLAR_TOKEN);
    expect(r.stdout + r.stderr).not.toContain(POLAR_TOKEN);
  });

  it("--yes runs the plan, and a second run writes nothing", async () => {
    const { creem, h } = setup();
    const first = await h.run(["--json", ...base, "--yes"]);
    expect(first.code, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({ mode: "run", summary: { failed: 0 } });
    const writes = creem.writes().length;
    const second = await h.run(["--json", ...base, "--yes"]);
    expect(second.code, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).summary).toMatchObject({ create: 0, update: 0 });
    expect(creem.writes()).toHaveLength(writes);
  });

  it("prints the plan with meters and says what isn't migrated", async () => {
    const { h } = setup();
    const r = await h.run([...base, "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("Polar → Creem");
    expect(r.stdout).toContain("Meters");
    expect(r.stdout).toContain(ID.meterApiCalls);
    expect(r.stdout).toContain("Not migrated: customers");
  });
});
