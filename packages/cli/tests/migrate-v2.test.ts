import { join } from "node:path";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { harness } from "./helpers";
import {
  LS_STORE_ID,
  fakeCreem,
  lemonSqueezyFetch,
  productGroupJson,
  productJson,
  type CreemCall,
  type CreemState,
} from "./migrate-fixtures";
import { DryRunIgnoredError, checkMigration, executeMigration } from "../src/lib/migration/writer";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
} from "../src/lib/migration/lemon-squeezy/source";
import { fromLemonSqueezy } from "../src/lib/migration/lemon-squeezy/map";
import { readCreemCatalog } from "../src/lib/migration/catalog";
import { MIGRATION_EXIT_CODES } from "../src/lib/migration/report";

/**
 * ENG-2972: the migrator writes through the keyed upserts, dry-runs every
 * request and validates the products before the first write.
 */
const NOW = new Date("2026-11-19T12:00:00.000Z");
const V1_STORE: CreemState = JSON.parse(
  readFileSync(
    join(__dirname, "fixtures", "lemon-squeezy", "golden", "v1-migrated-store.state.json"),
    "utf8",
  ),
);
let downloadDir = "";
beforeEach(() => {
  downloadDir = mkdtempSync(join(tmpdir(), "creem-ls-v2-"));
});
afterEach(() => {
  rmSync(downloadDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

async function lsObjects() {
  const ls = lemonSqueezyFetch();
  const client = new LemonSqueezyClient("ls_fixture_key", { fetch: ls.fetcher, delayMs: 0 });
  const { objects } = await fetchLemonSqueezyCatalog(client, {
    storeId: LS_STORE_ID,
    excludeDiscounts: false,
    downloadDir,
  });
  return objects;
}

/** What the command does: plan, check with Creem, then write. */
async function migrate(creem: ReturnType<typeof fakeCreem>, options: { force?: boolean } = {}) {
  const objects = await lsObjects();
  const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
  const checked = await checkMigration(creem.client, plan, {});
  const slot = lemonSqueezyFetch();
  const report = await executeMigration(creem.client, checked, {
    files: objects.fileDigests,
    fetch: slot.fetcher,
    delayMs: 0,
    force: options.force,
  });
  return { plan, checked, report, slotPosts: slot.slotPosts };
}

const CATALOG_WRITE = /^\/v1\/(products|product-groups|discounts)(\/|$)/;
const describeCall = (c: CreemCall) => `${c.method} ${c.path}${c.dryRun ? "?dry_run=true" : ""}`;

describe("ENG-2972: every catalog write is a keyed upsert", () => {
  it("writes an empty store with POSTs keyed by external_id, files aside, and no PATCH", async () => {
    const creem = fakeCreem();
    const { report } = await migrate(creem);
    expect(report.summary.failed).toBe(0);
    const writes = creem.writes();
    const catalog = writes.filter((c) => CATALOG_WRITE.test(c.path));
    expect(catalog.length).toBeGreaterThan(0);
    for (const write of catalog) {
      expect(write.method, describeCall(write)).toBe("POST");
      expect(write.path).toMatch(/^\/v1\/(products|product-groups|discounts)$/);
      expect(write.body?.external_id).toMatch(/^ls_(variant|product|discount)_\d+$/);
    }
    expect(writes.filter((c) => !CATALOG_WRITE.test(c.path)).map(describeCall)).toEqual([
      "POST /v1/files",
      "POST /v1/files/file_1/confirm",
    ]);
  });

  it("creates the product group of an LS product's recurring variants with its members by key", async () => {
    const creem = fakeCreem();
    const { report } = await migrate(creem);
    const group = report.items.find((i) => i.key === "ls_product_262308")!;
    expect(group).toMatchObject({ kind: "product_group", action: "create", status: "done" });
    expect(group.creem_id).toBe(creem.state.productGroups[0].id);
    const write = creem.writes().find((c) => c.path === "/v1/product-groups")!;
    expect(write.body).toEqual({
      external_id: "ls_product_262308",
      name: "Pro Armitage subsription",
      products: [{ external_id: "ls_variant_365902" }, { external_id: "ls_variant_752120" }],
    });
    expect(
      creem.state.productGroups[0].products.map((p: { external_id: string }) => p.external_id),
    ).toEqual(["ls_variant_365902", "ls_variant_752120"]);
  });

  it("can't race another run into duplicates: a stale plan updates what the other run created", async () => {
    const creem = fakeCreem();
    const objects = await lsObjects();
    // Both runs read the empty store before either writes.
    const stale = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    await migrate(creem);
    const before = structuredClone(creem.state);
    const checked = await checkMigration(creem.client, stale, {});
    const report = await executeMigration(creem.client, checked, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    expect(report.summary.failed).toBe(0);
    const keys = (state: CreemState) => state.products.map((p) => p.external_id);
    expect(keys(creem.state)).toEqual(keys(before));
    expect(creem.state.discounts).toEqual(before.discounts);
    expect(creem.state.productGroups).toEqual(before.productGroups);
    // Files have no key, so the stale plan uploads the file again and swaps it in
    // (as v1 does); every other product stays as the other run wrote it.
    const withoutFile = (state: CreemState) =>
      state.products.filter((p) => p.external_id !== "ls_variant_910001");
    expect(withoutFile(creem.state)).toEqual(withoutFile(before));
    for (const item of report.items.filter((i) => i.kind !== "file" && i.action !== "skip"))
      expect([item.key, item.action]).toEqual([
        item.key,
        item.key === "ls_variant_910001" ? "update" : "unchanged",
      ]);
  });
});

describe("ENG-2972: a run that another run raced ahead of", () => {
  it("takes the Creem id of a product the check finds already there, so a discount it writes keeps that product", async () => {
    const creem = fakeCreem();
    const objects = await lsObjects();
    const stale = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    // The other run wrote the products only, then stopped.
    await migrate(creem);
    creem.state.discounts = [];
    const checked = await checkMigration(creem.client, stale, {});
    const product = checked.report.items.find((i) => i.key === "ls_variant_752120")!;
    expect(product).toMatchObject({ action: "unchanged", status: null });
    expect(product.creem_id).toBe(
      creem.state.products.find((p) => p.external_id === "ls_variant_752120")!.id,
    );
    const report = await executeMigration(creem.client, checked, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    const discount = report.items.find((i) => i.key === "ls_discount_930001")!;
    expect(discount.warnings.map((w) => w.code)).not.toContain("product_not_written");
    expect(
      creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!
        .applies_to_products,
    ).toHaveLength(7);
  });
});

describe("ENG-2972: every request dry-runs first", () => {
  it("validates, then dry-runs every write right before it, and nothing is written before the check", async () => {
    const creem = fakeCreem();
    await migrate(creem);
    const sent = creem.calls.filter((c) => c.method !== "GET");
    expect(describeCall(sent[0])).toBe("POST /v1/catalog/validate");
    const firstWrite = sent.findIndex((c) => !c.dryRun && c.path !== "/v1/catalog/validate");
    // The check: validate for products, a dry run for each group and discount.
    expect(sent.slice(0, firstWrite).map(describeCall)).toEqual([
      "POST /v1/catalog/validate",
      "POST /v1/product-groups?dry_run=true",
      "POST /v1/discounts?dry_run=true",
      "POST /v1/discounts?dry_run=true",
    ]);
    const run = sent.slice(firstWrite);
    run.forEach((call, index) => {
      if (call.dryRun || !CATALOG_WRITE.test(call.path)) return;
      const previous = run[index - 1];
      expect(previous, describeCall(call)).toMatchObject({
        method: call.method,
        path: call.path,
        body: call.body,
        dryRun: true,
      });
    });
    expect(run.filter((c) => c.dryRun).length).toBe(
      run.filter((c) => !c.dryRun && CATALOG_WRITE.test(c.path)).length,
    );
  });

  it("stops before anything else is written when Creem answers a dry run as a real write", async () => {
    // From the store v1 left, the first request after validate is the group's dry run.
    const creem = fakeCreem(V1_STORE, { ignoreDryRun: true });
    const objects = await lsObjects();
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    await expect(checkMigration(creem.client, plan, {})).rejects.toBeInstanceOf(DryRunIgnoredError);
    // Validate wrote nothing; the first dry run that came back as a write is the last request.
    const sent = creem.calls.filter((c) => c.method !== "GET");
    expect(sent.at(-1)!.dryRun).toBe(true);
    expect(sent.filter((c) => c.dryRun)).toHaveLength(1);
  });

  it("refuses a dry run whose answer has no write_result (a server without the dry run)", async () => {
    const creem = fakeCreem();
    creem.fail((c) => c.path === "/v1/catalog/validate", 200, {
      object: "catalog_validation",
      valid: true,
      items: [],
    });
    const objects = await lsObjects();
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    await expect(checkMigration(creem.client, plan, {})).rejects.toThrow(/validate/i);
  });
});

describe("ENG-2972: validate before the first write", () => {
  it("writes nothing when Creem refuses an item, and reports the item with Creem's error", async () => {
    const creem = fakeCreem();
    creem.refuse("ls_variant_752120", 409, "license_keys_issued", "Keys were issued.");
    const objects = await lsObjects();
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    const checked = await checkMigration(creem.client, plan, {});
    const item = checked.report.items.find((i) => i.key === "ls_variant_752120")!;
    expect(item).toMatchObject({
      status: "failed",
      error: { code: "license_keys_issued", status: 409 },
    });
    await expect(
      executeMigration(creem.client, checked, {
        files: objects.fileDigests,
        fetch: lemonSqueezyFetch().fetcher,
        delayMs: 0,
      }),
    ).rejects.toThrow(/refused/);
    expect(creem.writes()).toEqual([]);
  });

  it("with force, writes the rest and leaves the refused product out of its group and discounts", async () => {
    const creem = fakeCreem();
    creem.refuse("ls_variant_752120", 409, "license_keys_issued", "Keys were issued.");
    const { report } = await migrate(creem, { force: true });
    expect(report.items.find((i) => i.key === "ls_variant_752120")).toMatchObject({
      status: "failed",
      error: { code: "license_keys_issued" },
    });
    expect(creem.state.products.map((p) => p.external_id)).not.toContain("ls_variant_752120");
    expect(creem.writes().some((c) => c.body?.external_id === "ls_variant_752120")).toBe(false);
    // One member left is no group.
    expect(report.items.find((i) => i.key === "ls_product_262308")).toMatchObject({
      status: "failed",
      error: { code: "dependency_failed" },
    });
    expect(creem.state.productGroups).toEqual([]);
    const discount = report.items.find((i) => i.key === "ls_discount_930001")!;
    expect(discount.status).toBe("done");
    expect(discount.warnings.map((w) => w.code)).toContain("product_not_written");
  });

  it("validates more than 100 products in batches of 100", async () => {
    const creem = fakeCreem();
    const objects = await lsObjects();
    const base = objects.variants.find((v) => v.attributes.status === "published")!;
    for (let i = 0; i < 120; i++)
      objects.variants.push({
        ...structuredClone(base),
        id: String(800000 + i),
      });
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    await checkMigration(creem.client, plan, {});
    const sizes = creem.validations().map((c) => (c.body!.items as unknown[]).length);
    expect(sizes.every((n) => n <= 100)).toBe(true);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeGreaterThan(100);
  });
});

describe("ENG-2972: a store v1 migrated", () => {
  it("re-run with v2 reports every item v1 wrote unchanged and writes only the product group v1 left to the merchant", async () => {
    const creem = fakeCreem(V1_STORE);
    const { report } = await migrate(creem);
    expect(report.summary.failed).toBe(0);
    for (const item of report.items) {
      if (item.action === "skip") continue;
      if (item.kind === "product_group") expect(item.action).toBe("create");
      else expect([item.key, item.action]).toEqual([item.key, "unchanged"]);
    }
    expect(creem.writes().map(describeCall)).toEqual(["POST /v1/product-groups"]);
    expect(creem.state.products).toEqual(V1_STORE.products);
    expect(creem.state.discounts).toEqual(V1_STORE.discounts);
  });

  it("re-run once more reports every item unchanged and sends no write and no dry run", async () => {
    const creem = fakeCreem(V1_STORE);
    await migrate(creem);
    const sentBefore = creem.calls.length;
    const { report } = await migrate(creem);
    for (const item of report.items.filter((i) => i.action !== "skip"))
      expect([item.key, item.action]).toEqual([item.key, "unchanged"]);
    expect(creem.calls.slice(sentBefore).filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("reports a product group the merchant made in the dashboard as Creem refuses it, with the command that gives it the key", async () => {
    const products = V1_STORE.products.filter((p) =>
      ["ls_variant_365902", "ls_variant_752120"].includes(p.external_id),
    );
    const creem = fakeCreem({
      ...V1_STORE,
      productGroups: [
        productGroupJson("pgrp_dash", {
          name: "Pro",
          products: products.map((p) => ({ id: p.id, external_id: p.external_id })),
        }),
      ],
    });
    const objects = await lsObjects();
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    const checked = await checkMigration(creem.client, plan, {});
    const group = checked.report.items.find((i) => i.key === "ls_product_262308")!;
    expect(group).toMatchObject({
      status: "failed",
      error: { code: "product_already_grouped", status: 409 },
    });
    expect(group.error!.hint).toContain(
      "creem product-groups update pgrp_dash --external-id ls_product_262308",
    );
  });
});

describe("ENG-2972: an upsert sends only what it changes", () => {
  it("keeps a merchant's abandoned cart recovery when it updates a product", async () => {
    const store = structuredClone(V1_STORE);
    const icons = store.products.find((p) => p.external_id === "ls_variant_910001")!;
    icons.abandoned_cart_recovery_enabled = true;
    icons.name = "Renamed in Creem";
    const creem = fakeCreem(store);
    const { report } = await migrate(creem);
    expect(report.items.find((i) => i.key === "ls_variant_910001")).toMatchObject({
      action: "update",
      changes: ["name"],
      status: "done",
    });
    const write = creem.writes().find((c) => c.body?.external_id === "ls_variant_910001")!;
    expect(write.body).toEqual({ external_id: "ls_variant_910001", name: "Icon Pack" });
    expect(
      creem.state.products.find((p) => p.external_id === "ls_variant_910001")!
        .abandoned_cart_recovery_enabled,
    ).toBe(true);
  });
});

describe("ENG-2972: creem migrate lemon-squeezy", () => {
  const base = [
    "migrate",
    "lemon-squeezy",
    "--ls-api-key",
    "ls_fixture_secret_key",
    "--ls-store-id",
    LS_STORE_ID,
  ];
  function setup(initial: Partial<CreemState> = {}) {
    vi.stubGlobal("fetch", lemonSqueezyFetch().fetcher);
    const creem = fakeCreem(initial);
    const h = harness(creem.client, { isTTY: false, confirm: vi.fn(async () => false) });
    return { creem, h };
  }

  it("--dry-run is Creem's dry run: it validates and dry-runs, and writes and uploads nothing", async () => {
    const { creem, h } = setup();
    const r = await h.run(["--json", ...base, "--dry-run"]);
    expect(r.code, r.stderr).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.mode).toBe("dry_run");
    expect(creem.validations()).toHaveLength(1);
    expect(creem.dryRuns().length).toBeGreaterThan(0);
    expect(creem.writes()).toEqual([]);
  });

  it("exits 8 and writes nothing when Creem refuses an item; --force writes the rest and exits 6", async () => {
    const refused = setup();
    refused.creem.refuse("ls_variant_752120", 409, "license_keys_issued");
    const r = await refused.h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(MIGRATION_EXIT_CODES.validationFailed);
    expect(
      JSON.parse(r.stdout).items.find((i: { key: string }) => i.key === "ls_variant_752120"),
    ).toMatchObject({ status: "failed", error: { code: "license_keys_issued" } });
    expect(refused.creem.writes()).toEqual([]);
    expect(r.stderr).toContain("--force");

    const forced = setup();
    forced.creem.refuse("ls_variant_752120", 409, "license_keys_issued");
    const f = await forced.h.run(["--json", ...base, "--yes", "--force"]);
    expect(f.code).toBe(MIGRATION_EXIT_CODES.itemsFailed);
    expect(forced.creem.state.products).toHaveLength(6);
  });

  it("a --dry-run preview exits 8 when Creem refuses an item", async () => {
    const { creem, h } = setup();
    creem.refuse("ls_discount_930001", 409, "discount_redeemed");
    const r = await h.run(["--json", ...base, "--dry-run"]);
    expect(r.code).toBe(MIGRATION_EXIT_CODES.validationFailed);
    expect(creem.writes()).toEqual([]);
  });

  it("exits 1 and stops when Creem answers a dry run as a real write", async () => {
    vi.stubGlobal("fetch", lemonSqueezyFetch().fetcher);
    const creem = fakeCreem(V1_STORE, { ignoreDryRun: true });
    const h = harness(creem.client, { isTTY: false, confirm: vi.fn(async () => false) });
    const r = await h.run(["--json", ...base, "--yes"]);
    expect(r.code).toBe(MIGRATION_EXIT_CODES.unexpected);
    expect(r.stderr).toContain("dry_run");
  });
});

/** Plan and check from the current stores, with adoption answers. */
async function checked(creem: ReturnType<typeof fakeCreem>, adoption?: Record<string, string>) {
  const objects = await lsObjects();
  const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), {
    now: NOW,
    adoption,
  });
  return { objects, plan, checked: await checkMigration(creem.client, plan, {}) };
}

describe("ENG-2972 review: an adopted object with changes is one PATCH by id", () => {
  it("adopts an unkeyed discount whose name changed: the check passes, and one PATCH gives it the key and the name", async () => {
    const store = structuredClone(V1_STORE);
    const launch = store.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    launch.external_id = null;
    launch.name = "Name changed by the merchant";
    const creem = fakeCreem(store);
    const {
      objects,
      plan,
      checked: result,
    } = await checked(creem, {
      "adopt:ls_discount_930001": launch.id,
    });
    expect(plan.requests.filter((r) => r.key === "ls_discount_930001")).toEqual([
      {
        type: "adopt_discount",
        key: "ls_discount_930001",
        request: {
          id: launch.id,
          updateDiscountRequestEntity: { externalId: "ls_discount_930001", name: "Launch" },
        },
      },
    ]);
    const item = result.report.items.find((i) => i.key === "ls_discount_930001")!;
    expect(item).toMatchObject({ status: "pending", action: "update", adopted_from: launch.id });
    const report = await executeMigration(creem.client, result, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    expect(report.items.find((i) => i.key === "ls_discount_930001")!.status).toBe("done");
    const writes = creem.writes().filter((c) => c.path.startsWith("/v1/discounts"));
    expect(writes.map(describeCall)).toEqual([`PATCH /v1/discounts/${launch.id}`]);
    expect(writes[0].body).toEqual({ external_id: "ls_discount_930001", name: "Launch" });
    expect(creem.state.discounts.find((d) => d.id === launch.id)).toMatchObject({
      external_id: "ls_discount_930001",
      name: "Launch",
    });
  });

  it("adopts an unkeyed product whose name changed with one PATCH by id, and sends no keyed upsert for it", async () => {
    const store = structuredClone(V1_STORE);
    const app = store.products.find((p) => p.external_id === "ls_variant_910007")!;
    app.external_id = null;
    app.name = "Desktop App (old)";
    const creem = fakeCreem(store);
    const {
      objects,
      plan,
      checked: result,
    } = await checked(creem, {
      "adopt:ls_variant_910007": app.id,
    });
    expect(plan.requests.filter((r) => r.key === "ls_variant_910007")).toEqual([
      {
        type: "adopt_product",
        key: "ls_variant_910007",
        request: {
          id: app.id,
          updateProductRequestEntity: { externalId: "ls_variant_910007", name: "Desktop App" },
        },
      },
    ]);
    await executeMigration(creem.client, result, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    const writes = creem
      .writes()
      .filter(
        (c) => c.path === `/v1/products/${app.id}` || c.body?.external_id === "ls_variant_910007",
      );
    expect(writes.map(describeCall)).toEqual([`PATCH /v1/products/${app.id}`]);
    expect(creem.state.products.find((p) => p.id === app.id)).toMatchObject({
      external_id: "ls_variant_910007",
      name: "Desktop App",
    });
  });
});

describe("ENG-2972 review: validate batches can't split an adoption from its changes", () => {
  it("checks 120 adoptions with changes in batches of 100, each one request, none refused", async () => {
    const objects = await lsObjects();
    const base = objects.variants.find((v) => v.attributes.status === "published")!;
    const adoption: Record<string, string> = {};
    const products = [];
    for (let i = 0; i < 120; i++) {
      const id = String(800000 + i);
      objects.variants.push({ ...structuredClone(base), id });
      products.push(productJson(`prod_adopt_${i}`, { name: `Old name ${i}`, price: 1 }));
      adoption[`adopt:ls_variant_${id}`] = `prod_adopt_${i}`;
    }
    const creem = fakeCreem({ products });
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), {
      now: NOW,
      adoption,
    });
    for (const key of Object.keys(adoption).map((a) => a.slice("adopt:".length)))
      expect(plan.requests.filter((r) => r.key === key).map((r) => r.type)).toEqual([
        "adopt_product",
      ]);
    const result = await checkMigration(creem.client, plan, {});
    expect(creem.validations().length).toBeGreaterThan(1);
    expect(result.report.items.filter((i) => i.status === "failed")).toEqual([]);
  });
});

describe("ENG-2972 review: a group or discount that gains a product this run creates", () => {
  it("adds a newly published subscription variant to the existing group and discount in the same run", async () => {
    const creem = fakeCreem(V1_STORE);
    await migrate(creem);
    const objects = await lsObjects();
    const variant = structuredClone(objects.variants.find((v) => v.id === "752120")!);
    variant.id = "999001";
    variant.attributes.name = "Added tier";
    objects.variants.push(variant);
    const plan = fromLemonSqueezy(objects, await readCreemCatalog(creem.client), { now: NOW });
    const result = await checkMigration(creem.client, plan, {});
    for (const key of ["ls_product_262308", "ls_discount_930001"])
      expect(result.report.items.find((i) => i.key === key)).toMatchObject({
        action: "update",
        status: "pending",
      });
    const report = await executeMigration(creem.client, result, {
      files: objects.fileDigests,
      fetch: lemonSqueezyFetch().fetcher,
      delayMs: 0,
    });
    expect(report.summary.failed).toBe(0);
    const added = creem.state.products.find((p) => p.external_id === "ls_variant_999001")!;
    expect(
      creem.state.productGroups[0].products.map((p: { external_id: string }) => p.external_id),
    ).toContain("ls_variant_999001");
    expect(
      creem.state.discounts.find((d) => d.external_id === "ls_discount_930001")!
        .applies_to_products,
    ).toContain(added.id);
  });

  it("a dry-run discount update that names an unknown key keeps the stored products, like the API", async () => {
    const creem = fakeCreem(V1_STORE);
    const launch = V1_STORE.discounts.find((d) => d.external_id === "ls_discount_930001")!;
    const answer = await creem.client.discounts.update({
      id: launch.id,
      dryRun: true,
      updateDiscountRequestEntity: {
        appliesToProducts: ["prod_2"],
        appliesToProductExternalIds: ["ls_variant_910001", "ls_variant_unknown"],
      },
    });
    expect(answer.appliesToProducts).toEqual(launch.applies_to_products);
    expect(answer.writeResult.result).toBe("unchanged");
    expect(answer.writeResult.warnings).toEqual([
      expect.objectContaining({ code: "reference_not_found", key: "ls_variant_unknown" }),
    ]);
  });
});
