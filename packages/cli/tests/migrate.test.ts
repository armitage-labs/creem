import { join } from "node:path";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { harness } from "./helpers";
import {
  FILE_BYTES,
  LS_STORE_ID,
  fakeCreem,
  lemonSqueezyDocs,
  lemonSqueezyFetch,
  productJson,
} from "./migrate-fixtures";
import { executeMigration } from "../src/lib/migration/writer";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
} from "../src/lib/migration/lemon-squeezy/source";
import { fromLemonSqueezy } from "../src/lib/migration/lemon-squeezy/map";
import { readCreemCatalog } from "../src/lib/migration/catalog";
import { MIGRATION_REPORT_VERSION, migrationExitCode } from "../src/lib/migration/report";

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
  options: {
    excludeDiscounts?: boolean;
    files?: Record<string, Buffer>;
    docs?: ReturnType<typeof lemonSqueezyDocs>;
  } = {},
) {
  const ls = lemonSqueezyFetch(options.docs, { files: options.files });
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
    expect(digest.sha256).toBe(createHash("sha256").update(FILE_BYTES).digest("base64"));
    expect(digest.contentType).toBe("application/zip");
    expect(readFileSync(digest.path)).toEqual(FILE_BYTES);
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

describe("fromLemonSqueezy edge rules", () => {
  async function planWith(
    edit: (docs: ReturnType<typeof lemonSqueezyDocs>) => void,
    catalog = emptyCatalog,
  ) {
    const docs = lemonSqueezyDocs();
    edit(docs);
    const { objects } = await lsObjects({ docs });
    return fromLemonSqueezy(objects, catalog as never, { now: NOW });
  }
  const price = (docs: ReturnType<typeof lemonSqueezyDocs>, productId: string) =>
    docs.variants.get(productId)!.included!.find((r: any) => r.type === "prices").attributes;
  const itemOf = (p: { report: { items: any[] } }, key: string) =>
    p.report.items.find((i) => i.key === key);

  it.each([
    ["month", 30, "billing_interval_unsupported"],
    ["year", 4, "billing_interval_unsupported"],
    ["day", 400, "billing_interval_unsupported"],
  ])("skips billing every %s × %i", async (unit, count, code) => {
    const p = await planWith((docs) => {
      Object.assign(price(docs, "900006"), {
        renewal_interval_unit: unit,
        renewal_interval_quantity: count,
      });
    });
    expect(itemOf(p, "ls_variant_910006")).toMatchObject({ action: "skip", reason: { code } });
  });

  it("maps every two months to a custom period and every day to the preset", async () => {
    const p = await planWith((docs) => {
      Object.assign(price(docs, "900006"), {
        renewal_interval_unit: "month",
        renewal_interval_quantity: 2,
      });
      Object.assign(price(docs, "900004"), {
        renewal_interval_unit: "day",
        renewal_interval_quantity: 1,
      });
    });
    const body = (key: string) =>
      (p.requests.find((r) => r.key === key)!.request as any).createProductRequestEntity;
    expect(body("ls_variant_910006")).toMatchObject({
      billingPeriod: "custom",
      recurringInterval: "month",
      recurringIntervalCount: 2,
    });
    expect(body("ls_variant_910004")).toMatchObject({ billingPeriod: "every-day" });
    expect(body("ls_variant_910004").recurringInterval).toBeUndefined();
  });

  it("skips a price between 1 and 99 cents, and warns about a trial in months", async () => {
    const p = await planWith((docs) => {
      price(docs, "900007").unit_price = 50;
      Object.assign(price(docs, "900006"), {
        trial_interval_unit: "month",
        trial_interval_quantity: 1,
      });
    });
    expect(itemOf(p, "ls_variant_910007")).toMatchObject({
      reason: { code: "price_below_minimum" },
    });
    expect(
      (p.requests.find((r) => r.key === "ls_variant_910006")!.request as any)
        .createProductRequestEntity.trialPeriodDays,
    ).toBe(30);
    expect(itemOf(p, "ls_variant_910006").warnings.map((w: any) => w.code)).toEqual([
      "trial_not_in_days",
    ]);
  });

  it("gives an ebook subscription the digital goods tax category with a warning", async () => {
    const p = await planWith((docs) => {
      price(docs, "900006").tax_code = "ebook";
    });
    expect(
      (p.requests.find((r) => r.key === "ls_variant_910006")!.request as any)
        .createProductRequestEntity.taxCategory,
    ).toBe("digital-goods-service");
    expect(itemOf(p, "ls_variant_910006").warnings.map((w: any) => w.code)).toContain(
      "tax_category_changed",
    );
  });

  it("maps unlimited license keys and activations to null", async () => {
    const p = await planWith((docs) => {
      Object.assign(docs.variants.get("900007")!.data[0].attributes, {
        is_license_limit_unlimited: true,
        is_license_length_unlimited: true,
      });
    });
    expect(
      (p.requests.find((r) => r.key === "ls_variant_910007")!.request as any)
        .createProductRequestEntity.features[0].licenseKey,
    ).toEqual({ activationLimit: null, expiry: null });
  });

  it("keeps a limited discount skipped when LS does not say which variants it covers", async () => {
    const p = await planWith((docs) => {
      delete docs.discounts.data[1].relationships.variants.data;
    });
    expect(itemOf(p, "ls_discount_930002")).toMatchObject({
      action: "skip",
      reason: { code: "limited_discount_variants_unknown" },
    });
  });

  it("skips an expired discount, and one whose code another Creem discount already uses", async () => {
    const taken = {
      id: "disc_other",
      code: "LAUNCH20",
      name: "Other",
      externalId: "something_else",
      type: "percentage",
      percentage: 5,
      status: "active",
      mode: "test",
      object: "discount",
    };
    const p = await planWith(
      (docs) => {
        docs.discounts.data[1].attributes.expires_at = "2026-01-01T00:00:00.000000Z";
      },
      { ...emptyCatalog, discounts: [taken] },
    );
    expect(itemOf(p, "ls_discount_930002")).toMatchObject({ reason: { code: "discount_expired" } });
    expect(itemOf(p, "ls_discount_930001")).toMatchObject({
      reason: { code: "code_taken" },
      creem_id: "disc_other",
    });
  });

  it("applies an unlimited discount to products that already exist from an earlier run", async () => {
    const creem = fakeCreem();
    const { objects } = await lsObjects();
    const first = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    await executeMigration(creem.client, first, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    creem.state.discounts = creem.state.discounts.filter((d) => d.code !== "LAUNCH20");
    const second = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(second.requests).toEqual([
      expect.objectContaining({
        type: "create_discount",
        key: "ls_discount_930001",
        request: {
          createDiscountRequestEntity: expect.objectContaining({
            appliesToProductExternalIds: [
              "ls_variant_365902",
              "ls_variant_752120",
              "ls_variant_910001",
              "ls_variant_910003",
              "ls_variant_910004",
              "ls_variant_910006",
              "ls_variant_910007",
            ],
          }),
        },
      }),
    ]);
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

describe("executeMigration", () => {
  const FILE_ID = "00000000-0000-4000-8000-000000920001";
  async function migrate(
    creem: ReturnType<typeof fakeCreem>,
    options: Parameters<typeof lsObjects>[0] & {
      adoption?: { accepted?: string[]; declined?: string[] };
    } = {},
  ) {
    const { objects } = await lsObjects(options);
    const catalog = await readCreemCatalog(creem.client);
    const plan = fromLemonSqueezy(objects, catalog, { now: NOW, adoption: options.adoption });
    const slot = lemonSqueezyFetch();
    const report = await executeMigration(creem.client, plan, {
      files: objects.fileDigests,
      fetch: slot.fetcher,
      delayMs: 0,
    });
    return { plan, report, slotPosts: slot.slotPosts };
  }

  it("uploads files, then creates products and discounts, and reports every item done", async () => {
    const creem = fakeCreem();
    const { report, slotPosts } = await migrate(creem);
    expect(report.items.find((i) => i.key === "ls_file_920001")!.error).toBeNull();
    expect(creem.writes().map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /v1/files",
      "POST /v1/files/file_1/confirm",
      ...Array(7).fill("POST /v1/products"),
      "POST /v1/discounts",
      "POST /v1/discounts",
    ]);
    expect(report.items.find((i) => i.key === "ls_file_920001")!.error).toBeNull();
    expect(slotPosts).toHaveLength(1);
    expect(slotPosts[0].fields).toEqual({
      key: "store/sto_1/icons.zip",
      "Content-Type": "application/zip",
    });
    expect(slotPosts[0].file).toEqual(FILE_BYTES);
    const iconPack = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    expect(iconPack.features).toEqual([
      expect.objectContaining({
        type: "file",
        external_id: "ls_file_920001",
        file: { files: [expect.objectContaining({ id: "file_1", file_name: "icons.zip" })] },
      }),
    ]);
    expect(report.mode).toBe("run");
    expect(report.items.filter((i) => i.status === "pending")).toEqual([]);
    expect(report.items.filter((i) => i.status === "failed")).toEqual([]);
    expect(report.items.find((i) => i.key === "ls_file_920001")).toMatchObject({
      status: "done",
      creem_id: "file_1",
    });
    expect(migrationExitCode(report)).toBe(0);
  });

  it("finds everything on a second run: every item unchanged and nothing written", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const before = creem.writes().length;
    const { plan, report, slotPosts } = await migrate(creem);
    expect(plan.requests).toEqual([]);
    expect(creem.writes()).toHaveLength(before);
    expect(slotPosts).toEqual([]);
    const actions = new Set(
      report.items.filter((i) => i.action !== "skip").map((i) => `${i.kind}:${i.action}`),
    );
    expect([...actions].sort()).toEqual([
      "discount:unchanged",
      "file:unchanged",
      "product:unchanged",
    ]);
    expect(report.summary).toMatchObject({ create: 0, update: 0, failed: 0 });
  });

  it("uploads a file again only when its SHA-256 changed, and keeps the feature", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const stored = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    const featureId = stored.features[0].id;
    const oldFileId = stored.features[0].file.files[0].id;
    const changed = Buffer.from("icon pack v2\n");
    const { report, slotPosts } = await migrate(creem, { files: { [FILE_ID]: changed } });
    expect(slotPosts.map((p) => p.file)).toEqual([changed]);
    const iconPack = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    expect(iconPack.features).toEqual([
      expect.objectContaining({
        id: featureId,
        file: {
          files: [
            expect.objectContaining({
              id: expect.not.stringMatching(new RegExp(`^${oldFileId}$`)),
            }),
          ],
        },
      }),
    ]);
    expect(report.items.find((i) => i.key === "ls_file_920001")).toMatchObject({
      action: "update",
      status: "done",
    });
    expect(report.items.find((i) => i.key === "ls_variant_910001")).toMatchObject({
      action: "update",
      changes: ["metadata", "features.file"],
    });
  });

  it("PATCHes only what changed in Lemon Squeezy", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const docs = lemonSqueezyDocs();
    const doc = docs.variants.get("262308")!;
    const price = doc.included!.find((p: any) => p.id === "1155482");
    price.attributes.unit_price = 500;
    const before = creem.writes().length;
    const { report } = await migrate(creem, { docs });
    expect(creem.writes().slice(before)).toEqual([
      {
        method: "PATCH",
        path: expect.stringMatching(/^\/v1\/products\/prod_/),
        body: { price: 500 },
      },
    ]);
    expect(report.items.find((i) => i.key === "ls_variant_752120")).toMatchObject({
      action: "update",
      changes: ["price"],
      status: "done",
    });
  });

  it("reports 409 discount_redeemed with a hint and goes on with the run", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const launch = creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    launch.redeem_count = 4;
    const docs = lemonSqueezyDocs();
    docs.discounts.data[0].attributes.amount = 25;
    docs.discounts.data[1].attributes.name = "Five off the app";
    const { report } = await migrate(creem, { docs });
    expect(report.items.find((i) => i.key === "ls_discount_930001")).toMatchObject({
      action: "update",
      status: "failed",
      error: {
        code: "discount_redeemed",
        status: 409,
        hint: expect.stringContaining("new discount code"),
      },
    });
    expect(report.items.find((i) => i.key === "ls_discount_930002")).toMatchObject({
      status: "done",
    });
    expect(creem.state.discounts.find((d) => d.code === "APPFIVE")!.name).toBe("Five off the app");
    expect(migrationExitCode(report)).toBe(6);
  });

  it("fails a product whose file upload failed, leaves it out of discounts, and goes on", async () => {
    const creem = fakeCreem();
    creem.fail((c) => c.path === "/v1/files", 503, { code: "unavailable", message: "Try later" });
    const { report } = await migrate(creem);
    expect(report.items.find((i) => i.key === "ls_file_920001")).toMatchObject({
      status: "failed",
      error: { status: 503 },
    });
    expect(report.items.find((i) => i.key === "ls_variant_910001")).toMatchObject({
      status: "failed",
      error: { code: "dependency_failed" },
    });
    expect(creem.state.products.map((p) => p.external_id)).not.toContain("ls_variant_910001");
    const launch = creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    expect(launch.applies_to_products).toHaveLength(6);
    expect(report.items.find((i) => i.key === "ls_discount_930001")!.warnings).toContainEqual(
      expect.objectContaining({ code: "product_not_written" }),
    );
    expect(migrationExitCode(report)).toBe(6);
  });

  it("proposes adopting an unkeyed product with the same name, and adopts it only when accepted", async () => {
    const existing = productJson("prod_old", {
      name: "Desktop App",
      price: 4900,
      currency: "EUR",
      description: "The desktop app with a license key.",
      tax_category: "digital-goods-service",
    });
    const pending = await migrate(fakeCreem({ products: [existing] }));
    expect(pending.plan.report.proposals).toEqual([
      expect.objectContaining({
        id: "adopt:ls_variant_910007",
        creem_id: "prod_old",
        decision: "pending",
      }),
    ]);
    expect(pending.report.items.find((i) => i.key === "ls_variant_910007")).toMatchObject({
      action: "skip",
      reason: { code: "adoption_unconfirmed" },
    });

    const creem = fakeCreem({ products: [existing] });
    const adopted = await migrate(creem, { adoption: { accepted: ["adopt:ls_variant_910007"] } });
    const writes = creem.writes().map((c) => `${c.method} ${c.path}`);
    expect(writes[0]).toBe("PATCH /v1/products/prod_old");
    expect(creem.writes()[0].body).toEqual({ external_id: "ls_variant_910007" });
    expect(writes.filter((w) => w === "PATCH /v1/products/prod_old")).toHaveLength(2);
    expect(creem.state.products.filter((p) => p.name === "Desktop App")).toHaveLength(1);
    expect(adopted.report.items.find((i) => i.key === "ls_variant_910007")).toMatchObject({
      action: "update",
      adopted_from: "prod_old",
      status: "done",
    });

    const fresh = fakeCreem({ products: [existing] });
    await migrate(fresh, { adoption: { declined: ["adopt:ls_variant_910007"] } });
    expect(fresh.state.products.filter((p) => p.name === "Desktop App")).toHaveLength(2);
  });

  it("keeps the merchant's own file features when it replaces the file features", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const iconPack = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    creem.state.files.push({
      id: "file_own",
      filename: "bonus.pdf",
      content_type: "application/pdf",
      size: 9,
    });
    iconPack.features.push({
      id: "feat_own",
      type: "file",
      description: "Bonus",
      external_id: null,
      file: {
        files: [{ id: "file_own", file_name: "bonus.pdf", type: "application/pdf", size: 9 }],
      },
    });
    await migrate(creem, { files: { [FILE_ID]: Buffer.from("v2") } });
    const patch = creem
      .writes()
      .findLast((c) => c.method === "PATCH" && c.path === `/v1/products/${iconPack.id}`)!;
    expect(patch.body!.features).toEqual([
      expect.objectContaining({ external_id: "ls_file_920001" }),
      { id: "feat_own", type: "file", description: "Bonus", file: { files: [{ id: "file_own" }] } },
    ]);
    expect(iconPack.features.map((f: any) => f.id)).toContain("feat_own");
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

describe("creem migrate lemon-squeezy", () => {
  const LS_KEY = "ls_fixture_secret_key";
  const base = ["migrate", "lemon-squeezy", "--ls-api-key", LS_KEY, "--ls-store-id", LS_STORE_ID];
  function setup(
    options: { isTTY?: boolean; confirm?: (message: string) => Promise<boolean> } = {},
  ) {
    const ls = lemonSqueezyFetch();
    vi.stubGlobal("fetch", ls.fetcher);
    const creem = fakeCreem();
    const confirm = vi.fn(options.confirm ?? (async () => false));
    const h = harness(creem.client, { isTTY: options.isTTY ?? false, confirm });
    return { ls, creem, h, confirm };
  }

  it("--json without --yes prints the plan as a versioned report and writes nothing", async () => {
    const { creem, h, ls } = setup();
    const consoleLog = vi.spyOn(console, "log");
    const r = await h.run(["--json", ...base]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report).toMatchObject({
      schema: "creem.migration_report",
      version: 1,
      mode: "plan",
      source: { provider: "lemon_squeezy", store_id: LS_STORE_ID, currency: "EUR" },
    });
    expect(report.summary).toMatchObject({ create: 10, skip: 5 });
    expect(creem.writes()).toEqual([]);
    expect(ls.slotPosts).toEqual([]);
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("--dry-run prints the plan and writes nothing", async () => {
    const { creem, h } = setup();
    const r = await h.run([...base, "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("ls_variant_752120");
    expect(r.stdout).toContain("Dry run");
    expect(creem.writes()).toEqual([]);
  });

  it("--dry-run --json reports mode dry_run", async () => {
    const { h } = setup();
    const r = await h.run(["--json", ...base, "--dry-run"]);
    expect(JSON.parse(r.stdout).mode).toBe("dry_run");
  });

  it("prints the plan before asking, and writes nothing when the merchant declines", async () => {
    let stdoutAtConfirm = "";
    const { creem, h, confirm } = setup({
      isTTY: true,
      confirm: async () => {
        stdoutAtConfirm = h.stdout();
        return false;
      },
    });
    const r = await h.run(base);
    expect(confirm).toHaveBeenCalledOnce();
    expect(stdoutAtConfirm).toContain("ls_variant_752120");
    expect(stdoutAtConfirm).toContain("Create");
    expect(r.code).toBe(2);
    expect(creem.writes()).toEqual([]);
  });

  it("--yes runs the plan, prints the run report, and a second run writes nothing", async () => {
    const { creem, h } = setup();
    const first = await h.run(["--json", ...base, "--yes"]);
    expect(first.code, first.stderr).toBe(0);
    const report = JSON.parse(first.stdout);
    expect(report.mode).toBe("run");
    expect(report.summary).toMatchObject({ create: 10, failed: 0 });
    expect(creem.state.products).toHaveLength(7);
    const writes = creem.writes().length;
    const second = await h.run(["--json", ...base, "--yes"]);
    expect(second.code, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).summary).toMatchObject({ create: 0, update: 0 });
    expect(creem.writes()).toHaveLength(writes);
  });

  it("never sends the Lemon Squeezy key to Creem", async () => {
    const { creem, h } = setup();
    await h.run(["--json", ...base, "--yes"]);
    expect(JSON.stringify(creem.calls)).not.toContain(LS_KEY);
  });

  it("exits 6 when an item fails, after running the rest", async () => {
    const { creem, h } = setup();
    creem.fail((c) => c.method === "POST" && c.body?.code === "APPFIVE", 400, {
      code: "reference_not_found",
      message: "nope",
    });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(6);
    const report = JSON.parse(r.stdout);
    expect(report.items.find((i: any) => i.key === "ls_discount_930002")).toMatchObject({
      status: "failed",
      error: { code: "reference_not_found", status: 400 },
    });
    expect(report.items.find((i: any) => i.key === "ls_discount_930001").status).toBe("done");
  });

  it("refuses to write when the source could not be read completely (exit 4)", async () => {
    const { creem, h, ls } = setup();
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (String(input).includes("filter%5Bproduct_id%5D=900003"))
        return Response.json({ errors: [{ status: "403" }] }, { status: 403 });
      return fetcher(input, init);
    });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(4);
    expect(JSON.parse(r.stdout).fetch_failures).toEqual([
      { kind: "variants of product 900003", message: expect.stringContaining("403") },
    ]);
    expect(creem.writes()).toEqual([]);
  });

  it("says what it migrates, and never that customers are migrated", async () => {
    const { h } = setup();
    const r = await h.run([...base, "--dry-run"]);
    expect(r.stdout).toMatch(/products, product groups, discounts, license keys and files/i);
    expect(r.stdout).toMatch(/customers.*not migrated/i);
    expect(r.stdout).not.toMatch(/customers (will be|are) (created|migrated)/i);
    const help = await h.run(["migrate", "lemon-squeezy", "--help"]);
    expect(help.stdout).not.toMatch(/customers/i);
  });

  it("asks before adopting an unkeyed product in a terminal, and --adopt accepts proposals", async () => {
    const existing = productJson("prod_old", {
      name: "Desktop App",
      price: 4900,
      description: "The desktop app with a license key.",
      tax_category: "digital-goods-service",
    });
    const ls = lemonSqueezyFetch();
    vi.stubGlobal("fetch", ls.fetcher);
    const creem = fakeCreem({ products: [existing] });
    const messages: string[] = [];
    const h = harness(creem.client, {
      isTTY: true,
      confirm: vi.fn(async (message: string) => {
        messages.push(message);
        return message.includes("prod_old");
      }),
    });
    const r = await h.run([...base, "--yes"]);
    expect(r.code, r.stderr).toBe(0);
    expect(messages).toEqual([expect.stringContaining("prod_old")]);
    expect(creem.state.products.find((p) => p.id === "prod_old")!.external_id).toBe(
      "ls_variant_910007",
    );

    const auto = fakeCreem({ products: [existing] });
    const h2 = harness(auto.client);
    const r2 = await h2.run(["--json", ...base, "--yes", "--adopt"]);
    expect(r2.code, r2.stderr).toBe(0);
    expect(auto.state.products.find((p) => p.id === "prod_old")!.external_id).toBe(
      "ls_variant_910007",
    );
  });
});
