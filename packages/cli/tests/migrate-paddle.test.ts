import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PADDLE_KEY, paddleDocs, paddleFetch } from "./migrate-paddle-fixtures";
import { PaddleClient, fetchPaddleCatalog } from "../src/lib/migration/paddle/source";
import { fromPaddle, type PaddleObjects } from "../src/lib/migration/paddle/map";
import type { CreemCatalog } from "../src/lib/migration/catalog";

/** ENG-2015: `creem migrate paddle` (Paddle Billing). */
const NOW = new Date("2026-11-27T12:00:00.000Z");
const GOLDEN = join(__dirname, "fixtures", "paddle", "golden");
const emptyCatalog: CreemCatalog = { products: [], productGroups: [], discounts: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

// Paddle object ids of the fixtures.
const PRO = "pro_01m8ee91jy96wpy0q79wta9sd6";
const PRO_MONTHLY = "pri_01m8ee91rdx3xn32adc9jtmj9v";
const PRO_YEARLY = "pri_01m8ee91x0ae559fkyjp35acdy";
const PRO_LEGACY = "pri_01m8ee921negj532fmzd2f86pf";
const HANDBOOK = "pri_01m8ee9817hnw5txebjqdmqkyp";
const GLOBAL = "pri_01m8ee98cbpwhw599qn9fprbk9";
const UK = "pri_01m8ee98pzmr61d6jhdtzr8rmw";
const WEEKLY = "pri_01m8ee9916eq0x1r4ycpnvdrpb";
const CLOUD_MONTHLY = "pri_01hw000000000000000cloudm";
const CLOUD_FIVE_YEARS = "pri_01hw000000000000000clouds";
const CLOUD_CUSTOM = "pri_01hw000000000000000cloudc";
const EBOOK_ONCE = "pri_01hw000000000000000ebook1";
const EBOOK_MONTHLY = "pri_01hw000000000000000ebook2";
const EBOOKS = "pro_01hw0000000000000000ebook1";
const OLD_MONTHLY = "pri_01hw00000000000000000old1";

async function paddleObjects(
  options: { docs?: ReturnType<typeof paddleDocs>; pageSize?: number } = {},
) {
  const paddle = paddleFetch(options.docs, { pageSize: options.pageSize });
  const client = new PaddleClient(PADDLE_KEY, {
    environment: "sandbox",
    fetch: paddle.fetcher,
    delayMs: 0,
  });
  const result = await fetchPaddleCatalog(client);
  return { ...result, paddle };
}

type Plan = ReturnType<typeof fromPaddle>;
const item = (p: Plan, key: string) => p.report.items.find((i) => i.key === key)!;
const request = (p: Plan, key: string) => p.requests.find((r) => r.key === key);

async function plan(options: { includeArchived?: boolean; catalog?: CreemCatalog } = {}) {
  const { objects } = await paddleObjects();
  return fromPaddle(objects, options.catalog ?? emptyCatalog, {
    now: NOW,
    includeArchived: options.includeArchived,
  });
}

describe("Paddle source", () => {
  it("reads products and prices, active and archived, with GETs on the sandbox host only", async () => {
    const { objects, failures, paddle } = await paddleObjects({ pageSize: 2 });
    expect(failures).toEqual([]);
    expect(objects.environment).toBe("sandbox");
    expect(objects.products).toHaveLength(8);
    expect(objects.prices).toHaveLength(13);
    expect(new Set(paddle.requests.map((r) => r.host))).toEqual(
      new Set(["sandbox-api.paddle.com"]),
    );
    expect(new Set(paddle.requests.map((r) => r.path))).toEqual(new Set(["/products", "/prices"]));
    for (const r of paddle.requests) {
      expect(r.authorization).toBe(`Bearer ${PADDLE_KEY}`);
      expect(r.search.getAll("status").join(",")).toBe("active,archived");
    }
    // The cursor of `meta.pagination.next` until `has_more` is false.
    expect(paddle.requests.filter((r) => r.path === "/prices")).toHaveLength(7);
  });

  it("reads production from api.paddle.com", async () => {
    const paddle = paddleFetch();
    const client = new PaddleClient("pdl_live_apikey_x", {
      environment: "production",
      fetch: paddle.fetcher,
      delayMs: 0,
    });
    await fetchPaddleCatalog(client);
    expect(new Set(paddle.requests.map((r) => r.host))).toEqual(new Set(["api.paddle.com"]));
  });

  it("reports a list it can't read as a fetch failure, without the key", async () => {
    const paddle = paddleFetch(undefined, { failures: { "/prices": 500 } });
    const client = new PaddleClient(PADDLE_KEY, {
      environment: "sandbox",
      fetch: paddle.fetcher,
      delayMs: 0,
      attempts: 1,
    });
    const { objects, failures } = await fetchPaddleCatalog(client);
    expect(failures).toEqual([{ kind: "prices", message: expect.stringContaining("500") }]);
    expect(JSON.stringify(failures)).not.toContain(PADDLE_KEY);
    expect(objects.catalogUnread).toBe(true);
    expect(objects.products).toHaveLength(8);
  });

  it("throws on a refused key, so the command exits with the auth code", async () => {
    const paddle = paddleFetch(undefined, { failures: { "/products": 403 } });
    const client = new PaddleClient(PADDLE_KEY, {
      environment: "sandbox",
      fetch: paddle.fetcher,
      delayMs: 0,
    });
    await expect(fetchPaddleCatalog(client)).rejects.toMatchObject({ status: 403 });
  });
});

describe("fromPaddle: products and product groups", () => {
  it("is pure: it reads only its arguments and leaves them as they are", async () => {
    const { objects } = await paddleObjects();
    const copy: PaddleObjects = structuredClone(objects);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const a = fromPaddle(objects, emptyCatalog, { now: NOW });
    const b = fromPaddle(objects, emptyCatalog, { now: NOW });
    expect(a).toEqual(b);
    expect(objects).toEqual(copy);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("matches the golden requests and report", async () => {
    const p = await plan();
    await expect(JSON.stringify(p.requests, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.requests.json"),
    );
    await expect(JSON.stringify(p.report, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.report.json"),
    );
  });

  it("keys each USD or EUR price as one product by its Paddle id, named product + price description when the product has several", async () => {
    const p = await plan();
    expect(request(p, PRO_MONTHLY)).toEqual({
      type: "upsert_product",
      key: PRO_MONTHLY,
      request: {
        createProductRequestEntity: {
          name: "eng2015-Pro - Monthly",
          description: "The Pro plan, monthly or yearly.",
          price: 1500,
          currency: "USD",
          billingType: "recurring",
          billingPeriod: "every-month",
          trialPeriodDays: 14,
          taxCategory: "digital-goods-service",
          metadata: { seats: 5, tier: "pro", plan: "pro-monthly" },
          externalId: PRO_MONTHLY,
        },
      },
    });
    expect(request(p, PRO_YEARLY)!.request).toMatchObject({
      createProductRequestEntity: {
        name: "eng2015-Pro - Yearly",
        price: 15000,
        billingPeriod: "every-year",
      },
    });
    // One price: the product's name alone; no description: the name.
    expect(request(p, WEEKLY)!.request).toEqual({
      createProductRequestEntity: {
        name: "eng2015-Weekly",
        description: "eng2015-Weekly",
        price: 500,
        currency: "USD",
        billingType: "recurring",
        billingPeriod: "custom",
        recurringInterval: "week",
        recurringIntervalCount: 1,
        taxCategory: "digital-goods-service",
        externalId: WEEKLY,
      },
    });
    expect(request(p, HANDBOOK)!.request).toMatchObject({
      createProductRequestEntity: {
        name: "eng2015-Handbook",
        price: 2900,
        currency: "EUR",
        billingType: "onetime",
      },
    });
    for (const r of p.requests) expect(r.key).toMatch(/^(pri|pro|dsc)_/);
  });

  it("reports country prices, never converting them", async () => {
    const p = await plan();
    expect(item(p, GLOBAL)).toMatchObject({ action: "create" });
    const warning = item(p, GLOBAL).warnings.find(
      (w) => w.code === "price_overrides_not_migrated",
    )!;
    expect(warning.message).toContain("DE, FR: 1900 EUR");
    expect(warning.message).toContain("GB: 1700 GBP");
    expect(request(p, GLOBAL)!.request).toMatchObject({
      createProductRequestEntity: { price: 2000, currency: "USD" },
    });
  });

  it("skips a price in another currency and hints at its USD or EUR overrides", async () => {
    const p = await plan();
    expect(item(p, UK)).toMatchObject({
      action: "skip",
      reason: { code: "currency_unsupported" },
    });
    expect(item(p, UK).reason!.message).toContain("GBP");
    expect(item(p, UK).reason!.message).toContain("US: 1500 USD");
    expect(request(p, UK)).toBeUndefined();
  });

  it("reports quantity limits other than Paddle's default", async () => {
    const p = await plan();
    expect(item(p, HANDBOOK).warnings.map((w) => w.code)).toContain("quantity_not_migrated");
    expect(item(p, GLOBAL).warnings.map((w) => w.code)).toContain("quantity_not_migrated");
    expect(item(p, WEEKLY).warnings).toEqual([]);
  });

  it("converts a trial in weeks exactly and warns about a trial in months", async () => {
    const p = await plan();
    expect(item(p, PRO_MONTHLY).warnings).toEqual([]);
    expect(request(p, CLOUD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { trialPeriodDays: 30 },
    });
    expect(item(p, CLOUD_MONTHLY).warnings.map((w) => w.code)).toContain("trial_not_in_days");
  });

  it("skips billing outside Creem's bounds and non-catalog prices", async () => {
    const p = await plan();
    expect(item(p, CLOUD_FIVE_YEARS)).toMatchObject({
      action: "skip",
      reason: { code: "billing_interval_unsupported" },
    });
    expect(item(p, CLOUD_CUSTOM)).toMatchObject({
      action: "skip",
      reason: { code: "non_catalog" },
    });
  });

  it("maps the tax category: saas and ebooks as they are, everything else digital-goods-service", async () => {
    const p = await plan();
    expect(request(p, CLOUD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { taxCategory: "saas" },
    });
    expect(request(p, EBOOK_ONCE)!.request).toMatchObject({
      createProductRequestEntity: { taxCategory: "ebooks" },
    });
    // Creem's ebooks category is one-time only.
    expect(request(p, EBOOK_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { taxCategory: "digital-goods-service" },
    });
    expect(item(p, EBOOK_MONTHLY).warnings.map((w) => w.code)).toContain("tax_category_changed");
  });

  it("writes custom_data as metadata, leaving out values Creem metadata can't hold", async () => {
    const p = await plan();
    expect(request(p, CLOUD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { metadata: { region: "eu", plan: "cloud" } },
    });
    const warning = item(p, CLOUD_MONTHLY).warnings.find(
      (w) => w.code === "metadata_not_migrated",
    )!;
    expect(warning.message).toContain("limits");
    expect(warning.message).toContain("beta");
  });

  it("skips archived prices and the prices of archived products", async () => {
    const p = await plan();
    expect(item(p, PRO_LEGACY)).toMatchObject({ action: "skip", reason: { code: "archived" } });
    expect(item(p, OLD_MONTHLY)).toMatchObject({ action: "skip", reason: { code: "archived" } });
  });

  it("writes them as archived products with --include-archived, outside product groups", async () => {
    const p = await plan({ includeArchived: true });
    expect(request(p, PRO_LEGACY)!.request).toMatchObject({
      createProductRequestEntity: {
        name: "eng2015-Pro - Legacy quarterly",
        billingPeriod: "every-three-months",
        status: "archived",
      },
    });
    expect(request(p, OLD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { name: "eng2015-Old", status: "archived" },
    });
    expect(item(p, PRO).members).toEqual([PRO_MONTHLY, PRO_YEARLY]);
  });

  it("groups a product's migrated recurring prices, shortest billing period first", async () => {
    const p = await plan();
    expect(item(p, PRO)).toMatchObject({
      kind: "product_group",
      action: "create",
      members: [PRO_MONTHLY, PRO_YEARLY],
    });
    expect(request(p, PRO)).toEqual({
      type: "upsert_product_group",
      key: PRO,
      request: {
        createProductGroupRequestEntity: {
          externalId: PRO,
          name: "eng2015-Pro",
          products: [{ externalId: PRO_MONTHLY }, { externalId: PRO_YEARLY }],
        },
      },
    });
    // One migrated recurring price and a one-time one: no group.
    expect(item(p, EBOOKS)).toBeUndefined();
    expect(p.report.items.filter((i) => i.kind === "product_group").map((i) => i.key)).toEqual([
      PRO,
    ]);
  });

  it("puts every fetched object in the report, and the non-catalog data in not_migrated once", async () => {
    const { objects } = await paddleObjects();
    const p = fromPaddle(objects, emptyCatalog, { now: NOW });
    const keys = new Set(p.report.items.map((i) => i.key));
    for (const price of objects.prices) expect(keys, price.id).toContain(price.id);
    // A product is reported through its prices, and by its group when it has one.
    for (const product of objects.products)
      expect(
        p.report.items.some((i) => i.key === product.id || i.source.product_id === product.id),
        product.id,
      ).toBe(true);
    expect(p.report.not_migrated.map((n) => n.kind)).toEqual([
      "customers",
      "subscriptions",
      "transactions",
      "notification_settings",
    ]);
    expect(p.report.source).toEqual({
      provider: "paddle",
      store_id: "sandbox",
      store_name: "Paddle sandbox",
      currency: "USD",
    });
  });
});
