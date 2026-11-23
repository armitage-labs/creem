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
import { checkMigration, executeMigration } from "../src/lib/migration/writer";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
} from "../src/lib/migration/lemon-squeezy/source";
import { fromLemonSqueezy, htmlToText } from "../src/lib/migration/lemon-squeezy/map";
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
const FILE_ID = "00000000-0000-4000-8000-000000920001";

async function migrate(
  creem: ReturnType<typeof fakeCreem>,
  options: Parameters<typeof lsObjects>[0] & {
    adoption?: Record<string, string>;
    force?: boolean;
  } = {},
) {
  const { objects } = await lsObjects(options);
  const catalog = await readCreemCatalog(creem.client);
  const plan = fromLemonSqueezy(objects, catalog, { now: NOW, adoption: options.adoption });
  // As the command does: Creem checks the plan before the first write.
  const checked = plan.answerErrors.length ? plan : await checkMigration(creem.client, plan);
  const slot = lemonSqueezyFetch();
  const report = await executeMigration(creem.client, checked, {
    files: objects.fileDigests,
    fetch: slot.fetcher,
    delayMs: 0,
    force: options.force,
  });
  return { plan, checked, report, slotPosts: slot.slotPosts };
}

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
      type: "upsert_product",
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
      p.requests.map((r) => r.type).indexOf("upsert_product"),
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

  it("plans a product group for a product with two migrated recurring variants, written with the keyed upsert", async () => {
    const p = await plan();
    expect(item(p, "ls_product_262308")).toMatchObject({
      kind: "product_group",
      action: "create",
      status: "pending",
      reason: null,
      members: ["ls_variant_365902", "ls_variant_752120"],
    });
    expect(request(p, "ls_product_262308")).toEqual({
      type: "upsert_product_group",
      key: "ls_product_262308",
      request: {
        createProductGroupRequestEntity: {
          externalId: "ls_product_262308",
          name: "Pro Armitage subsription",
          products: [{ externalId: "ls_variant_365902" }, { externalId: "ls_variant_752120" }],
        },
      },
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
        type: "upsert_discount",
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
  it("uploads files, then upserts products, the product group and discounts, and reports every item done", async () => {
    const creem = fakeCreem();
    const { report, slotPosts } = await migrate(creem);
    expect(report.items.find((i) => i.key === "ls_file_920001")!.error).toBeNull();
    expect(creem.writes().map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /v1/files",
      "POST /v1/files/file_1/confirm",
      ...Array(7).fill("POST /v1/products"),
      "POST /v1/product-groups",
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
      "product_group:unchanged",
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

  it("sends only what changed in Lemon Squeezy, as a keyed upsert", async () => {
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
        method: "POST",
        path: "/v1/products",
        body: { external_id: "ls_variant_752120", price: 500 },
      },
    ]);
    expect(report.items.find((i) => i.key === "ls_variant_752120")).toMatchObject({
      action: "update",
      changes: ["price"],
      status: "done",
    });
  });

  it("reports 409 discount_redeemed with a hint before the first write, and a forced run goes on with the rest", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const launch = creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    launch.redeem_count = 4;
    const docs = lemonSqueezyDocs();
    docs.discounts.data[0].attributes.amount = 25;
    docs.discounts.data[1].attributes.name = "Five off the app";
    const before = creem.writes().length;
    await expect(migrate(creem, { docs })).rejects.toThrow(/refused 1 item/);
    expect(creem.writes()).toHaveLength(before);
    const { checked, report } = await migrate(creem, { docs, force: true });
    expect(checked.report.items.find((i) => i.key === "ls_discount_930001")).toMatchObject({
      status: "failed",
      error: { code: "discount_redeemed", status: 409 },
    });
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
        candidates: [expect.objectContaining({ creem_id: "prod_old" })],
        creem_id: null,
        decision: "pending",
      }),
    ]);
    expect(pending.report.items.find((i) => i.key === "ls_variant_910007")).toMatchObject({
      action: "skip",
      reason: { code: "adoption_unconfirmed" },
    });

    const creem = fakeCreem({ products: [existing] });
    const adopted = await migrate(creem, { adoption: { "adopt:ls_variant_910007": "prod_old" } });
    const writes = creem.writes().map((c) => `${c.method} ${c.path}`);
    expect(writes[0]).toBe("PATCH /v1/products/prod_old");
    expect(creem.writes()[0].body).toEqual({ external_id: "ls_variant_910007" });
    // Adopting gives it the key; the update is then a keyed upsert.
    expect(writes.filter((w) => w === "PATCH /v1/products/prod_old")).toHaveLength(1);
    expect(
      creem
        .writes()
        .find((c) => c.path === "/v1/products" && c.body?.external_id === "ls_variant_910007"),
    ).toBeDefined();
    expect(creem.state.products.filter((p) => p.name === "Desktop App")).toHaveLength(1);
    expect(adopted.report.items.find((i) => i.key === "ls_variant_910007")).toMatchObject({
      action: "update",
      adopted_from: "prod_old",
      status: "done",
    });

    const fresh = fakeCreem({ products: [existing] });
    await migrate(fresh, { adoption: { "adopt:ls_variant_910007": "new" } });
    expect(fresh.state.products.filter((p) => p.name === "Desktop App")).toHaveLength(2);
  });

  it("skips the files of a product that waits for an adoption decision, with the reason", async () => {
    const existing = productJson("prod_icons", {
      name: "Icon Pack",
      price: 0,
      description: "200 icons & a Figma file.",
    });
    const { plan } = await migrate(fakeCreem({ products: [existing] }));
    expect(plan.report.items.find((i) => i.key === "ls_file_920001")).toMatchObject({
      action: "skip",
      reason: { code: "adoption_unconfirmed" },
    });
    expect(plan.requests.filter((r) => r.type === "upload_file")).toEqual([]);
  });

  it("leaves a product whose adoption failed out of the discounts", async () => {
    const existing = productJson("prod_old", {
      name: "Desktop App",
      price: 4900,
      description: "The desktop app with a license key.",
      tax_category: "digital-goods-service",
    });
    const creem = fakeCreem({ products: [existing] });
    creem.fail((c) => c.method === "PATCH" && c.path === "/v1/products/prod_old", 409, {
      code: "external_id_taken",
      message: "taken",
    });
    const { report } = await migrate(creem, {
      adoption: { "adopt:ls_variant_910007": "prod_old" },
    });
    expect(report.items.find((i) => i.key === "ls_variant_910007")).toMatchObject({
      status: "failed",
      error: { code: "external_id_taken" },
    });
    expect(report.items.find((i) => i.key === "ls_discount_930002")).toMatchObject({
      status: "failed",
      error: { code: "dependency_failed" },
    });
    expect(creem.writes().filter((c) => c.path === "/v1/discounts")).toHaveLength(1);
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
      .findLast((c) => c.path === "/v1/products" && c.body?.external_id === "ls_variant_910001")!;
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
  expect(noKey.code).toBe(2);
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
    expect(report.summary).toMatchObject({ create: 11, skip: 4 });
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
    expect(report.summary).toMatchObject({ create: 11, failed: 0 });
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
    // Only the real write fails: its dry run, in the check and right before it, passes.
    creem.fail((c) => c.method === "POST" && !c.dryRun && c.body?.code === "APPFIVE", 400, {
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

// ---- review round 2

async function planFrom(
  edit: (docs: ReturnType<typeof lemonSqueezyDocs>) => void = () => {},
  catalog: Record<string, unknown[]> = emptyCatalog,
  adoption?: Record<string, string>,
) {
  const docs = lemonSqueezyDocs();
  edit(docs);
  const { objects } = await lsObjects({ docs });
  return fromLemonSqueezy(objects, { ...emptyCatalog, ...catalog } as never, {
    now: NOW,
    adoption,
  });
}
const findItem = (p: { report: { items: any[] } }, key: string) =>
  p.report.items.find((i) => i.key === key);
const lsPrice = (docs: ReturnType<typeof lemonSqueezyDocs>, productId: string) =>
  docs.variants.get(productId)!.included!.find((r: any) => r.type === "prices").attributes;
const desktopApp = (id: string, fields: Record<string, unknown> = {}) =>
  productJson(id, {
    name: "Desktop App",
    price: 4900,
    description: "The desktop app with a license key.",
    tax_category: "digital-goods-service",
    ...fields,
  });

describe("adoption proposals (candidate rule)", () => {
  it("proposes a product whose name differs only in case and spacing, and shows the differences", async () => {
    const creem = fakeCreem({
      products: [desktopApp("prod_usd", { name: "  desktop   APP ", currency: "USD" })],
    });
    const p = await planFrom(undefined, await readCreemCatalog(creem.client));
    expect(p.report.proposals).toEqual([
      expect.objectContaining({
        id: "adopt:ls_variant_910007",
        key: "ls_variant_910007",
        decision: "pending",
        candidates: [
          {
            creem_id: "prod_usd",
            creem_name: "  desktop   APP ",
            differences: expect.arrayContaining([expect.stringContaining("currency")]),
          },
        ],
      }),
    ]);
    expect(findItem(p, "ls_variant_910007")).toMatchObject({
      action: "skip",
      creem_id: "prod_usd",
      reason: { code: "adoption_unconfirmed" },
    });
    expect(p.requests.filter((r) => r.key === "ls_variant_910007")).toEqual([]);
  });

  it("makes several look-alike products one proposal with every candidate, never a silent create", async () => {
    const creem = fakeCreem({
      products: [
        desktopApp("prod_a", { status: "archived" }),
        desktopApp("prod_b", { billing_type: "recurring", billing_period: "every-month" }),
        desktopApp("prod_c"),
      ],
    });
    const catalog = await readCreemCatalog(creem.client);
    const pending = await planFrom(undefined, catalog);
    expect(pending.report.proposals).toHaveLength(1);
    expect(pending.report.proposals[0].candidates.map((c) => c.creem_id)).toEqual([
      "prod_c",
      "prod_a",
      "prod_b",
    ]);
    expect(findItem(pending, "ls_variant_910007")).toMatchObject({
      action: "skip",
      creem_id: null,
      reason: { code: "adoption_unconfirmed" },
    });
    expect(pending.requests.filter((r) => r.key === "ls_variant_910007")).toEqual([]);

    const chosen = await planFrom(undefined, catalog, { "adopt:ls_variant_910007": "prod_b" });
    expect(chosen.requests[0]).toEqual({
      type: "adopt_product",
      key: "ls_variant_910007",
      request: { id: "prod_b", updateProductRequestEntity: { externalId: "ls_variant_910007" } },
    });
    expect(chosen.report.proposals[0]).toMatchObject({ decision: "accepted", creem_id: "prod_b" });

    const fresh = await planFrom(undefined, catalog, { "adopt:ls_variant_910007": "new" });
    expect(fresh.requests.find((r) => r.key === "ls_variant_910007")!.type).toBe("upsert_product");
  });

  it("rejects an answer that names no Creem product, and skips the item", async () => {
    const creem = fakeCreem({ products: [desktopApp("prod_a")] });
    const p = await planFrom(undefined, await readCreemCatalog(creem.client), {
      "adopt:ls_variant_910007": "prod_unknown",
    });
    expect(p.answerErrors).toEqual([expect.objectContaining({ code: "adoption_answer_invalid" })]);
    expect(findItem(p, "ls_variant_910007")).toMatchObject({
      action: "skip",
      reason: { code: "adoption_answer_invalid" },
    });
  });
});

describe("mapping fixes", () => {
  it("adds the license-key feature to a stored product that has none, also for unlimited keys", async () => {
    const docs = lemonSqueezyDocs();
    Object.assign(docs.variants.get("900007")!.data[0].attributes, {
      is_license_limit_unlimited: true,
      is_license_length_unlimited: true,
    });
    const creem = fakeCreem();
    await migrate(creem, { docs });
    const app = creem.state.products.find((p) => p.external_id === "ls_variant_910007")!;
    app.features = [];
    const { plan } = await migrate(creem, { docs });
    expect(findItem(plan, "ls_variant_910007")).toMatchObject({
      action: "update",
      changes: ["features.license_key"],
    });
    expect(app.features).toEqual([
      expect.objectContaining({ type: "licenseKey", external_id: "ls_license_key" }),
    ]);
  });

  it("warns, every run, that a removed pay-what-you-want suggestion can't be cleared", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const docs = lemonSqueezyDocs();
    lsPrice(docs, "900003").suggested_price = null;
    for (let run = 0; run < 2; run++) {
      const before = creem.writes().length;
      const { plan } = await migrate(creem, { docs });
      expect(findItem(plan, "ls_variant_910003")).toMatchObject({
        action: "unchanged",
        warnings: [expect.objectContaining({ code: "pwyw_suggestion_not_clearable" })],
      });
      expect(creem.writes()).toHaveLength(before);
    }
    const tipJar = creem.state.products.find((p) => p.external_id === "ls_variant_910003")!;
    expect(tipJar.metadata.ls_pwyw_suggested_price).toBe(900);
  });

  it.each([0, 50])("skips pay what you want with a minimum of %i cents", async (min) => {
    const p = await planFrom((docs) => {
      Object.assign(lsPrice(docs, "900003"), { min_price: min, unit_price: min });
    });
    expect(findItem(p, "ls_variant_910003")).toMatchObject({
      action: "skip",
      reason: { code: "pwyw_minimum_below_100" },
    });
  });

  it("skips a discount code longer than 14 characters and shortens a name longer than 40", async () => {
    const p = await planFrom((docs) => {
      docs.discounts.data[0].attributes.code = "SUMMERSALE2026XL";
      docs.discounts.data[1].attributes.name = "Five off the desktop app for early supporters";
    });
    expect(findItem(p, "ls_discount_930001")).toMatchObject({
      action: "skip",
      reason: { code: "discount_code_too_long" },
    });
    const body = (p.requests.find((r) => r.key === "ls_discount_930002")!.request as any)
      .createDiscountRequestEntity;
    expect(body.name).toBe("Five off the desktop app for early suppo");
    expect(findItem(p, "ls_discount_930002").warnings.map((w: any) => w.code)).toContain(
      "discount_name_truncated",
    );
  });

  it("skips a draft variant", async () => {
    const p = await planFrom((docs) => {
      docs.variants.get("262308")!.data.find((v: any) => v.id === "365902").attributes.status =
        "draft";
    });
    expect(findItem(p, "ls_variant_365902")).toMatchObject({
      action: "skip",
      reason: { code: "variant_draft" },
    });
  });

  it("reports keyed Creem products whose variant is gone or no longer migrated as orphaned", async () => {
    const creem = fakeCreem({
      products: [productJson("prod_gone", { name: "Old plan", external_id: "ls_variant_999999" })],
    });
    await migrate(creem);
    const pro = creem.state.products.find((p) => p.external_id === "ls_variant_365902")!;
    const p = await planFrom(
      (docs) => {
        docs.variants.get("262308")!.data.find((v: any) => v.id === "365902").attributes.status =
          "draft";
      },
      await readCreemCatalog(creem.client),
    );
    expect(findItem(p, "ls_variant_365902")).toMatchObject({
      action: "skip",
      creem_id: pro.id,
      warnings: [expect.objectContaining({ code: "orphaned" })],
    });
    expect(findItem(p, "ls_variant_999999")).toMatchObject({
      kind: "product",
      action: "skip",
      creem_id: "prod_gone",
      source: { type: "variant", id: "999999" },
      warnings: [expect.objectContaining({ code: "orphaned" })],
    });
  });

  it("gives an adopted product's own keyless license-key and file features the keys, instead of adding second ones", async () => {
    const digest = createHash("sha256").update(FILE_BYTES).digest("base64");
    const creem = fakeCreem({
      products: [
        desktopApp("prod_old", {
          features: [
            {
              id: "feat_lk",
              type: "licenseKey",
              description: "Your key",
              external_id: null,
              license_key: { activation_limit: 1, expiry: null },
            },
          ],
        }),
        productJson("prod_icons", {
          name: "Icon Pack",
          price: 0,
          description: "200 icons & a Figma file.",
          features: [
            {
              id: "feat_files",
              type: "file",
              description: "Downloads",
              external_id: null,
              file: {
                files: [
                  {
                    id: "file_mine",
                    file_name: "icons.zip",
                    type: "application/zip",
                    size: FILE_BYTES.length,
                    url: "https://x",
                  },
                  {
                    id: "file_extra",
                    file_name: "readme.pdf",
                    type: "application/pdf",
                    size: 9,
                    url: "https://x",
                  },
                ],
              },
            },
          ],
        }),
      ],
      files: [
        {
          id: "file_mine",
          filename: "icons.zip",
          content_type: "application/zip",
          size: FILE_BYTES.length,
        },
        { id: "file_extra", filename: "readme.pdf", content_type: "application/pdf", size: 9 },
      ],
    });
    const { plan, slotPosts } = await migrate(creem, {
      adoption: {
        "adopt:ls_variant_910007": "prod_old",
        "adopt:ls_variant_910001": "prod_icons",
      },
    });
    const app = creem.state.products.find((p) => p.id === "prod_old")!;
    expect(app.features).toEqual([
      expect.objectContaining({
        id: "feat_lk",
        external_id: "ls_license_key",
        license_key: { activation_limit: 3, expiry: { interval: "year", interval_count: 1 } },
      }),
    ]);
    expect(findItem(plan, "ls_variant_910007").warnings.map((w: any) => w.code)).toContain(
      "feature_adopted",
    );
    const icons = creem.state.products.find((p) => p.id === "prod_icons")!;
    // The API can't show file_mine's bytes, so the LS file goes next to it.
    expect(slotPosts).toHaveLength(1);
    const uploaded = icons.metadata.ls_file_920001_file_id;
    expect(uploaded).not.toBe("file_mine");
    expect(icons.features).toEqual([
      expect.objectContaining({
        id: "feat_files",
        external_id: "ls_file_920001",
        file: {
          files: [
            expect.objectContaining({ id: uploaded }),
            expect.objectContaining({ id: "file_mine" }),
            expect.objectContaining({ id: "file_extra" }),
          ],
        },
      }),
    ]);
    expect(icons.metadata).toMatchObject({ ls_file_920001_sha256: digest });
    const again = await migrate(creem);
    expect(again.plan.requests).toEqual([]);
  });
});

describe("writer fixes", () => {
  it("attaches a discount to 120 migrated variants without passing 100 keys in one request", async () => {
    const docs = lemonSqueezyDocs();
    docs.products.data.push({
      type: "products",
      id: "900008",
      attributes: { store_id: 86325, name: "Fonts", description: "A font", status: "published" },
    });
    const template = docs.variants.get("900007")!.data[0];
    docs.variants.set("900008", {
      data: Array.from({ length: 120 }, (_, i) => ({
        type: "variants",
        id: String(980000 + i),
        attributes: {
          ...template.attributes,
          product_id: 900008,
          name: `Weight ${i}`,
          has_license_keys: false,
          status: "published",
          sort: i,
        },
      })),
    });
    const creem = fakeCreem();
    const { report } = await migrate(creem, { docs });
    expect(report.items.filter((i) => i.status === "failed")).toEqual([]);
    const launch = creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    expect(launch.applies_to_products).toHaveLength(127);
    for (const call of creem.writes().filter((c) => c.path.startsWith("/v1/discounts")))
      expect((call.body!.applies_to_product_external_ids ?? []).length).toBeLessThanOrEqual(100);
    const second = await migrate(creem, { docs });
    expect(second.plan.requests).toEqual([]);
  });

  it("keeps the products the merchant added to a migrated discount", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    creem.state.products.push(productJson("prod_mine", { external_id: "my_bundle" }));
    creem.state.products.push(productJson("prod_unkeyed"));
    const appFive = creem.state.discounts.find((d) => d.external_id === "ls_discount_930002")!;
    appFive.applies_to_products.push("prod_mine", "prod_unkeyed");
    const unchanged = await migrate(creem);
    expect(findItem(unchanged.plan, "ls_discount_930002").action).toBe("unchanged");

    const docs = lemonSqueezyDocs();
    docs.discounts.data[1].relationships.variants.data.push({ type: "variants", id: "910003" });
    const { report } = await migrate(creem, { docs });
    expect(findItem({ report }, "ls_discount_930002")).toMatchObject({
      action: "update",
      status: "done",
    });
    const tipJar = creem.state.products.find((p) => p.external_id === "ls_variant_910003")!;
    const app = creem.state.products.find((p) => p.external_id === "ls_variant_910007")!;
    expect([...appFive.applies_to_products].sort()).toEqual(
      ["prod_mine", "prod_unkeyed", tipJar.id, app.id].sort(),
    );
  });

  it("reports an uploaded file that its failed product write left unattached", async () => {
    const creem = fakeCreem();
    creem.fail((c) => c.method === "POST" && c.body?.external_id === "ls_variant_910001", 500, {
      code: "internal_error",
      message: "boom",
    });
    const { report } = await migrate(creem);
    expect(findItem({ report }, "ls_file_920001")).toMatchObject({
      status: "done",
      creem_id: "file_1",
      warnings: [expect.objectContaining({ code: "file_not_attached" })],
    });
    expect(findItem({ report }, "ls_variant_910001").status).toBe("failed");
  });

  it("keeps the merchant's extra files in the migrated file feature when the file changes", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const iconPack = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    creem.state.files.push({
      id: "file_extra",
      filename: "readme.pdf",
      content_type: "application/pdf",
      size: 9,
    });
    iconPack.features[0].file.files.push({
      id: "file_extra",
      file_name: "readme.pdf",
      type: "application/pdf",
      size: 9,
    });
    const unchanged = await migrate(creem);
    expect(unchanged.plan.requests).toEqual([]);
    await migrate(creem, { files: { [FILE_ID]: Buffer.from("v2") } });
    expect(iconPack.features[0].file.files.map((f: any) => f.id)).toEqual([
      expect.not.stringMatching(/^file_1$/),
      "file_extra",
    ]);
  });
});

describe("htmlToText", () => {
  it("leaves no tag behind when tags are nested inside each other", () => {
    expect(htmlToText("<<script>script>alert(1)<</script>/script><p>Hello</p>")).not.toMatch(
      /<\/?[a-z]/i,
    );
    expect(htmlToText("<<b>b>Bold<</b>/b>")).toBe("Bold");
  });

  it("keeps an escaped angle bracket as text", () => {
    expect(htmlToText("<p>1 &lt; 2</p>")).toBe("1 < 2");
  });
});

describe("source fixes", () => {
  it("skips a file that can't be downloaded instead of stopping the run", async () => {
    const ls = lemonSqueezyFetch();
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (
        new URL(String(input instanceof Request ? input.url : input)).hostname ===
        "app.lemonsqueezy.com"
      )
        return new Response("gone", { status: 404 });
      return fetcher(input, init);
    });
    const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
    const { objects, failures } = await fetchLemonSqueezyCatalog(client, {
      storeId: LS_STORE_ID,
      excludeDiscounts: false,
      downloadDir,
    });
    expect(failures).toEqual([]);
    const p = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    expect(findItem(p, "ls_file_920001")).toMatchObject({
      action: "skip",
      reason: { code: "file_not_downloaded", message: expect.stringContaining("404") },
    });
    expect(findItem(p, "ls_variant_910001").action).toBe("create");
  });

  it("downloads files from their signed URL without the API key", async () => {
    const { ls } = await lsObjects();
    const download = ls.fetcher.mock.calls.find(
      ([input]) =>
        new URL(String(input instanceof Request ? input.url : input)).hostname ===
        "app.lemonsqueezy.com",
    )!;
    const headers = new Headers(download[1]?.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});

describe("creem migrate lemon-squeezy, review round 2", () => {
  const LS_KEY = "ls_fixture_secret_key";
  const base = ["migrate", "lemon-squeezy", "--ls-api-key", LS_KEY, "--ls-store-id", LS_STORE_ID];
  function setup(
    products: Record<string, unknown>[] = [],
    options: { isTTY?: boolean; confirm?: (message: string) => Promise<boolean> } = {},
  ) {
    const ls = lemonSqueezyFetch();
    vi.stubGlobal("fetch", ls.fetcher);
    const creem = fakeCreem({ products });
    const confirm = vi.fn(options.confirm ?? (async () => false));
    const h = harness(creem.client, { isTTY: options.isTTY ?? false, confirm });
    return { ls, creem, h, confirm };
  }

  it("--json --yes writes nothing while an adoption proposal is unanswered (exit 7)", async () => {
    const { creem, h } = setup([desktopApp("prod_old")]);
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(7);
    expect(creem.writes()).toEqual([]);
    const report = JSON.parse(r.stdout);
    expect(report.proposals).toEqual([
      expect.objectContaining({ key: "ls_variant_910007", decision: "pending" }),
    ]);
    const error = JSON.parse(r.stderr).error;
    expect(error.message).toContain("ls_variant_910007");
    expect(error.suggestion ?? error.hint ?? JSON.stringify(error)).toMatch(/--adopt/);
  });

  it("without --json, lists the unanswered proposals and writes nothing (exit 7)", async () => {
    const { creem, h } = setup([desktopApp("prod_old")]);
    const r = await h.run([...base, "--yes"]);
    expect(r.code).toBe(7);
    expect(creem.writes()).toEqual([]);
    expect(r.stdout).toContain("prod_old");
    expect(r.stderr).toMatch(/--adopt/);
  });

  it("--adopt <key>=<id> picks one of several candidates, and <key>=new creates a new product", async () => {
    const both = [desktopApp("prod_a"), desktopApp("prod_b")];
    const picked = setup(both);
    const r = await picked.h.run([
      "--json",
      ...base,
      "--yes",
      "--adopt",
      "ls_variant_910007=prod_b",
    ]);
    expect(r.code, r.stderr).toBe(0);
    expect(picked.creem.state.products.find((p) => p.id === "prod_b")!.external_id).toBe(
      "ls_variant_910007",
    );
    expect(picked.creem.state.products.find((p) => p.id === "prod_a")!.external_id).toBeNull();

    const fresh = setup(both);
    const r2 = await fresh.h.run(["--json", ...base, "--yes", "--adopt", "ls_variant_910007=new"]);
    expect(r2.code, r2.stderr).toBe(0);
    expect(fresh.creem.state.products.filter((p) => p.name === "Desktop App")).toHaveLength(3);

    const plain = setup(both);
    const r3 = await plain.h.run(["--json", ...base, "--yes", "--adopt"]);
    expect(r3.code).toBe(7);
    expect(plain.creem.writes()).toEqual([]);
  });

  it("asks about each candidate in a terminal, and Ctrl-C there cancels the migration", async () => {
    const asked: string[] = [];
    const { creem, h } = setup([desktopApp("prod_a"), desktopApp("prod_b")], {
      isTTY: true,
      confirm: async (message) => {
        asked.push(message);
        return message.includes("prod_b") || message.includes("Write this plan");
      },
    });
    const r = await h.run([...base]);
    expect(r.code, r.stderr).toBe(0);
    expect(asked.slice(0, 2)).toEqual([
      expect.stringContaining("prod_a"),
      expect.stringContaining("prod_b"),
    ]);
    expect(creem.state.products.find((p) => p.id === "prod_b")!.external_id).toBe(
      "ls_variant_910007",
    );

    const canceled = setup([desktopApp("prod_a")], {
      isTTY: true,
      confirm: async () => {
        throw Object.assign(new Error("User force closed the prompt with SIGINT"), {
          name: "ExitPromptError",
        });
      },
    });
    const r2 = await canceled.h.run([...base]);
    expect(r2.code).toBe(2);
    expect(r2.stderr).toContain("Migration canceled.");
    expect(canceled.creem.writes()).toEqual([]);
  });

  it("says Creem already matches once the product groups are written too", async () => {
    const { h } = setup();
    await h.run(["--json", ...base, "--yes"]);
    const r = await h.run([...base, "--yes"]);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("already matches");
  });
});

describe("review round 3", () => {
  const LS_KEY = "ls_fixture_secret_key";
  const base = ["migrate", "lemon-squeezy", "--ls-api-key", LS_KEY, "--ls-store-id", LS_STORE_ID];
  const digestOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("base64");
  function cli(
    products: Record<string, unknown>[] = [],
    docs: ReturnType<typeof lemonSqueezyDocs> = lemonSqueezyDocs(),
  ) {
    const ls = lemonSqueezyFetch(docs);
    vi.stubGlobal("fetch", ls.fetcher);
    const creem = fakeCreem({ products });
    return { creem, h: harness(creem.client) };
  }
  const iconPack = (id: string, fields: Record<string, unknown> = {}) =>
    productJson(id, {
      name: "Icon Pack",
      price: 0,
      description: "200 icons & a Figma file.",
      ...fields,
    });
  const merchantFileFeature = (fileId: string, size: number) => ({
    id: "feat_mine",
    type: "file",
    description: "Downloads",
    external_id: null,
    file: { files: [{ id: fileId, file_name: "icons.zip", type: "application/zip", size }] },
  });

  describe("--adopt answers are checked before anything else", () => {
    it("refuses two answers that claim one Creem product (exit 2, nothing written)", async () => {
      const docs = lemonSqueezyDocs();
      docs.products.data.find((p: any) => p.id === "900007").attributes.name = "Icon Pack";
      const { creem, h } = cli([iconPack("prod_icons")], docs);
      const r = await h.run([
        "--json",
        ...base,
        "--yes",
        "--adopt",
        "ls_variant_910001=prod_icons",
        "ls_variant_910007=prod_icons",
      ]);
      expect(r.code).toBe(2);
      expect(creem.writes()).toEqual([]);
      expect(JSON.parse(r.stderr).error.message).toMatch(/ls_variant_910007.*prod_icons/);
    });

    it("refuses an answer for a key the run doesn't migrate, or naming an unknown or keyed product", async () => {
      const keyed = productJson("prod_keyed", { name: "Other", external_id: "my_key" });
      const catalog = await readCreemCatalog(fakeCreem({ products: [keyed] }).client);
      const typo = await planFrom(undefined, catalog, { "adopt:ls_variant_999999": "new" });
      expect(typo.answerErrors).toEqual([
        expect.objectContaining({
          code: "adoption_answer_invalid",
          message: expect.stringContaining("ls_variant_999999"),
        }),
      ]);
      const unknown = await planFrom(undefined, catalog, { "adopt:ls_variant_910007": "prod_x" });
      expect(unknown.answerErrors[0].message).toContain("prod_x");
      expect(unknown.report.items.find((i) => i.key === "ls_variant_910007")!.action).toBe("skip");
      const taken = await planFrom(undefined, catalog, {
        "adopt:ls_variant_910007": "prod_keyed",
      });
      expect(taken.answerErrors[0].message).toContain("my_key");
    });

    it("adopts an unkeyed product the answer names even when its name differs, and the same answers re-run cleanly", async () => {
      const { creem, h } = cli([desktopApp("prod_renamed", { name: "Desktop App Pro" })]);
      const args = ["--json", ...base, "--yes", "--adopt", "ls_variant_910007=prod_renamed"];
      const r = await h.run(args);
      expect(r.code, r.stderr).toBe(0);
      const report = JSON.parse(r.stdout);
      expect(report.proposals).toEqual([
        expect.objectContaining({
          key: "ls_variant_910007",
          decision: "accepted",
          creem_id: "prod_renamed",
          candidates: [
            expect.objectContaining({
              creem_id: "prod_renamed",
              differences: expect.arrayContaining([expect.stringContaining("name")]),
            }),
          ],
        }),
      ]);
      const app = creem.state.products.find((p) => p.id === "prod_renamed")!;
      expect(app.external_id).toBe("ls_variant_910007");
      expect(app.name).toBe("Desktop App");
      const again = await h.run(args);
      expect(again.code, again.stderr).toBe(0);
    });
  });

  it("sends the merchant's metadata back as it is, even a value that looks like an upload", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const icons = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    icons.metadata.support_reference = "upload:ls_file_920001";
    icons.metadata.other_reference = "upload:ls_file_999";
    const { report } = await migrate(creem, { files: { [FILE_ID]: Buffer.from("new bytes") } });
    expect(report.summary.failed).toBe(0);
    expect(icons.metadata.support_reference).toBe("upload:ls_file_920001");
    expect(icons.metadata.other_reference).toBe("upload:ls_file_999");
    expect(icons.metadata.ls_file_920001_file_id).toMatch(/^file_/);
  });

  it("uploads the LS file and keeps every file when the recorded file is gone from the feature", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const icons = creem.state.products.find((p) => p.external_id === "ls_variant_910001")!;
    creem.state.files.push({
      id: "file_merchant",
      filename: "icons.zip",
      content_type: "application/zip",
      size: FILE_BYTES.length,
    });
    icons.features[0].file.files = [
      { id: "file_merchant", file_name: "icons.zip", type: "application/zip", size: 24 },
    ];
    const { plan, slotPosts } = await migrate(creem);
    expect(findItem(plan, "ls_file_920001").action).toBe("create");
    expect(slotPosts).toHaveLength(1);
    const ids = icons.features[0].file.files.map((f: any) => f.id);
    expect(ids).toContain("file_merchant");
    expect(ids).toHaveLength(2);
    expect(icons.metadata.ls_file_920001_file_id).not.toBe("file_merchant");
    expect((await migrate(creem)).plan.requests).toEqual([]);
  });

  it("never takes a merchant file as the LS file without a verified SHA-256: uploads next to it", async () => {
    const differentBytes = Buffer.alloc(FILE_BYTES.length, 0);
    const creem = fakeCreem({
      products: [iconPack("prod_icons", { features: [merchantFileFeature("file_mine", 24)] })],
      files: [
        {
          id: "file_mine",
          filename: "icons.zip",
          content_type: "application/zip",
          size: differentBytes.length,
          sha256: digestOf(differentBytes),
        },
      ],
    });
    const { plan, slotPosts } = await migrate(creem, {
      adoption: { "adopt:ls_variant_910001": "prod_icons" },
    });
    expect(slotPosts).toHaveLength(1);
    expect(findItem(plan, "ls_variant_910001").warnings.map((w: any) => w.code)).toContain(
      "file_kept_unverified",
    );
    const icons = creem.state.products.find((p) => p.id === "prod_icons")!;
    expect(icons.features).toEqual([
      expect.objectContaining({
        id: "feat_mine",
        external_id: "ls_file_920001",
        file: {
          files: [
            expect.objectContaining({ id: expect.not.stringMatching(/^file_mine$/) }),
            expect.objectContaining({ id: "file_mine" }),
          ],
        },
      }),
    ]);
    expect(icons.metadata.ls_file_920001_file_id).not.toBe("file_mine");
    expect(icons.metadata.ls_file_920001_sha256).toBe(digestOf(FILE_BYTES));
    expect((await migrate(creem)).plan.requests).toEqual([]);
  });

  describe("discount products", () => {
    it("keeps a migrated product the merchant added to a limited discount", async () => {
      const creem = fakeCreem();
      await migrate(creem);
      const tip = creem.state.products.find((p) => p.external_id === "ls_variant_910003")!;
      const discount = creem.state.discounts.find((d) => d.external_id === "ls_discount_930002")!;
      discount.applies_to_products.push(tip.id);
      const { plan } = await migrate(creem);
      expect(discount.applies_to_products).toContain(tip.id);
      expect(plan.requests.filter((r) => r.key === "ls_discount_930002")).toEqual([]);
      expect(findItem(plan, "ls_discount_930002").warnings.map((w: any) => w.code)).toContain(
        "discount_product_kept",
      );
    });

    it("never removes a product LS dropped from the discount, and says so", async () => {
      const creem = fakeCreem();
      await migrate(creem);
      const discount = creem.state.discounts.find((d) => d.external_id === "ls_discount_930002")!;
      const before = [...discount.applies_to_products];
      const docs = lemonSqueezyDocs();
      docs.discounts.data[1].relationships.variants.data.push({ type: "variants", id: "910003" });
      const dropped = docs.discounts.data[1].relationships.variants.data.shift();
      const { plan } = await migrate(creem, { docs });
      const tip = creem.state.products.find((p) => p.external_id === "ls_variant_910003")!;
      expect(discount.applies_to_products.sort()).toEqual([...before, tip.id].sort());
      expect(findItem(plan, "ls_discount_930002").warnings).toContainEqual(
        expect.objectContaining({
          code: "discount_product_kept",
          message: expect.stringContaining(`ls_variant_${dropped.id}`),
        }),
      );
    });
  });

  it.each([["--json"], ["--dry-run"]])(
    "%s exits 7 while an adoption proposal is unanswered, and writes nothing",
    async (flag) => {
      const { creem, h } = cli([desktopApp("prod_old")]);
      const r = await h.run([...base, flag]);
      expect(r.code).toBe(7);
      expect(creem.writes()).toEqual([]);
      if (flag === "--json") expect(migrationExitCode(JSON.parse(r.stdout))).toBe(7);
      else expect(r.stdout).toContain("prod_old");
    },
  );

  it("shows a custom cadence difference in an adoption proposal", async () => {
    const creem = fakeCreem({
      products: [
        productJson("prod_weekly", {
          name: "Weekly Digest",
          price: 300,
          billing_type: "recurring",
          billing_period: "custom",
          recurring_interval: "week",
          recurring_interval_count: 2,
        }),
      ],
    });
    const fresh = await planFrom();
    const wanted = (fresh.requests.find((r) => r.key === "ls_variant_910006") as any).request
      .createProductRequestEntity;
    creem.state.products[0].name = wanted.name;
    const p = await planFrom(undefined, await readCreemCatalog(creem.client));
    expect(p.report.proposals[0].candidates[0].differences).toEqual([
      expect.stringMatching(/every 2 week.*every 1 week/),
    ]);
  });

  it("reports every uploaded file of a product whose other upload failed as unattached", async () => {
    const docs = lemonSqueezyDocs();
    const doc = docs.variants.get("900001")!;
    const first = doc.included!.find((r: any) => r.type === "files");
    doc.included!.push({
      ...first,
      id: "920002",
      attributes: {
        ...first.attributes,
        identifier: "00000000-0000-4000-8000-000000920002",
        name: "manual.pdf",
        download_url: "https://app.lemonsqueezy.com/download/00000000-0000-4000-8000-000000920002",
        sort: 2,
      },
    });
    doc.data[0].relationships.files.data.push({ type: "files", id: "920002" });
    const creem = fakeCreem();
    creem.fail((c) => c.method === "POST" && c.body?.filename === "manual.pdf", 500, {
      code: "internal_error",
      message: "boom",
    });
    const { report } = await migrate(creem, { docs });
    expect(findItem({ report }, "ls_variant_910001").status).toBe("failed");
    expect(findItem({ report }, "ls_file_920002").status).toBe("failed");
    expect(findItem({ report }, "ls_file_920001")).toMatchObject({
      status: "done",
      warnings: [expect.objectContaining({ code: "file_not_attached" })],
    });
  });
});

describe("discounts Lemon Squeezy no longer sells", () => {
  it("reports a keyed Creem discount that LS disabled or deleted as orphaned", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const docs = lemonSqueezyDocs();
    docs.discounts = {
      ...docs.discounts,
      data: docs.discounts.data
        .filter((d) => d.id !== "930002")
        .map((d) =>
          d.id === "930001" ? { ...d, attributes: { ...d.attributes, status: "draft" } } : d,
        ),
    };
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    const byKey = (key: string) => p.report.items.find((i) => i.key === key);
    const stored = (code: string) => creem.state.discounts.find((d) => d.code === code)!.id;
    expect(byKey("ls_discount_930001")).toMatchObject({
      action: "skip",
      reason: { code: "discount_not_published" },
      creem_id: stored("LAUNCH20"),
      warnings: [expect.objectContaining({ code: "orphaned" })],
    });
    expect(byKey("ls_discount_930002")).toMatchObject({
      action: "skip",
      reason: { code: "discount_not_found" },
      creem_id: stored("APPFIVE"),
      warnings: [expect.objectContaining({ code: "orphaned" })],
    });
    expect(p.requests.filter((r) => r.type.endsWith("_discount"))).toEqual([]);
  });

  it("reports no Creem discount as orphaned with --exclude-discounts", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const { objects } = await lsObjects({ excludeDiscounts: true });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(p.report.items.filter((i) => i.kind === "discount")).toEqual([]);
  });

  it("doesn't warn about a keyed Creem discount the merchant already expired", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    for (const d of creem.state.discounts) d.status = "expired";
    const docs = lemonSqueezyDocs();
    docs.discounts = {
      ...docs.discounts,
      data: docs.discounts.data
        .filter((d) => d.id === "930001")
        .map((d) => ({ ...d, attributes: { ...d.attributes, status: "draft" } })),
    };
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(p.report.items.filter((i) => i.kind === "discount")).toEqual([
      expect.objectContaining({
        key: "ls_discount_930001",
        action: "skip",
        creem_id: creem.state.discounts.find((d) => d.code === "LAUNCH20")!.id,
        warnings: [],
      }),
    ]);
  });
});

describe("limited discounts carry over only the redemptions LS has left", () => {
  it("reads the used count per limited discount, scoped to it, and never orders", async () => {
    const { ls, failures } = await lsObjects();
    expect(failures).toEqual([]);
    const counts = ls.lsRequests.filter((r) => r.startsWith("/v1/discount-redemptions"));
    expect(counts).toEqual([
      "/v1/discount-redemptions?page%5Bnumber%5D=1&page%5Bsize%5D=1&filter%5Bdiscount_id%5D=930002",
    ]);
    expect(ls.lsRequests.some((r) => /customers|subscriptions|orders/.test(r))).toBe(false);
  });

  it("does not read redemptions with --exclude-discounts", async () => {
    const { ls } = await lsObjects({ excludeDiscounts: true });
    expect(ls.lsRequests.some((r) => r.startsWith("/v1/discount-redemptions"))).toBe(false);
  });

  it("creates a limited code with what's left of its cap", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    const create = p.requests.find((r) => r.key === "ls_discount_930002")!.request as any;
    expect(create.createDiscountRequestEntity.maxRedemptions).toBe(10);
  });

  it("skips a limited code LS has used up", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 100;
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    expect(findItem(p, "ls_discount_930002")).toMatchObject({
      action: "skip",
      reason: { code: "discount_used_up" },
    });
    expect(p.requests.some((r) => r.key === "ls_discount_930002")).toBe(false);
  });

  it("keeps the merchant's matching correction: a re-run with the same LS count writes nothing", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const creem = fakeCreem();
    await migrate(creem, { docs });
    const stored = creem.state.discounts.find((d) => d.code === "APPFIVE")!;
    expect(stored.max_redemptions).toBe(10);
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(findItem(p, "ls_discount_930002").action).toBe("unchanged");
  });

  it("lowers the Creem cap when more codes were redeemed in LS since the last run", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const creem = fakeCreem();
    await migrate(creem, { docs });
    docs.redemptions["930002"] = 95;
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(findItem(p, "ls_discount_930002")).toMatchObject({
      action: "update",
      changes: ["max_redemptions"],
    });
    const update = p.requests.find((r) => r.key === "ls_discount_930002")!.request as any;
    expect(update.createDiscountRequestEntity).toEqual({
      maxRedemptions: 5,
      externalId: "ls_discount_930002",
    });
  });

  it("refuses to write when a used count can't be read", async () => {
    const ls = lemonSqueezyFetch();
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (String(input instanceof Request ? input.url : input).includes("discount-redemptions"))
        return new Response("nope", { status: 403 });
      return fetcher(input, init);
    });
    const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
    const { objects, failures } = await fetchLemonSqueezyCatalog(client, {
      storeId: LS_STORE_ID,
      excludeDiscounts: false,
      downloadDir,
    });
    expect(failures).toEqual([
      { kind: "redemptions of discount 930002", message: expect.stringContaining("403") },
    ]);
    const p = fromLemonSqueezy(objects, emptyCatalog, { now: NOW });
    expect(findItem(p, "ls_discount_930002")).toMatchObject({
      action: "skip",
      reason: { code: "discount_redemptions_unknown" },
    });
  });
});

describe("redemption counts: review round", () => {
  const LS_KEY = "ls_fixture_secret_key";
  const base = ["migrate", "lemon-squeezy", "--ls-api-key", LS_KEY, "--ls-store-id", LS_STORE_ID];
  const failCounts = (ls: ReturnType<typeof lemonSqueezyFetch>, response: () => Response) => {
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (String(input instanceof Request ? input.url : input).includes("discount-redemptions"))
        return response();
      return fetcher(input, init);
    });
  };

  it("exits 4 and writes nothing when a count can't be read, even with an --adopt answer for that discount", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const appFive = creem.state.discounts.find((d) => d.code === "APPFIVE")!;
    appFive.external_id = null;
    const writesBefore = creem.writes().length;
    const ls = lemonSqueezyFetch();
    failCounts(ls, () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", ls.fetcher);
    const confirm = vi.fn(async () => true);
    const h = harness(creem.client, { isTTY: false, confirm });
    const r = await h.run([
      "--json",
      ...base,
      "--yes",
      "--adopt",
      `ls_discount_930002=${appFive.id}`,
    ]);
    expect(r.code).toBe(4);
    expect(JSON.parse(r.stdout).fetch_failures).toEqual([
      { kind: "redemptions of discount 930002", message: expect.stringContaining("403") },
    ]);
    expect(creem.writes()).toHaveLength(writesBefore);
  });

  it("asks no adoption question in a terminal when the read is incomplete, and exits 4", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    // An unkeyed product stays an adoption proposal even when the discount read fails.
    creem.state.products.find((p) => p.external_id === "ls_variant_910007")!.external_id = null;
    const writesBefore = creem.writes().length;
    const ls = lemonSqueezyFetch();
    failCounts(ls, () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", ls.fetcher);
    const confirm = vi.fn(async () => true);
    const h = harness(creem.client, { isTTY: true, confirm });
    const r = await h.run(base);
    expect(r.code).toBe(4);
    expect(confirm).not.toHaveBeenCalled();
    expect(creem.writes()).toHaveLength(writesBefore);
  });

  it.each([
    ["no meta", {}],
    ["no total", { meta: { page: {} } }],
    ["a negative total", { meta: { page: { total: -1 } } }],
    ["a string total", { meta: { page: { total: "3" } } }],
  ])("treats a count response with %s as a fetch failure", async (_, extra) => {
    const ls = lemonSqueezyFetch();
    failCounts(ls, () => Response.json({ data: [], links: { next: null }, ...extra }));
    const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
    const { objects, failures } = await fetchLemonSqueezyCatalog(client, {
      storeId: LS_STORE_ID,
      excludeDiscounts: false,
      downloadDir,
    });
    expect(failures).toEqual([
      { kind: "redemptions of discount 930002", message: expect.stringContaining("no count") },
    ]);
    expect(objects.discountRedemptions).toEqual({});
  });

  it("never gives back redemptions used in Creem: the cap is what LS left, whatever Creem counted", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const creem = fakeCreem();
    await migrate(creem, { docs });
    const stored = creem.state.discounts.find((d) => d.code === "APPFIVE")!;
    stored.redeem_count = 3;
    const plan = async () => {
      const { objects } = await lsObjects({ docs });
      return fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    };
    expect(findItem(await plan(), "ls_discount_930002").action).toBe("unchanged");
    docs.redemptions["930002"] = 95;
    const p = await plan();
    const update = p.requests.find((r) => r.key === "ls_discount_930002")!.request as any;
    expect(update.createDiscountRequestEntity).toEqual({
      maxRedemptions: 5,
      externalId: "ls_discount_930002",
    });
  });

  it("adopts an unkeyed Creem code with Creem redemptions and sets the cap to what LS left", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const creem = fakeCreem();
    await migrate(creem, { docs });
    const stored = creem.state.discounts.find((d) => d.code === "APPFIVE")!;
    stored.external_id = null;
    stored.redeem_count = 2;
    stored.max_redemptions = 50;
    const { objects } = await lsObjects({ docs });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), {
      now: NOW,
      adoption: { "adopt:ls_discount_930002": stored.id },
    });
    const update = p.requests.find(
      (r) => r.key === "ls_discount_930002" && r.type === "upsert_discount",
    )!.request as any;
    expect(update.createDiscountRequestEntity.maxRedemptions).toBe(10);
  });
});

describe("redemption counts: review round 2", () => {
  it("never sets the Creem limit below what Creem already redeemed, and says the cap is used up", async () => {
    const docs = lemonSqueezyDocs();
    docs.redemptions["930002"] = 90;
    const creem = fakeCreem();
    await migrate(creem, { docs });
    const stored = creem.state.discounts.find((d) => d.code === "APPFIVE")!;
    stored.redeem_count = 8;
    docs.redemptions["930002"] = 95;
    const { plan, report } = await migrate(creem, { docs });
    const update = plan.requests.find(
      (r) => r.key === "ls_discount_930002" && r.type === "upsert_discount",
    )!.request as any;
    expect(update.createDiscountRequestEntity).toEqual({
      maxRedemptions: 8,
      externalId: "ls_discount_930002",
    });
    expect(findItem({ report }, "ls_discount_930002")).toMatchObject({
      status: "done",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "discount_redemptions_exhausted" }),
      ]),
    });
    expect(stored.max_redemptions).toBe(8);
    const again = await migrate(creem, { docs });
    expect(findItem(again, "ls_discount_930002").action).toBe("unchanged");
  });

  it("claims no discount is missing in LS when the discounts couldn't be read", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const ls = lemonSqueezyFetch();
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (
        new URL(String(input instanceof Request ? input.url : input)).pathname === "/v1/discounts"
      )
        return new Response("down", { status: 503 });
      return fetcher(input, init);
    });
    const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
    const { objects, failures } = await fetchLemonSqueezyCatalog(client, {
      storeId: LS_STORE_ID,
      excludeDiscounts: false,
      downloadDir,
    });
    expect(failures.map((f) => f.kind)).toEqual(["discounts"]);
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(p.report.items.filter((i) => i.kind === "discount")).toEqual([]);
  });

  it("doesn't call a keyed discount orphaned when only its count couldn't be read", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const ls = lemonSqueezyFetch();
    const fetcher = ls.fetcher.getMockImplementation()!;
    ls.fetcher.mockImplementation(async (input, init) => {
      if (String(input instanceof Request ? input.url : input).includes("discount-redemptions"))
        return new Response("nope", { status: 403 });
      return fetcher(input, init);
    });
    const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
    const { objects } = await fetchLemonSqueezyCatalog(client, {
      storeId: LS_STORE_ID,
      excludeDiscounts: false,
      downloadDir,
    });
    const p = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    expect(findItem(p, "ls_discount_930002")).toMatchObject({
      action: "skip",
      reason: { code: "discount_redemptions_unknown" },
      warnings: [],
    });
  });

  it("reads no count for a limited code that is a draft or expired", async () => {
    const docs = lemonSqueezyDocs();
    const appFive = docs.discounts.data.find((d) => d.id === "930002")!;
    for (const attributes of [
      { ...appFive.attributes, status: "draft" },
      { ...appFive.attributes, expires_at: "2020-01-01T00:00:00.000Z" },
    ]) {
      appFive.attributes = attributes;
      const { ls, failures } = await lsObjects({ docs });
      expect(failures).toEqual([]);
      expect(ls.lsRequests.some((r) => r.startsWith("/v1/discount-redemptions"))).toBe(false);
    }
  });
});
