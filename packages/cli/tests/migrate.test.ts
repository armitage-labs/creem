import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { harness } from "./helpers";
import {
  FILE_BYTES,
  LS_STORE_ID,
  fakeCreem,
  lemonSqueezyFetch,
  productJson,
} from "./migrate-fixtures";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
} from "../src/lib/migration/lemon-squeezy/source";
import { fromLemonSqueezy } from "../src/lib/migration/lemon-squeezy/map";
import { readCreemCatalog } from "../src/lib/migration/catalog";
import { MIGRATION_REPORT_VERSION } from "../src/lib/migration/report";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const GOLDEN = join(__dirname, "fixtures", "lemon-squeezy", "golden");
let downloadDir = "";
beforeEach(() => {
  downloadDir = mkdtempSync(join(tmpdir(), "creem-ls-test-"));
});
afterEach(() => {
  rmSync(downloadDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

async function lsObjects(
  options: { excludeDiscounts?: boolean; files?: Record<string, Buffer> } = {},
) {
  const ls = lemonSqueezyFetch(undefined, { files: options.files });
  const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
  const result = await fetchLemonSqueezyCatalog(client, {
    storeId: LS_STORE_ID,
    excludeDiscounts: options.excludeDiscounts ?? false,
    downloadDir,
  });
  return { ...result, ls };
}
const emptyCatalog = { products: [], productGroups: [], discounts: [] };

describe("Lemon Squeezy source", () => {
  it("reads the store's catalog with GETs only, scoped to the store, and never customers", async () => {
    const { objects, failures, ls } = await lsObjects();
    expect(failures).toEqual([]);
    expect(objects.store.id).toBe(LS_STORE_ID);
    expect(objects.products.map((p) => p.id)).toEqual([
      "262308",
      "900001",
      "900002",
      "900003",
      "900004",
      "900005",
      "900006",
      "900007",
    ]);
    expect(objects.variants).toHaveLength(10);
    expect(objects.prices.map((p) => p.attributes.variant_id)).toContain(752120);
    expect(objects.files.map((f) => f.id)).toEqual(["920001"]);
    expect(objects.discounts.map((d) => d.id)).toEqual(["930001", "930002", "930003"]);
    expect(ls.lsRequests.some((r) => /customers|subscriptions|orders/.test(r))).toBe(false);
    expect(ls.lsRequests).toContain(
      "/v1/variants?page%5Bnumber%5D=1&page%5Bsize%5D=100&filter%5Bproduct_id%5D=262308&include=price-model%2Cfiles",
    );
  });

  it("downloads each file once and records its base64 SHA-256 and size", async () => {
    const { objects } = await lsObjects();
    const digest = objects.fileDigests["920001"];
    expect(digest.size).toBe(FILE_BYTES.length);
    expect(digest.sha256).toBe(
      require("node:crypto").createHash("sha256").update(FILE_BYTES).digest("base64"),
    );
    expect(digest.contentType).toBe("application/zip");
    expect(require("node:fs").readFileSync(digest.path)).toEqual(FILE_BYTES);
  });

  it("does not fetch discounts with --exclude-discounts", async () => {
    const { objects, ls } = await lsObjects({ excludeDiscounts: true });
    expect(objects.discounts).toEqual([]);
    expect(objects.discountsExcluded).toBe(true);
    expect(ls.lsRequests.some((r) => r.startsWith("/v1/discounts"))).toBe(false);
  });
});

describe("fromLemonSqueezy against an empty Creem store", () => {
  async function plan() {
    const { objects } = await lsObjects();
    return fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
  }
  const item = (p: Awaited<ReturnType<typeof plan>>, key: string) =>
    p.report.items.find((i) => i.key === key)!;
  const request = (p: Awaited<ReturnType<typeof plan>>, key: string) =>
    p.requests.find((r) => r.key === key && r.type !== "upload_file")!;

  it("matches the golden requests and report", async () => {
    const p = await plan();
    await expect(JSON.stringify(p.requests, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.requests.json"),
    );
    await expect(JSON.stringify(p.report, null, 2) + "\n").toMatchFileSnapshot(
      join(GOLDEN, "empty-store.report.json"),
    );
  });

  it("keys products by LS variant id and names them product + variant when a product has several", async () => {
    const p = await plan();
    expect(request(p, "ls_variant_752120")).toEqual({
      type: "create_product",
      key: "ls_variant_752120",
      request: {
        createProductRequestEntity: {
          name: "Pro Armitage subsription - basec",
          description: "Complete analytics platform",
          price: 400,
          currency: "EUR",
          billingType: "recurring",
          billingPeriod: "every-month",
          taxCategory: "saas",
          externalId: "ls_variant_752120",
        },
      },
    });
    expect(request(p, "ls_variant_365902").request).toMatchObject({
      createProductRequestEntity: {
        name: "Pro Armitage subsription - top",
        billingPeriod: "every-year",
      },
    });
  });

  it("skips the hidden default variant of a product with other variants", async () => {
    const p = await plan();
    expect(item(p, "ls_variant_752122")).toMatchObject({
      action: "skip",
      reason: { code: "ls_default_variant" },
    });
    expect(request(p, "ls_variant_752122")).toBeUndefined();
  });

  it("creates a free one-time product and skips a free subscription", async () => {
    const p = await plan();
    expect(request(p, "ls_variant_910001").request).toMatchObject({
      createProductRequestEntity: { name: "Icon Pack", price: 0, billingType: "onetime" },
    });
    expect(item(p, "ls_variant_910002")).toMatchObject({
      action: "skip",
      reason: { code: "free_recurring_unsupported" },
    });
  });

  it("maps pay what you want: one-time keeps it, a subscription gets a fixed price and a warning", async () => {
    const p = await plan();
    expect(request(p, "ls_variant_910003").request).toMatchObject({
      createProductRequestEntity: {
        price: 300,
        payWhatYouWant: true,
        suggestedPrice: 900,
        metadata: { ls_pwyw_suggested_price: 900 },
      },
    });
    expect(request(p, "ls_variant_910004").request).toMatchObject({
      createProductRequestEntity: { price: 500, billingType: "recurring" },
    });
    expect(
      (request(p, "ls_variant_910004").request as any).createProductRequestEntity.payWhatYouWant,
    ).toBeUndefined();
    expect(item(p, "ls_variant_910004").warnings.map((w) => w.code)).toContain(
      "pwyw_recurring_unsupported",
    );
  });

  it("skips a usage-based variant", async () => {
    const p = await plan();
    expect(item(p, "ls_variant_910005")).toMatchObject({
      action: "skip",
      reason: { code: "usage_price_without_base_price" },
    });
  });

  it("maps a weekly variant to a custom billing period and its trial to days", async () => {
    const p = await plan();
    expect(request(p, "ls_variant_910006").request).toMatchObject({
      createProductRequestEntity: {
        billingPeriod: "custom",
        recurringInterval: "week",
        recurringIntervalCount: 1,
        trialPeriodDays: 7,
      },
    });
  });

  it("gives a license-key variant a license-key feature and maps the tax code", async () => {
    const p = await plan();
    expect(request(p, "ls_variant_910007").request).toMatchObject({
      createProductRequestEntity: {
        taxCategory: "digital-goods-service",
        features: [
          {
            type: "licenseKey",
            externalId: "ls_license_key",
            description: "License key",
            licenseKey: { activationLimit: 3, expiry: { interval: "year", intervalCount: 1 } },
          },
        ],
      },
    });
  });

  it("uploads a variant's file before the products and attaches it as a file feature", async () => {
    const p = await plan();
    const { objects } = await lsObjects();
    const digest = objects.fileDigests["920001"];
    expect(p.requests.map((r) => r.type).indexOf("upload_file")).toBeLessThan(
      p.requests.map((r) => r.type).indexOf("create_product"),
    );
    expect(p.requests.find((r) => r.type === "upload_file")).toEqual({
      type: "upload_file",
      key: "ls_file_920001",
      lsFileId: "920001",
      request: {
        purpose: "product_file",
        filename: "icons.zip",
        contentType: "application/zip",
        size: FILE_BYTES.length,
        sha256: digest.sha256,
      },
    });
    expect(request(p, "ls_variant_910001").request).toMatchObject({
      createProductRequestEntity: {
        features: [
          {
            type: "file",
            externalId: "ls_file_920001",
            description: "icons.zip",
            file: { files: [{ id: "upload:ls_file_920001" }] },
          },
        ],
        metadata: { ls_file_920001_sha256: digest.sha256 },
      },
    });
  });

  it("plans a product group for a product with two migrated recurring variants, which v1 cannot write", async () => {
    const p = await plan();
    expect(item(p, "ls_product_262308")).toMatchObject({
      kind: "product_group",
      action: "skip",
      reason: { code: "product_group_write_unavailable" },
      members: ["ls_variant_365902", "ls_variant_752120"],
    });
  });

  it("applies a limited discount to its migrated variants and an unlimited one to every migrated product", async () => {
    const p = await plan();
    const migrated = p.report.items
      .filter((i) => i.kind === "product" && i.action === "create")
      .map((i) => i.key);
    expect(request(p, "ls_discount_930001").request).toEqual({
      createDiscountRequestEntity: {
        name: "Launch",
        code: "LAUNCH20",
        type: "percentage",
        percentage: 20,
        duration: "repeating",
        durationInMonths: 3,
        externalId: "ls_discount_930001",
        appliesToProductExternalIds: migrated,
      },
    });
    expect(request(p, "ls_discount_930002").request).toEqual({
      createDiscountRequestEntity: {
        name: "App five off",
        code: "APPFIVE",
        type: "fixed",
        amount: 500,
        currency: "EUR",
        duration: "once",
        maxRedemptions: 100,
        expiryDate: new Date("2027-03-01T00:00:00.000Z"),
        externalId: "ls_discount_930002",
        appliesToProductExternalIds: ["ls_variant_910007"],
      },
    });
    expect(item(p, "ls_discount_930002").warnings.map((w) => w.code)).toContain(
      "discount_variants_partially_migrated",
    );
    expect(item(p, "ls_discount_930003")).toMatchObject({
      action: "skip",
      reason: { code: "discount_not_published" },
    });
  });

  it("lists every fetched LS object in the report, and customers once as out of scope", async () => {
    const { objects } = await lsObjects();
    const p = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    const sources = new Set(p.report.items.map((i) => `${i.source.type}:${i.source.id}`));
    const parents = new Set(p.report.items.map((i) => i.source.product_id).filter(Boolean));
    for (const v of objects.variants) expect(sources).toContain(`variant:${v.id}`);
    for (const d of objects.discounts) expect(sources).toContain(`discount:${d.id}`);
    for (const f of objects.files) expect(sources).toContain(`file:${f.id}`);
    for (const pr of objects.products)
      expect(parents.has(pr.id) || sources.has(`product:${pr.id}`)).toBe(true);
    expect(p.report.not_migrated.map((n) => n.kind)).toEqual([
      "customers",
      "subscriptions",
      "orders",
      "license_keys",
    ]);
    expect(JSON.stringify(p.report)).not.toMatch(/customers? (will be|are) (created|migrated)/i);
    expect(p.report.version).toBe(MIGRATION_REPORT_VERSION);
  });
});

describe("Creem catalog reader", () => {
  it("reads products, product groups and discounts page by page", async () => {
    const creem = fakeCreem({
      products: Array.from({ length: 150 }, (_, i) => productJson(`prod_${i}`)),
    });
    const searches = vi.spyOn(creem.client.products, "search");
    const catalog = await readCreemCatalog(creem.client);
    expect(catalog.products).toHaveLength(150);
    expect(searches.mock.calls.map((c) => c[0])).toEqual([
      { pageNumber: 1, pageSize: 100 },
      { pageNumber: 2, pageSize: 100 },
    ]);
    expect(creem.writes()).toEqual([]);
  });
});

it("migration automation fails before any prompt or fetch when approval or credentials are absent", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const h = harness();
  const denied = await h.run(["migrate", "lemon-squeezy"]);
  expect(denied.code).toBe(2);
  const noKey = await h.run(["migrate", "lemon-squeezy", "--json"]);
  expect(noKey.code).toBe(3);
  expect(JSON.parse(noKey.stderr).error.message).toContain("--ls-api-key");
  expect(fetcher).not.toHaveBeenCalled();
});
