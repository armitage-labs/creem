import { describe, it, expect } from "vitest";
import { fakeCatalog, featureJson, meterJson, sideProduct, type Catalog } from "./promote-fixtures";

/**
 * The two-sided store behind the `creem catalog` tests answers as the API
 * documents promote (ENG-2279, pugpay #4299) and the product and meter
 * PATCHes, through the real SDK.
 */
const store = (): { test: Partial<Catalog>; live: Partial<Catalog> } => ({
  test: {
    meters: [
      meterJson("mtr_t1", { external_id: "api-calls", name: "API calls", event_name: "api.call" }),
    ],
    products: [
      sideProduct("test", "prod_t1", { name: "Pro", external_id: "pro" }),
      sideProduct("test", "prod_t2", { name: "Team", price: 3000 }),
    ],
  },
  live: {
    meters: [
      meterJson("mtr_l1", { external_id: "api-calls", name: "API calls", event_name: "api.call" }),
    ],
    products: [
      sideProduct("live", "prod_l1", { name: "Pro", external_id: "pro" }),
      sideProduct("live", "prod_l2", { name: "team", price: 2000 }),
    ],
  },
});

describe("fakeCatalog models promote and the pairing writes", () => {
  it("answers a dry run per item, writes nothing, and proposes a key with ranked candidates", async () => {
    const fake = fakeCatalog(store());
    const page = await fake.live.catalog.promote({ dryRun: true, catalogPromoteRequestDto: {} });
    expect(page.dryRun).toBe(true);
    expect(page.nextCursor).toBeNull();
    expect(page.validation).toBeNull();
    expect(page.items.map((i) => [i.testId, i.result])).toEqual([
      ["mtr_t1", "unchanged"],
      ["prod_t1", "unchanged"],
      ["prod_t2", "needs_key"],
    ]);
    const team = page.items[2];
    expect(team.proposedExternalId).toBe("prod_t2");
    expect(team.candidates).toEqual([
      expect.objectContaining({ liveId: "prod_l2", externalId: null, differences: ["price"] }),
    ]);
    expect(page.items[0].writeResult).toMatchObject({ dry_run: true, result: "unchanged" });
    expect(page.summary).toMatchObject({ unchanged: 2, needsKey: 1 });
    expect(fake.writes()).toEqual([]);
  });

  it("pages by next_cursor, bound to select and dry_run", async () => {
    const fake = fakeCatalog(store(), { pageSize: 2 });
    const first = await fake.live.catalog.promote({ dryRun: true, catalogPromoteRequestDto: {} });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { cursor: first.nextCursor },
    });
    expect(second.runId).toBe(first.runId);
    expect(second.items.map((i) => i.testId)).toEqual(["prod_t2"]);
    expect(second.nextCursor).toBeNull();
    await expect(
      fake.live.catalog.promote({ catalogPromoteRequestDto: { cursor: first.nextCursor } }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("checks before the first write: a refused item stops every write unless forced", async () => {
    const initial = store();
    initial.test.products![0].name = "Pro Plan";
    initial.test.meters![0].name = "API requests";
    const fake = fakeCatalog(initial);
    fake.refuse("mtr_t1", 409, "meter_in_use");
    const held = await fake.live.catalog.promote({ catalogPromoteRequestDto: {} });
    expect(held.validation).toEqual({
      scope: "selection",
      batches: 1,
      checkedBatches: 1,
      passed: false,
      written: false,
    });
    expect(held.items.map((i) => [i.testId, i.result, i.error?.code])).toEqual([
      ["mtr_t1", "conflict", "meter_in_use"],
      ["prod_t1", "not_written", "promote_check_failed"],
      ["prod_t2", "needs_key", undefined],
    ]);
    expect(fake.stores.live.products[0].name).toBe("Pro");
    const forced = await fake.live.catalog.promote({ catalogPromoteRequestDto: { force: true } });
    expect(forced.validation).toMatchObject({ passed: false, written: true });
    expect(forced.items[1]).toMatchObject({ testId: "prod_t1", result: "updated" });
    expect(fake.stores.live.products[0].name).toBe("Pro Plan");
  });

  it("answers the check's progress on pages without items before it writes", async () => {
    const fake = fakeCatalog(store(), { checkBatches: 2 });
    const first = await fake.live.catalog.promote({ catalogPromoteRequestDto: {} });
    expect(first.items).toEqual([]);
    expect(first.validation).toMatchObject({ batches: 2, checkedBatches: 1, passed: null });
    const second = await fake.live.catalog.promote({
      catalogPromoteRequestDto: { cursor: first.nextCursor },
    });
    expect(second.validation).toMatchObject({ checkedBatches: 2, passed: true, written: true });
    expect(second.items).toHaveLength(3);
  });

  it("reports the live-only metadata conflict, blocked products, feature candidates and possible_rename", async () => {
    const fake = fakeCatalog({
      test: {
        meters: [meterJson("mtr_t9")],
        products: [
          sideProduct("test", "prod_t1", { external_id: "pro", metadata: { plan: "pro" } }),
          sideProduct("test", "prod_t3", {
            usage_prices: [{ meter_id: "mtr_t9" }],
            external_id: "u",
          }),
          sideProduct("test", "prod_t4", {
            external_id: "seats",
            features: [featureJson("feat_t1", "custom", "Onboarding call")],
          }),
          sideProduct("test", "prod_t5", { name: "Starter", external_id: "starter-2" }),
        ],
      },
      live: {
        products: [
          sideProduct("live", "prod_l1", {
            external_id: "pro",
            metadata: { plan: "pro", stripe_lookup_key: "pro_m" },
          }),
          sideProduct("live", "prod_l4", {
            external_id: "seats",
            features: [featureJson("feat_l1", "custom", "Kickoff call")],
          }),
          sideProduct("live", "prod_l5", { name: "Starter", external_id: "starter" }),
        ],
      },
    });
    const page = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { select: { products: "all" } },
    });
    const byId = Object.fromEntries(page.items.map((i) => [i.testId, i]));
    expect(byId.prod_t1).toMatchObject({
      result: "conflict",
      error: { code: "live_metadata_not_in_test", details: { keys: ["stripe_lookup_key"] } },
    });
    expect(byId.prod_t3).toMatchObject({
      result: "blocked",
      blockedBy: { kind: "meter", testId: "mtr_t9" },
    });
    expect(byId.prod_t4).toMatchObject({
      result: "needs_key",
      liveId: "prod_l4",
      featureCandidates: [
        {
          testFeatureId: "feat_t1",
          proposedExternalId: "feat_t1",
          candidates: [{ liveFeatureId: "feat_l1", externalId: null, description: "Kickoff call" }],
        },
      ],
    });
    expect(byId.prod_t5).toMatchObject({
      result: "created",
      candidates: [expect.objectContaining({ liveId: "prod_l5", externalId: "starter" })],
    });
    expect(byId.prod_t5.writeResult?.warnings).toEqual([
      { code: "possible_rename", path: "external_id" },
    ]);
  });

  it("promotes usage prices by the meter's key: a usage-price-only change is updated, and the live price names the live meter", async () => {
    const initial = store();
    const usage = (meterId: string, unitPrice: number) => [
      { meter_id: meterId, unit_price: unitPrice, free_allowance: 100, settlement_mode: "arrears" },
    ];
    initial.test.products![0].usage_prices = usage("mtr_t1", 5);
    initial.live.products![0].usage_prices = usage("mtr_l1", 2);
    const fake = fakeCatalog(initial);
    const preview = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { select: { products: ["prod_t1"] } },
    });
    expect(preview.items[0]).toMatchObject({ testId: "prod_t1", result: "updated" });
    expect(preview.items[0].writeResult?.changes).toEqual([
      { path: "usage_prices", from: usage("mtr_l1", 2), to: usage("mtr_l1", 5) },
    ]);
    const run = await fake.live.catalog.promote({
      catalogPromoteRequestDto: { select: { products: ["prod_t1"] } },
    });
    expect(run.items[0].result).toBe("updated");
    expect(fake.stores.live.products[0].usage_prices).toEqual(usage("mtr_l1", 5));
    const again = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { select: { products: ["prod_t1"] } },
    });
    expect(again.items[0].result).toBe("unchanged");
  });

  it("clears live's usage prices when test has none, and creates a usage-priced product with the live meter", async () => {
    const initial = store();
    initial.live.products![0].usage_prices = [{ meter_id: "mtr_l1", unit_price: 2 }];
    initial.test.products!.push(
      sideProduct("test", "prod_t3", {
        name: "Metered",
        external_id: "metered",
        usage_prices: [{ meter_id: "mtr_t1", unit_price: 7 }],
      }),
    );
    const fake = fakeCatalog(initial);
    const run = await fake.live.catalog.promote({
      catalogPromoteRequestDto: { select: { products: ["prod_t1", "prod_t3"] } },
    });
    expect(run.items.map((i) => [i.testId, i.result])).toEqual([
      ["prod_t1", "updated"],
      ["prod_t3", "created"],
    ]);
    expect(fake.stores.live.products[0].usage_prices).toEqual([]);
    expect(fake.stores.live.products.at(-1)?.usage_prices).toEqual([
      { meter_id: "mtr_l1", unit_price: 7 },
    ]);
  });

  it("sends a custom billing period's interval fields", async () => {
    const initial = store();
    const custom = {
      billing_type: "recurring",
      billing_period: "custom",
      recurring_interval: "week",
      recurring_interval_count: 2,
    };
    Object.assign(initial.test.products![0], custom);
    Object.assign(initial.live.products![0], { ...custom, recurring_interval_count: 3 });
    const fake = fakeCatalog(initial);
    const preview = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { select: { products: ["prod_t1"] } },
    });
    expect(preview.items[0].writeResult?.changes).toEqual([
      { path: "recurring_interval_count", from: 3, to: 2 },
    ]);
  });

  it("warns about feature types promote doesn't copy and about files the export flagged", async () => {
    const initial = store();
    initial.test.products![0].features = [
      featureJson("feat_t1", "custom", "Support"),
      { id: "feat_t9", type: "file", description: "Download", external_id: null },
      { id: "feat_t8", type: "githubRepository", description: "Repo", external_id: null },
    ];
    initial.live.products![0].features = [featureJson("feat_l1", "custom", "Support")];
    const fake = fakeCatalog(initial);
    fake.flagFiles("prod_t1", "file_missing", ["file_1"]);
    const preview = await fake.live.catalog.promote({
      dryRun: true,
      catalogPromoteRequestDto: { select: { products: ["prod_t1"] } },
    });
    expect(preview.items[0].result).toBe("unchanged");
    expect(preview.items[0].writeResult?.warnings).toEqual([
      { code: "feature_type_not_promoted", path: "features[type=file]" },
      { code: "file_missing", path: "files", key: "file_1" },
    ]);
  });

  it("refuses promote on the test API", async () => {
    const fake = fakeCatalog(store());
    await expect(fake.test.catalog.promote({ catalogPromoteRequestDto: {} })).rejects.toMatchObject(
      { statusCode: 400, body: expect.stringContaining("live_only") },
    );
  });

  it("PATCHes a key with a dry run, and answers 409 external_id_taken for a held key", async () => {
    const fake = fakeCatalog(store());
    const preview = await fake.live.products.update({
      id: "prod_l2",
      dryRun: true,
      updateProductRequestEntity: { externalId: "team" },
    });
    expect(preview.writeResult).toMatchObject({ result: "updated", dryRun: true });
    expect(fake.stores.live.products[1].external_id).toBeNull();
    await expect(
      fake.live.products.update({
        id: "prod_l2",
        updateProductRequestEntity: { externalId: "pro" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      body: expect.stringContaining("external_id_taken"),
    });
    const meter = await fake.test.meters.updateMeter({
      id: "mtr_t1",
      updateMeterApiRequestDto: { externalId: null },
    });
    expect(meter.externalId).toBeNull();
  });

  it("replaces a product's features per type: a feature left out of its type's set is removed", async () => {
    const fake = fakeCatalog({
      test: {
        products: [
          sideProduct("test", "prod_t1", {
            features: [
              featureJson("feat_a", "custom", "A"),
              featureJson("feat_b", "custom", "B"),
              featureJson("feat_c", "licenseKey", "C"),
            ],
          }),
        ],
      },
    });
    await fake.test.products.update({
      id: "prod_t1",
      updateProductRequestEntity: {
        features: [{ id: "feat_a", type: "custom", description: "A", privateNote: "A note" }],
      },
    });
    expect(fake.stores.test.products[0].features.map((f: { id: string }) => f.id)).toEqual([
      "feat_c",
      "feat_a",
    ]);
  });
});
