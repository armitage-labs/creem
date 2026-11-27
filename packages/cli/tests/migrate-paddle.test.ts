import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { harness } from "./helpers";
import { fakeCreem, productJson, type CreemState } from "./migrate-fixtures";
import { PADDLE_KEY, PADDLE_LIVE_KEY, paddleDocs, paddleFetch } from "./migrate-paddle-fixtures";
import { PaddleClient, fetchPaddleCatalog } from "../src/lib/migration/paddle/source";
import { fromPaddle, type PaddleObjects } from "../src/lib/migration/paddle/map";
import type { CreemCatalog } from "../src/lib/migration/catalog";
import type { MigrationItem } from "../src/lib/migration/report";
import type { ProductGroupEntity } from "creem/models/components";

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
const NO_PRICES = "pro_01hw000000000000000noprice";
const PERCENT = "dsc_01m8ee995yz3rx0zsbys7sqhhx";
const FLAT = "dsc_01m8ee99ap38a2806vqq1x8709";
const PER_SEAT = "dsc_01m8ee99ey4fmcrpt7zfmjmp7s";
const YEARLY_ONLY = "dsc_01m8ee99k6emy0gvywedsxpfjp";
const THREE_MONTHS = "dsc_01m8ee99qzphyh45944rs4jjqb";
const NO_CODE = "dsc_01m8ee99x0k076wr4e4hv35beg";
const TWO_CYCLES = "dsc_01hw00000000000000unbound";
const ARCHIVED_DISCOUNT = "dsc_01hw0000000000000archived";
const POUNDS_OFF = "dsc_01hw00000000000000gbpflat";
const EXPIRED = "dsc_01hw000000000000000expired";
const USED_UP = "dsc_01hw0000000000000000usedup";
const PARTLY_USED = "dsc_01hw000000000000000partial";
const LONG_CODE = "dsc_01hw00000000000000longcode";

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
  it("reads products, prices and discounts, active and archived, with GETs on the sandbox host only", async () => {
    const { objects, failures, paddle } = await paddleObjects({ pageSize: 2 });
    expect(failures).toEqual([]);
    expect(objects.environment).toBe("sandbox");
    expect(objects.products).toHaveLength(9);
    expect(objects.prices).toHaveLength(13);
    expect(new Set(paddle.requests.map((r) => r.host))).toEqual(
      new Set(["sandbox-api.paddle.com"]),
    );
    expect(new Set(paddle.requests.map((r) => r.path))).toEqual(
      new Set(["/products", "/prices", "/discounts"]),
    );
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
    expect(objects.products).toHaveLength(9);
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

  /** Reads the fixtures two items a page, with the cursor `next` gives a page that has more. */
  async function readPaged(
    next: (next: string, url: URL) => string | null,
    options: { maxPages?: number } = {},
  ) {
    const paddle = paddleFetch(undefined, { pageSize: 2, next, maxRequests: 60 });
    const client = new PaddleClient(PADDLE_KEY, {
      environment: "sandbox",
      fetch: paddle.fetcher,
      delayMs: 0,
      attempts: 1,
      ...options,
    });
    return { ...(await fetchPaddleCatalog(client)), paddle };
  }

  it("reports a list as unread when a page has more but no cursor to them", async () => {
    const { objects, failures } = await readPaged(() => null);
    expect(failures.map((f) => f.kind)).toEqual(["products", "prices", "discounts"]);
    expect(failures[0].message).toContain("no cursor");
    expect(objects.catalogUnread).toBe(true);
    expect(objects.discountsUnread).toBe(true);
  });

  it("never follows a cursor to another host, and reports the list as unread", async () => {
    const { objects, failures, paddle } = await readPaged((next) =>
      next.replace("sandbox-api.paddle.com", "paddle.example.com"),
    );
    expect(failures.map((f) => f.kind)).toEqual(["products", "prices", "discounts"]);
    expect(failures[0].message).toContain("https://paddle.example.com");
    expect(objects.catalogUnread).toBe(true);
    const hosts = paddle.fetcher.mock.calls.map(([input]) => new URL(String(input)).hostname);
    expect(new Set(hosts)).toEqual(new Set(["sandbox-api.paddle.com"]));
  });

  it("stops at a cursor it has already followed instead of reading forever", async () => {
    const { failures, paddle } = await readPaged((_next, url) => url.toString());
    expect(failures.map((f) => f.kind)).toEqual(["products", "prices", "discounts"]);
    expect(failures[0].message).toContain("same page");
    expect(paddle.requests.filter((r) => r.path === "/products")).toHaveLength(1);
  });

  it("stops after its page limit", async () => {
    const { failures } = await readPaged((next) => next, { maxPages: 3 });
    // Products and discounts fit in more pages than that, prices too.
    expect(failures.map((f) => f.kind)).toEqual(["products", "prices", "discounts"]);
    expect(failures[0].message).toContain("3 pages");
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

  it("keys each USD or EUR price as one product by its Paddle id, named product + price name when the product has several", async () => {
    const p = await plan();
    // The price's name is what Paddle shows buyers; its description is internal.
    expect(request(p, PRO_MONTHLY)).toEqual({
      type: "upsert_product",
      key: PRO_MONTHLY,
      request: {
        createProductRequestEntity: {
          name: "eng2015-Pro - Pro monthly",
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
        name: "eng2015-Pro - Pro yearly",
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

  it("names a product by its Paddle prices, not the migrated ones, so the name stays when a sibling is skipped or archived", async () => {
    const p = await plan();
    // Cloud has three prices; only the monthly one is migrated.
    expect(request(p, CLOUD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { name: "eng2015-Cloud - Monthly" },
    });
    const { objects } = await paddleObjects();
    const yearly = objects.prices.find((price) => price.id === PRO_YEARLY)!;
    yearly.status = "archived";
    const archived = fromPaddle(objects, emptyCatalog, { now: NOW });
    expect(item(archived, PRO_YEARLY).reason?.code).toBe("archived");
    expect(item(archived, PRO_MONTHLY).name).toBe(item(p, PRO_MONTHLY).name);
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
    expect(item(p, WEEKLY).warnings.map((w) => w.code)).not.toContain("quantity_not_migrated");
  });

  it("converts a trial in weeks exactly and warns about a trial in months", async () => {
    const p = await plan();
    expect(item(p, PRO_MONTHLY).warnings.map((w) => w.code)).not.toContain("trial_not_in_days");
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

  it("maps the tax mode: internal as inclusive, external as exclusive, and reports the others", async () => {
    const p = await plan();
    expect(request(p, CLOUD_MONTHLY)!.request).toMatchObject({
      createProductRequestEntity: { taxMode: "exclusive" },
    });
    expect(request(p, EBOOK_ONCE)!.request).toMatchObject({
      createProductRequestEntity: { taxMode: "inclusive" },
    });
    // location (the recorded prices) and account_setting: the store's default.
    for (const key of [PRO_MONTHLY, EBOOK_MONTHLY]) {
      const body = (request(p, key)!.request as { createProductRequestEntity: object })
        .createProductRequestEntity;
      expect(body, key).not.toHaveProperty("taxMode");
      expect(
        item(p, key).warnings.map((w) => w.code),
        key,
      ).toContain("tax_mode_not_migrated");
    }
    expect(item(p, CLOUD_MONTHLY).warnings.map((w) => w.code)).not.toContain(
      "tax_mode_not_migrated",
    );
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

  it("reports a product without prices as skipped, keyed by its Paddle id", async () => {
    const p = await plan();
    expect(item(p, NO_PRICES)).toMatchObject({
      kind: "product",
      name: "eng2015-Coming soon",
      source: { type: "product", id: NO_PRICES },
      action: "skip",
      reason: { code: "no_prices" },
    });
    expect(request(p, NO_PRICES)).toBeUndefined();
  });

  it("reports a keyed Creem product group that Paddle no longer groups, and leaves it as it is", async () => {
    const group = (id: string, externalId: string) =>
      ({ id, name: externalId, externalId, products: [] }) as unknown as ProductGroupEntity;
    const GONE = "pro_01hw00000000000000000gone";
    const catalog: CreemCatalog = {
      ...emptyCatalog,
      productGroups: [group("pgrp_ebooks", EBOOKS), group("pgrp_gone", GONE)],
    };
    const { objects } = await paddleObjects();
    const p = fromPaddle(objects, catalog, { now: NOW });
    const groups = p.report.items.filter((i) => i.kind === "product_group");
    // Ebooks has one migrated recurring price now; the other product is gone.
    expect(groups.find((i) => i.key === EBOOKS)).toMatchObject({
      action: "skip",
      creem_id: "pgrp_ebooks",
      reason: { code: "group_not_needed" },
      warnings: [{ code: "orphaned" }],
    });
    expect(groups.find((i) => i.key === GONE)).toMatchObject({
      action: "skip",
      creem_id: "pgrp_gone",
      reason: { code: "product_not_found" },
      warnings: [{ code: "orphaned" }],
    });
    expect(p.requests.filter((r) => r.type === "upsert_product_group").map((r) => r.key)).toEqual([
      PRO,
    ]);
    // Without the whole catalog, no group is known to be stale.
    const unread = fromPaddle({ ...objects, catalogUnread: true }, catalog, { now: NOW });
    expect(unread.report.items.filter((i) => i.kind === "product_group").map((i) => i.key)).toEqual(
      [PRO],
    );
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

describe("creem migrate paddle", () => {
  const base = ["migrate", "paddle", "--paddle-key", PADDLE_KEY];
  function setup(
    options: {
      isTTY?: boolean;
      confirm?: (message: string) => Promise<boolean>;
      initial?: Partial<CreemState>;
      failures?: Record<string, number>;
      next?: (next: string, url: URL) => string | null;
      pageSize?: number;
    } = {},
  ) {
    vi.stubEnv("PADDLE_API_KEY", "");
    const paddle = paddleFetch(undefined, {
      failures: options.failures,
      next: options.next,
      pageSize: options.pageSize,
      maxRequests: 200,
    });
    vi.stubGlobal("fetch", paddle.fetcher);
    const creem = fakeCreem(options.initial);
    const confirm = vi.fn(options.confirm ?? (async () => false));
    const h = harness(creem.client, { isTTY: options.isTTY ?? false, confirm });
    return { paddle, creem, h, confirm };
  }
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails before any prompt or fetch without approval or a key", async () => {
    const { paddle, h } = setup();
    const denied = await h.run(["migrate", "paddle"]);
    expect(denied.code).toBe(2);
    const noKey = await h.run(["migrate", "paddle", "--json"]);
    expect(noKey.code).toBe(2);
    expect(JSON.parse(noKey.stderr).error.message).toContain("--paddle-key");
    const environment = await h.run([...base, "--json", "--paddle-environment", "staging"]);
    expect(environment.code).toBe(2);
    expect(JSON.parse(environment.stderr).error.message).toContain("sandbox or production");
    expect(paddle.fetcher).not.toHaveBeenCalled();
  });

  it("takes only sandbox or production as the environment, not an object property name", async () => {
    const { paddle, h } = setup();
    for (const environment of ["constructor", "toString", "__proto__"]) {
      const r = await h.run([...base, "--json", "--paddle-environment", environment]);
      expect(r.code, environment).toBe(2);
      expect(JSON.parse(r.stderr).error.message, environment).toContain("sandbox or production");
    }
    expect(paddle.fetcher).not.toHaveBeenCalled();
  });

  it("refuses a sandbox key for production and a live key for the sandbox", async () => {
    const { paddle, h } = setup();
    const sandboxKey = await h.run([...base, "--json", "--paddle-environment", "production"]);
    expect(sandboxKey.code).toBe(2);
    expect(JSON.parse(sandboxKey.stderr).error.message).toContain("sandbox key");
    const liveKey = await h.run([
      ...["migrate", "paddle", "--paddle-key", PADDLE_LIVE_KEY, "--json"],
      ...["--paddle-environment", "sandbox"],
    ]);
    expect(liveKey.code).toBe(2);
    expect(paddle.fetcher).not.toHaveBeenCalled();
  });

  it("--json without --yes prints the plan, read from the sandbox the key belongs to, and writes nothing", async () => {
    const { creem, h, paddle } = setup();
    const r = await h.run(["--json", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report).toMatchObject({
      schema: "creem.migration_report",
      mode: "plan",
      source: { provider: "paddle", store_id: "sandbox" },
    });
    expect(report.items.find((i: MigrationItem) => i.key === PRO_MONTHLY).action).toBe("create");
    expect(creem.writes()).toEqual([]);
    expect(new Set(paddle.requests.map((x) => x.host))).toEqual(
      new Set(["sandbox-api.paddle.com"]),
    );
  });

  it("takes the key from PADDLE_API_KEY", async () => {
    const { creem, h } = setup();
    vi.stubEnv("PADDLE_API_KEY", PADDLE_KEY);
    const r = await h.run(["--json", "migrate", "paddle", "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).mode).toBe("dry_run");
    expect(creem.writes()).toEqual([]);
  });

  it("validates before the first write, dry-runs every write, and keeps the key away from Creem", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.mode).toBe("run");
    const sent = creem.calls.filter((c) => c.method !== "GET");
    expect(sent[0].path).toBe("/v1/catalog/validate");
    const writes = creem.writes();
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      const index = creem.calls.indexOf(write);
      const before = creem.calls[index - 1];
      expect(before, `${write.method} ${write.path}`).toMatchObject({
        method: write.method,
        path: write.path,
        body: write.body,
        dryRun: true,
      });
    }
    // Products first, then product groups.
    const paths = writes.map((w) => w.path);
    expect(paths.lastIndexOf("/v1/products")).toBeLessThan(paths.indexOf("/v1/product-groups"));
    expect(JSON.stringify(creem.calls)).not.toContain(PADDLE_KEY);
    expect(creem.state.products.map((p) => p.external_id)).toContain(PRO_MONTHLY);
    expect(creem.state.productGroups.map((g) => g.external_id)).toEqual([PRO]);
  });

  it("a second run reports everything unchanged and writes nothing", async () => {
    const { creem, h } = setup();
    expect((await h.run(["--json", "--yes", ...base])).code).toBe(0);
    const written = creem.writes().length;
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.summary).toMatchObject({ create: 0, update: 0, failed: 0 });
    for (const i of report.items as MigrationItem[])
      expect([i.key, i.action]).toEqual([i.key, i.action === "skip" ? "skip" : "unchanged"]);
    expect(creem.writes()).toHaveLength(written);
  });

  it("renames a product group whose Paddle product was renamed", async () => {
    const { creem, h } = setup();
    expect((await h.run(["--json", "--yes", ...base])).code).toBe(0);
    creem.state.productGroups[0].name = "eng2015-Pro (old)";
    const written = creem.writes().length;
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const group = (JSON.parse(r.stdout).items as MigrationItem[]).find(
      (i) => i.kind === "product_group" && i.key === PRO,
    );
    expect(group).toMatchObject({ action: "update", changes: ["name"] });
    expect(creem.state.productGroups[0].name).toBe("eng2015-Pro");
    // The members stay as they are, in their order, by id.
    const ids = creem.state.productGroups[0].products.map((m: { id: string }) => ({ id: m.id }));
    const writes = creem.writes().slice(written);
    expect(writes.map((w) => [w.path, w.body])).toEqual([
      ["/v1/product-groups", { external_id: PRO, name: "eng2015-Pro", products: ids }],
    ]);
  });

  it("updates the tax mode of a Creem product that differs from Paddle's", async () => {
    const { creem, h } = setup();
    expect((await h.run(["--json", "--yes", ...base])).code).toBe(0);
    const cloud = creem.state.products.find((p) => p.external_id === CLOUD_MONTHLY)!;
    expect(cloud.tax_mode).toBe("exclusive");
    cloud.tax_mode = "inclusive";
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const updated = (JSON.parse(r.stdout).items as MigrationItem[]).find(
      (i) => i.kind === "product" && i.key === CLOUD_MONTHLY,
    );
    expect(updated).toMatchObject({ action: "update", changes: ["tax_mode"] });
    expect(cloud.tax_mode).toBe("exclusive");
  });

  it("--include-archived writes archived prices as archived products", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", "--yes", ...base, "--include-archived"]);
    expect(r.code, r.stderr).toBe(0);
    const write = creem.writes().find((w) => w.body?.external_id === PRO_LEGACY)!;
    expect(write.body).toMatchObject({ status: "archived", billing_period: "every-three-months" });
  });

  it("adopts an existing Creem product only through an answered proposal", async () => {
    const own = productJson("prod_own", {
      name: "eng2015-Weekly",
      price: 500,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "custom",
      recurring_interval: "week",
      recurring_interval_count: 1,
    });
    const { creem, h } = setup({ initial: { products: [own] } });
    const pending = await h.run(["--json", "--yes", ...base]);
    expect(pending.code).toBe(7);
    expect(JSON.parse(pending.stdout).proposals).toMatchObject([
      { key: WEEKLY, decision: "pending", candidates: [{ creem_id: "prod_own" }] },
    ]);
    expect(creem.writes()).toEqual([]);
    const adopted = await h.run(["--json", "--yes", ...base, "--adopt", `${WEEKLY}=prod_own`]);
    expect(adopted.code, adopted.stderr).toBe(0);
    const patch = creem.writes().find((w) => w.method === "PATCH")!;
    expect(patch).toMatchObject({ path: "/v1/products/prod_own", body: { external_id: WEEKLY } });
    expect(creem.state.products.find((p) => p.id === "prod_own")!.external_id).toBe(WEEKLY);
  });

  it("exits with the auth code when Paddle refuses the key", async () => {
    const { creem, h } = setup({ failures: { "/products": 403 } });
    const r = await h.run(["--json", ...base]);
    expect(r.code).toBe(3);
    expect(r.stderr).not.toContain(PADDLE_KEY);
    expect(creem.calls).toEqual([]);
  });

  it("writes nothing when Paddle can't be read completely", async () => {
    const { creem, h } = setup({ failures: { "/prices": 500 } });
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code).toBe(4);
    expect(JSON.parse(r.stdout).fetch_failures).toEqual([
      { kind: "prices", message: expect.any(String) },
    ]);
    expect(creem.writes()).toEqual([]);
  });

  it("writes nothing when a Paddle page has more but sends no cursor to them", async () => {
    const { creem, h } = setup({ pageSize: 2, next: () => null });
    const r = await h.run(["--json", "--yes", ...base]);
    expect(r.code).toBe(4);
    expect(JSON.parse(r.stdout).fetch_failures.map((f: { kind: string }) => f.kind)).toEqual([
      "products",
      "prices",
      "discounts",
    ]);
    expect(creem.writes()).toEqual([]);
  });

  it("prints the plan in a terminal and lists what isn't catalog", async () => {
    const { h } = setup();
    const r = await h.run([...base, "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("Plan: Paddle");
    expect(r.stdout).toContain(PRO_MONTHLY);
    expect(r.stdout).toContain(
      "Not migrated: customers, subscriptions, transactions, notification settings.",
    );
  });
});

describe("ENG-2015 discounts", () => {
  /** Every price the fixtures migrate, in report order. */
  const MIGRATED = [
    CLOUD_MONTHLY,
    EBOOK_ONCE,
    EBOOK_MONTHLY,
    PRO_MONTHLY,
    PRO_YEARLY,
    HANDBOOK,
    GLOBAL,
    WEEKLY,
  ];

  it("reads the discounts, active and archived, and reports a discount list it can't read", async () => {
    const { objects, paddle } = await paddleObjects({ pageSize: 2 });
    expect(objects.discounts).toHaveLength(13);
    expect(paddle.requests.some((r) => r.path === "/discounts")).toBe(true);
    const failing = paddleFetch(undefined, { failures: { "/discounts": 500 } });
    const client = new PaddleClient(PADDLE_KEY, {
      environment: "sandbox",
      fetch: failing.fetcher,
      delayMs: 0,
      attempts: 1,
    });
    const read = await fetchPaddleCatalog(client);
    expect(read.failures).toEqual([{ kind: "discounts", message: expect.stringContaining("500") }]);
    expect(read.objects.discountsUnread).toBe(true);
  });

  it("puts every fetched discount in the report", async () => {
    const { objects } = await paddleObjects();
    const p = fromPaddle(objects, emptyCatalog, { now: NOW });
    const keys = new Set(p.report.items.map((i) => i.key));
    for (const discount of objects.discounts) expect(keys, discount.id).toContain(discount.id);
  });

  it("maps a percentage discount once, with what is left of its usage limit and its expiry, on every migrated product", async () => {
    const p = await plan();
    expect(request(p, PERCENT)).toEqual({
      type: "upsert_discount",
      key: PERCENT,
      request: {
        createDiscountRequestEntity: {
          name: "eng2015-Launch 20%",
          code: "ENG2015PCT",
          type: "percentage",
          percentage: 20,
          duration: "once",
          maxRedemptions: 100,
          expiryDate: new Date("2027-12-31T00:00:00Z"),
          externalId: PERCENT,
          appliesToProductExternalIds: MIGRATED,
        },
      },
    });
    expect(item(p, PERCENT).warnings.map((w) => w.code)).toEqual(["discount_applies_to_all"]);
  });

  it("maps a flat discount as a fixed one in its currency, and recur without a limit as forever", async () => {
    const p = await plan();
    expect(request(p, FLAT)!.request).toMatchObject({
      createDiscountRequestEntity: {
        code: "ENG2015FLAT",
        type: "fixed",
        amount: 500,
        currency: "USD",
        duration: "forever",
      },
    });
  });

  it("applies a fixed discount only to products in its own currency, and names the others", async () => {
    const p = await plan();
    const usd = MIGRATED.filter((k) => ![CLOUD_MONTHLY, HANDBOOK].includes(k));
    expect(request(p, FLAT)!.request).toMatchObject({
      createDiscountRequestEntity: { appliesToProductExternalIds: usd },
    });
    const warning = item(p, FLAT).warnings.find((w) => w.code === "discount_currency_mismatch")!;
    expect(warning.message).toContain(CLOUD_MONTHLY);
    expect(warning.message).toContain(HANDBOOK);
    // EUR off a USD product only: nothing is left to apply it to.
    expect(request(p, PARTLY_USED)!.request).toMatchObject({
      createDiscountRequestEntity: { appliesToProductExternalIds: [CLOUD_MONTHLY] },
    });
  });

  it("maps maximum_recurring_intervals as repeating months only when every product bills monthly", async () => {
    const p = await plan();
    expect(request(p, THREE_MONTHS)!.request).toMatchObject({
      createDiscountRequestEntity: {
        duration: "repeating",
        durationInMonths: 3,
        appliesToProductExternalIds: [PRO_MONTHLY],
      },
    });
    expect(item(p, TWO_CYCLES)).toMatchObject({
      action: "skip",
      reason: { code: "duration_unsupported" },
      warnings: [],
    });
  });

  it("restricts a discount to the prices it names, or to every price of a product it names", async () => {
    const p = await plan();
    expect(request(p, YEARLY_ONLY)!.request).toMatchObject({
      createDiscountRequestEntity: { appliesToProductExternalIds: [PRO_YEARLY] },
    });
    expect(item(p, YEARLY_ONLY).warnings).toEqual([]);
    const body = (request(p, NO_CODE)!.request as { createDiscountRequestEntity: object })
      .createDiscountRequestEntity;
    expect(body).toMatchObject({ appliesToProductExternalIds: [PRO_MONTHLY, PRO_YEARLY] });
    // The archived price of that product isn't migrated, and is named.
    const partial = item(p, NO_CODE).warnings.find(
      (w) => w.code === "discount_products_partially_migrated",
    )!;
    expect(partial.message).toContain(PRO_LEGACY);
  });

  it("leaves the code to Creem when Paddle has none, and says so", async () => {
    const p = await plan();
    const body = (request(p, NO_CODE)!.request as { createDiscountRequestEntity: object })
      .createDiscountRequestEntity;
    expect(body).not.toHaveProperty("code");
    expect(item(p, NO_CODE).warnings.map((w) => w.code)).toContain("discount_code_generated");
  });

  it("skips per-seat, other currencies, archived, expired, used-up and over-long codes, each with its reason", async () => {
    const p = await plan({ includeArchived: true });
    const reasons = Object.fromEntries(
      [PER_SEAT, POUNDS_OFF, ARCHIVED_DISCOUNT, EXPIRED, USED_UP, LONG_CODE].map((key) => [
        key,
        item(p, key).reason?.code,
      ]),
    );
    expect(reasons).toEqual({
      [PER_SEAT]: "discount_type_unsupported",
      [POUNDS_OFF]: "currency_unsupported",
      [ARCHIVED_DISCOUNT]: "archived",
      [EXPIRED]: "discount_expired",
      [USED_UP]: "discount_used_up",
      [LONG_CODE]: "discount_code_too_long",
    });
    for (const key of Object.keys(reasons)) expect(request(p, key)).toBeUndefined();
  });

  it("carries over only the uses left of Paddle's usage limit", async () => {
    const p = await plan();
    expect(request(p, PARTLY_USED)!.request).toMatchObject({
      createDiscountRequestEntity: {
        type: "fixed",
        amount: 200,
        currency: "EUR",
        maxRedemptions: 7,
      },
    });
  });

  it("adopts an existing discount with the same code, ignoring case, only through an answered proposal", async () => {
    const own = {
      id: "disc_own",
      mode: "test",
      object: "discount",
      status: "active",
      name: "Launch",
      code: "eng2015pct",
      type: "percentage",
      percentage: 20,
      duration: "once",
      applies_to_products: [],
      redeem_count: 0,
      external_id: null,
    };
    vi.stubEnv("PADDLE_API_KEY", "");
    vi.stubGlobal("fetch", paddleFetch().fetcher);
    const creem = fakeCreem({ discounts: [own] });
    const h = harness(creem.client);
    const base = ["--json", "--yes", "migrate", "paddle", "--paddle-key", PADDLE_KEY];
    const pending = await h.run(base);
    expect(pending.code).toBe(7);
    expect(JSON.parse(pending.stdout).proposals).toMatchObject([
      { key: PERCENT, kind: "discount", candidates: [{ creem_id: "disc_own" }] },
    ]);
    expect(creem.writes()).toEqual([]);
    const adopted = await h.run([...base, "--adopt", `${PERCENT}=disc_own`]);
    expect(adopted.code, adopted.stderr).toBe(0);
    expect(creem.state.discounts.find((d) => d.id === "disc_own")!.external_id).toBe(PERCENT);
    vi.unstubAllEnvs();
  });

  it("writes discounts after the products and groups, and a second run leaves them unchanged", async () => {
    vi.stubEnv("PADDLE_API_KEY", "");
    vi.stubGlobal("fetch", paddleFetch().fetcher);
    const creem = fakeCreem();
    const h = harness(creem.client);
    const base = ["--json", "--yes", "migrate", "paddle", "--paddle-key", PADDLE_KEY];
    const first = await h.run(base);
    expect(first.code, first.stderr).toBe(0);
    const paths = creem.writes().map((w) => w.path);
    expect(paths.indexOf("/v1/discounts")).toBeGreaterThan(paths.lastIndexOf("/v1/product-groups"));
    expect(creem.state.discounts.map((d) => d.external_id).sort()).toEqual(
      [PERCENT, FLAT, YEARLY_ONLY, THREE_MONTHS, NO_CODE, PARTLY_USED].sort(),
    );
    const written = creem.writes().length;
    const second = await h.run(base);
    expect(second.code, second.stderr).toBe(0);
    for (const i of JSON.parse(second.stdout).items as MigrationItem[])
      if (i.kind === "discount" && i.action !== "skip")
        expect([i.key, i.action]).toEqual([i.key, "unchanged"]);
    expect(creem.writes()).toHaveLength(written);
    vi.unstubAllEnvs();
  });
});
