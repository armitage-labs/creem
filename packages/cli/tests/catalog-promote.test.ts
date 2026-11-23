import { describe, it, expect, vi } from "vitest";
import type { CliContext } from "../src/lib/context";
import { harness } from "./helpers";
import {
  fakeCatalog,
  featureJson,
  meterJson,
  sideProduct,
  type Catalog,
  type CatalogCall,
} from "./promote-fixtures";

/**
 * ENG-2437: `creem catalog promote`, `link` and `unlink` against the two-sided
 * in-memory store (`promote-fixtures.ts`), through the real SDK.
 */

type Json = Record<string, any>;

const meter = (side: "t" | "l", fields: Json = {}) =>
  meterJson(`mtr_${side}1`, {
    external_id: "api-calls",
    name: "API calls",
    event_name: "api.call",
    ...fields,
  });

/** A paired meter, a paired product and a keyless test product whose live namesake has no key. */
const store = (): { test: Partial<Catalog>; live: Partial<Catalog> } => ({
  test: {
    meters: [meter("t")],
    products: [
      sideProduct("test", "prod_t1", { name: "Pro", external_id: "pro" }),
      sideProduct("test", "prod_t2", { name: "Team", price: 3000 }),
    ],
  },
  live: {
    meters: [meter("l")],
    products: [
      sideProduct("live", "prod_l1", { name: "Pro", external_id: "pro" }),
      sideProduct("live", "prod_l2", { name: "Team", price: 2000 }),
    ],
  },
});

/** A store where every test item is paired, and one product changed in test. */
const pairedStore = () => {
  const initial = store();
  initial.test.products = [
    sideProduct("test", "prod_t1", { name: "Pro Plan", external_id: "pro" }),
  ];
  initial.live.products = [sideProduct("live", "prod_l1", { name: "Pro", external_id: "pro" })];
  return initial;
};

interface Script {
  confirms?: boolean[];
  answers?: string[];
  choices?: unknown[];
}

function cli(fake: ReturnType<typeof fakeCatalog>, script: Script & Partial<CliContext> = {}) {
  const { confirms = [], answers = [], choices = [], ...overrides } = script;
  const asked: string[] = [];
  const confirm = vi.fn(async (message: string) => {
    asked.push(`confirm: ${message}`);
    if (!confirms.length) throw new Error(`UNEXPECTED_CONFIRM ${message}`);
    return confirms.shift()!;
  });
  const ask = vi.fn(async (message: string, defaultValue?: string) => {
    asked.push(`ask: ${message} [${defaultValue ?? ""}]`);
    if (!answers.length) throw new Error(`UNEXPECTED_ASK ${message}`);
    const answer = answers.shift()!;
    return answer === "" ? (defaultValue ?? "") : answer;
  });
  const choose = vi.fn(async (message: string, options: { name: string; value: unknown }[]) => {
    asked.push(`choose: ${message} ${options.map((o) => o.name).join(" | ")}`);
    if (!choices.length) throw new Error(`UNEXPECTED_CHOOSE ${message}`);
    const choice = choices.shift();
    const option = options.find((o) =>
      typeof choice === "number" ? false : JSON.stringify(o.value) === JSON.stringify(choice),
    );
    return (typeof choice === "number" ? options[choice] : option)!.value;
  });
  const h = harness(fake.live, {
    clientFor: async (environment) => (environment === "live" ? fake.live : fake.test),
    confirm,
    ask: ask as CliContext["ask"],
    choose: choose as CliContext["choose"],
    ...overrides,
  });
  return { ...h, asked, confirm };
}

const json = (text: string) => JSON.parse(text) as Json;
const describeCall = (c: CatalogCall) =>
  `${c.side} ${c.method} ${c.path}${c.dryRun ? " dry_run" : ""}`;

describe("creem catalog promote --dry-run", () => {
  it("runs Creem's dry run over every page, writes nothing, and prints run_id, every item and its result", async () => {
    const fake = fakeCatalog(store(), { pageSize: 1 });
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--dry-run", "--json"]);
    expect(fake.writes()).toEqual([]);
    expect(fake.promotes()).toHaveLength(3);
    expect(fake.promotes().every((c) => c.dryRun)).toBe(true);
    // Each later page sends the previous next_cursor, with the same select and dry_run.
    expect(fake.promotes().map((c) => c.body?.cursor ?? null)).toEqual([
      null,
      "cur_cprun_101_1",
      "cur_cprun_101_2",
    ]);
    const output = json(result.stdout);
    expect(output.run).toBeNull();
    expect(output.preview.runId).toBe("cprun_101");
    expect(output.preview.dryRun).toBe(true);
    expect(output.preview.items.map((i: Json) => [i.testId, i.result])).toEqual([
      ["mtr_t1", "unchanged"],
      ["prod_t1", "unchanged"],
      ["prod_t2", "needs_key"],
    ]);
    expect(output.preview.summary).toMatchObject({ unchanged: 2, needsKey: 1 });
    // A dry run with an item still needs_key exits 4, like the run would.
    expect(result.code).toBe(4);
  });

  it("prints each item with its result, error code and message, and the proposed key with numbered candidates", async () => {
    const initial = store();
    initial.test.products!.push(
      sideProduct("test", "prod_t3", {
        name: "Enterprise",
        external_id: "enterprise",
        metadata: {},
      }),
    );
    initial.live.products!.push(
      sideProduct("live", "prod_l3", {
        name: "Enterprise",
        external_id: "enterprise",
        metadata: { stripe_lookup_key: "ent" },
      }),
    );
    const fake = fakeCatalog(initial);
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--dry-run"]);
    expect(result.stdout).toContain("cprun_101");
    expect(result.stdout).toMatch(/meter\s+mtr_t1 → mtr_l1\s+unchanged/);
    expect(result.stdout).toMatch(/product\s+prod_t2\s+needs_key/);
    expect(result.stdout).toContain("proposed key prod_t2");
    expect(result.stdout).toMatch(/1\. prod_l2 "Team" \(no key\), differs in price/);
    expect(result.stdout).toMatch(/product\s+prod_t3 → prod_l3\s+conflict/);
    expect(result.stdout).toContain("live_metadata_not_in_test: The live product's metadata");
    expect(result.code).toBe(4);
  });

  it("stops when Creem answers a dry run as a real run (Q59)", async () => {
    const fake = fakeCatalog(pairedStore(), { ignoreDryRun: true });
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--dry-run", "--json"]);
    expect(result.code).toBe(1);
    expect(json(result.stderr).error.message).toMatch(/dry run/);
    expect(fake.promotes()).toHaveLength(1);
  });

  it("sends --select per kind, all or test ids", async () => {
    const fake = fakeCatalog(store());
    const { run } = cli(fake);
    await run([
      "catalog",
      "promote",
      "--dry-run",
      "--json",
      "--select",
      "products=prod_t1,prod_t2",
      "--select",
      "meters=all",
    ]);
    expect(fake.promotes()[0].body).toEqual({
      select: { products: ["prod_t1", "prod_t2"], meters: "all" },
    });
    const bad = await run(["catalog", "promote", "--dry-run", "--select", "discounts=all"]);
    expect(bad.code).toBe(2);
  });

  it("runs on live only, with the live key", async () => {
    const fake = fakeCatalog(store());
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--dry-run", "--environment", "test"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("live");
    expect(fake.calls).toEqual([]);
  });
});

describe("creem catalog promote --yes", () => {
  it("runs the dry run, then the real run over every page, and exits 0 when every item is written", async () => {
    const fake = fakeCatalog(pairedStore(), { pageSize: 1, checkBatches: 2 });
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--yes", "--json"]);
    expect(result.code).toBe(0);
    expect(fake.promotes().map((c) => [c.dryRun === true, c.body?.cursor ?? null])).toEqual([
      [true, null],
      [true, "cur_cprun_101_1"],
      [false, null],
      [false, "cur_cprun_102_1"],
      [false, "cur_cprun_102_2"],
    ]);
    const output = json(result.stdout);
    expect(output.preview.runId).toBe("cprun_101");
    expect(output.run.runId).toBe("cprun_102");
    expect(output.run.validation).toMatchObject({ passed: true, written: true, checkedBatches: 2 });
    expect(output.run.items.map((i: Json) => [i.testId, i.result])).toEqual([
      ["mtr_t1", "unchanged"],
      ["prod_t1", "updated"],
    ]);
    expect(fake.stores.live.products[0].name).toBe("Pro Plan");
  });

  it("never confirms a key: a needs_key item stays needs_key, nothing is paired, and the exit code is 4", async () => {
    const fake = fakeCatalog(store());
    const { run, confirm } = cli(fake);
    const result = await run(["catalog", "promote", "--yes", "--json"]);
    expect(result.code).toBe(4);
    expect(fake.writes()).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();
    expect(json(result.stdout).run.items.find((i: Json) => i.testId === "prod_t2").result).toBe(
      "needs_key",
    );
  });

  it("stops before the real run on a possible_rename, unless --create names the item", async () => {
    const initial = pairedStore();
    initial.test.products!.push(
      sideProduct("test", "prod_t5", { name: "Starter", external_id: "starter-2" }),
    );
    initial.live.products!.push(
      sideProduct("live", "prod_l5", { name: "Starter", external_id: "starter" }),
    );
    const fake = fakeCatalog(initial);
    const { run } = cli(fake);
    const stopped = await run(["catalog", "promote", "--yes"]);
    expect(stopped.code).toBe(4);
    expect(fake.realRuns()).toEqual([]);
    expect(stopped.stdout).toMatch(/possible_rename/);
    expect(stopped.stdout).toMatch(/1\. prod_l5 "Starter" \(key starter\)/);
    expect(stopped.stderr).toContain("--create prod_t5");
    const created = await run(["catalog", "promote", "--yes", "--create", "prod_t5", "--json"]);
    expect(created.code).toBe(0);
    expect(fake.realRuns()).toHaveLength(1);
    expect(json(created.stdout).run.items.find((i: Json) => i.testId === "prod_t5").result).toBe(
      "created",
    );
  });

  it("writes nothing when the check refuses an item, and writes the rest with --force", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.refuse("mtr_t1", 409, "meter_in_use", "An active product prices the meter.");
    const { run } = cli(fake);
    const held = await run(["catalog", "promote", "--yes"]);
    expect(held.code).toBe(4);
    expect(fake.stores.live.products[0].name).toBe("Pro");
    expect(held.stdout).toMatch(/meter\s+mtr_t1 → mtr_l1\s+conflict/);
    expect(held.stdout).toContain("meter_in_use: An active product prices the meter.");
    expect(held.stdout).toMatch(/product\s+prod_t1 → prod_l1\s+not_written/);
    expect(held.stdout).toContain("promote_check_failed");
    expect(held.stdout).toMatch(/nothing was written/i);
    expect(held.stderr).toContain("--force");
    const forced = await run(["catalog", "promote", "--yes", "--force", "--json"]);
    expect(forced.code).toBe(4);
    expect(fake.realRuns().at(-1)?.body).toEqual({ force: true });
    expect(fake.stores.live.products[0].name).toBe("Pro Plan");
  });

  it("reports blocked and not_written items, and exits 4 for blocked", async () => {
    const initial = pairedStore();
    initial.test.meters!.push(meterJson("mtr_t9", { name: "Seats" }));
    initial.test.products!.push(
      sideProduct("test", "prod_t3", {
        name: "Usage",
        external_id: "usage",
        usage_prices: [{ meter_id: "mtr_t9" }],
      }),
    );
    const fake = fakeCatalog(initial);
    fake.changeAfterCheck("prod_t1");
    const { run } = cli(fake);
    const result = await run(["catalog", "promote", "--yes", "--select", "products=all"]);
    expect(result.code).toBe(4);
    expect(result.stdout).toMatch(/product\s+prod_t3\s+blocked\s+by meter mtr_t9/);
    expect(result.stdout).toContain("changed_since_check");
  });

  it("asks for --yes in non-interactive mode before anything runs", async () => {
    const fake = fakeCatalog(pairedStore());
    const { run } = cli(fake);
    const result = await run(["catalog", "promote"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("--yes");
    expect(fake.calls).toEqual([]);
  });
});

describe("creem catalog promote, interactive", () => {
  it("pairs a needs_key item with a picked candidate, live first, then re-runs the dry run and asks before the real run", async () => {
    const fake = fakeCatalog(store());
    const h = cli(fake, {
      isTTY: true,
      // pick candidate 1, accept the proposed key, confirm the pair, confirm the real run
      choices: [{ action: "pair", liveId: "prod_l2" }],
      answers: [""],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(0);
    expect(h.asked[0]).toMatch(/choose: prod_t2 "Team" needs a key/);
    expect(h.asked[0]).toContain('1. prod_l2 "Team" (no key), differs in price');
    expect(h.asked[1]).toBe("ask: Key for prod_t2 and prod_l2 [prod_t2]");
    expect(h.asked[2]).toMatch(
      /confirm: Write the key prod_t2 on LIVE prod_l2 \(no key\), then on TEST prod_t2 \(no key\)\?/,
    );
    expect(h.asked[3]).toMatch(/confirm: Promote to LIVE: 1 updated, 2 unchanged\?/);
    expect(fake.calls.filter((c) => c.method !== "GET").map(describeCall)).toEqual([
      "live POST /v1/catalog/promote dry_run",
      "live PATCH /v1/products/prod_l2 dry_run",
      "test PATCH /v1/products/prod_t2 dry_run",
      "live PATCH /v1/products/prod_l2",
      "test PATCH /v1/products/prod_t2",
      "live POST /v1/catalog/promote dry_run",
      "live POST /v1/catalog/promote",
    ]);
    expect(fake.stores.live.products[1]).toMatchObject({ external_id: "prod_t2", price: 3000 });
  });

  it("runs the dry run again after each pairing, so the next item isn't offered a live item that was just paired", async () => {
    const initial = store();
    initial.test.products!.push(sideProduct("test", "prod_t3", { name: "Team", price: 3000 }));
    const fake = fakeCatalog(initial);
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }, { action: "skip" }],
      answers: [""],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote"]);
    const chooses = h.asked.filter((line) => line.startsWith("choose:"));
    expect(chooses[0]).toMatch(/choose: prod_t2 "Team" needs a key.*prod_l2/);
    expect(chooses[1]).toMatch(/choose: prod_t3 "Team" needs a key/);
    expect(chooses[1]).not.toContain("prod_l2");
    // The second dry run, after the pairing, asks the next question; the skip writes nothing.
    expect(fake.promotes().filter((c) => c.dryRun)).toHaveLength(2);
    expect(fake.stores.live.products.find((p) => p.id === "prod_l2")?.external_id).toBe("prod_t2");
    expect(fake.stores.live.products.filter((p) => p.name === "Team")).toHaveLength(1);
    expect(result.code).toBe(4);
  });

  it("runs the dry run again after each feature pairing, before the next feature's question", async () => {
    const initial = pairedStore();
    initial.test.products![0].features = [
      featureJson("feat_t1", "custom", "Support"),
      featureJson("feat_t2", "custom", "Support"),
    ];
    initial.live.products![0].features = [featureJson("feat_l1", "custom", "Support")];
    const fake = fakeCatalog(initial);
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "feat_l1" }],
      answers: ["support"],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(h.asked.filter((line) => line.startsWith("choose:"))).toHaveLength(1);
    expect(result.code).toBe(0);
    expect(fake.stores.live.products[0].features).toHaveLength(2);
  });

  it("writes nothing when the merchant declines the real run", async () => {
    const fake = fakeCatalog(pairedStore());
    const h = cli(fake, { isTTY: true, confirms: [false] });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(2);
    expect(fake.realRuns()).toEqual([]);
    expect(fake.writes()).toEqual([]);
  });

  it("gives a keyless item with no live match a key on test only, so promote creates it", async () => {
    const initial = pairedStore();
    initial.test.products!.push(sideProduct("test", "prod_t6", { name: "Addon" }));
    const fake = fakeCatalog(initial);
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "test-only" }],
      answers: ["addon"],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(0);
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t6"]);
    expect(fake.stores.live.products.find((p) => p.external_id === "addon")).toBeDefined();
  });

  it("shows a possible_rename before the real run and re-pairs instead of creating", async () => {
    const initial = pairedStore();
    initial.test.products!.push(
      sideProduct("test", "prod_t5", { name: "Starter", external_id: "starter-2" }),
    );
    initial.live.products!.push(
      sideProduct("live", "prod_l5", { name: "Starter", external_id: "starter" }),
    );
    const fake = fakeCatalog(initial);
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l5" }],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote", "--select", "products=prod_t5"]);
    expect(result.code).toBe(0);
    expect(h.asked[0]).toMatch(
      /choose: prod_t5 "Starter" has no live match, but live has items with its name/,
    );
    expect(h.asked[1]).toMatch(
      /confirm: Write the key starter-2 on LIVE prod_l5 \(currently starter\), then on TEST prod_t5 \(currently starter-2\)\?/,
    );
    expect(fake.stores.live.products.filter((p) => p.name === "Starter")).toHaveLength(1);
    expect(fake.stores.live.products.find((p) => p.id === "prod_l5")?.external_id).toBe(
      "starter-2",
    );
  });

  it("copies live-only metadata into test when the merchant confirms, and the next dry run updates the item (Q102)", async () => {
    const initial = pairedStore();
    initial.test.products![0].metadata = { plan: "pro" };
    initial.live.products![0].metadata = { plan: "pro", stripe_lookup_key: "pro_m" };
    const fake = fakeCatalog(initial);
    const h = cli(fake, { isTTY: true, confirms: [true, true] });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(0);
    expect(h.asked[0]).toBe(
      "confirm: Copy the live-only metadata key stripe_lookup_key of LIVE prod_l1 into TEST prod_t1?",
    );
    expect(fake.stores.test.products[0].metadata).toEqual({
      plan: "pro",
      stripe_lookup_key: "pro_m",
    });
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t1"]);
    expect(fake.realRuns()).toHaveLength(1);
    expect(fake.stores.live.products[0].name).toBe("Pro Plan");
  });

  it("never copies metadata under --yes", async () => {
    const initial = pairedStore();
    initial.live.products![0].metadata = { stripe_lookup_key: "pro_m" };
    const fake = fakeCatalog(initial);
    const { run, confirm } = cli(fake);
    const result = await run(["catalog", "promote", "--yes"]);
    expect(result.code).toBe(4);
    expect(confirm).not.toHaveBeenCalled();
    expect(fake.writes().filter((c) => c.side === "test")).toEqual([]);
  });

  it("offers to write the rest when the dry run refused an item, and sends force only after that confirmation", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.refuse("mtr_t1", 409, "meter_in_use");
    const h = cli(fake, { isTTY: true, confirms: [true] });
    const result = await h.run(["catalog", "promote"]);
    expect(h.asked[0]).toMatch(
      /1 item is refused \(conflict or failed\) and stays out; promote the other 1 to LIVE/,
    );
    expect(fake.realRuns()[0].body).toEqual({ force: true });
    expect(result.code).toBe(4);
  });
});

describe("creem catalog link", () => {
  it("checks the key on both sides, then writes live first and test second; the next dry run pairs them", async () => {
    const fake = fakeCatalog(store());
    const { run } = cli(fake);
    const result = await run([
      "catalog",
      "link",
      "--kind",
      "product",
      "--test",
      "prod_t2",
      "--live",
      "prod_l2",
      "--key",
      "team",
      "--yes",
      "--json",
    ]);
    expect(result.code).toBe(0);
    expect(fake.calls.filter((c) => c.method !== "GET").map(describeCall)).toEqual([
      "live PATCH /v1/products/prod_l2 dry_run",
      "test PATCH /v1/products/prod_t2 dry_run",
      "live PATCH /v1/products/prod_l2",
      "test PATCH /v1/products/prod_t2",
    ]);
    expect(json(result.stdout)).toMatchObject({
      kind: "product",
      key: "team",
      live: { id: "prod_l2", result: "updated" },
      test: { id: "prod_t2", result: "updated" },
    });
    const next = await run(["catalog", "promote", "--dry-run", "--json"]);
    expect(json(next.stdout).preview.items.find((i: Json) => i.testId === "prod_t2")).toMatchObject(
      { result: "updated", liveId: "prod_l2" },
    );
  });

  it("links a meter", async () => {
    const initial = store();
    initial.test.meters = [meter("t", { external_id: null })];
    initial.live.meters = [meter("l", { external_id: null })];
    const fake = fakeCatalog(initial);
    const { run } = cli(fake);
    const result = await run([
      "catalog",
      "link",
      "--kind",
      "meter",
      "--test",
      "mtr_t1",
      "--live",
      "mtr_l1",
      "--key",
      "api-calls",
      "--yes",
    ]);
    expect(result.code).toBe(0);
    expect(fake.stores.test.meters[0].external_id).toBe("api-calls");
    expect(fake.stores.live.meters[0].external_id).toBe("api-calls");
    expect(result.stdout).toContain("LIVE mtr_l1: updated");
  });

  it("stops before any write when the key is taken on either side", async () => {
    const initial = store();
    initial.test.products!.push(sideProduct("test", "prod_t7", { external_id: "team" }));
    const fake = fakeCatalog(initial);
    const { run } = cli(fake);
    const result = await run([
      "catalog",
      "link",
      "--kind",
      "product",
      "--test",
      "prod_t2",
      "--live",
      "prod_l2",
      "--key",
      "team",
      "--yes",
      "--json",
    ]);
    expect(result.code).toBe(4);
    expect(json(result.stderr).error.details.code).toBe("external_id_taken");
    expect(fake.writes()).toEqual([]);
  });

  it('reports "live written" when the test write fails, and a second link finishes the pair', async () => {
    const fake = fakeCatalog(store());
    fake.fail((c) => c.side === "test" && c.method === "PATCH" && !c.dryRun, 500, {
      code: "internal_error",
      message: "Boom",
    });
    const { run } = cli(fake);
    const args = [
      "catalog",
      "link",
      "--kind",
      "product",
      "--test",
      "prod_t2",
      "--live",
      "prod_l2",
      "--key",
      "team",
      "--yes",
    ];
    const first = await run(args);
    expect(first.code).toBe(4);
    expect(first.stderr).toContain("Live written: LIVE prod_l2 has the key team");
    // A 500 got no clear answer: the test write may have gone through.
    expect(first.stderr).toContain("TEST prod_t2 may or may not have been written");
    expect(first.stderr).toContain("creem catalog link");
    expect(fake.stores.live.products[1].external_id).toBe("team");
    expect(fake.stores.test.products[1].external_id).toBeNull();
    // The failure is gone; the same link writes live unchanged and test updated.
    const fakeAgain = fakeCatalog({ test: fake.stores.test, live: fake.stores.live });
    const again = await cli(fakeAgain).run([...args, "--json"]);
    expect(again.code).toBe(0);
    expect(json(again.stdout)).toMatchObject({
      live: { result: "unchanged" },
      test: { result: "updated" },
    });
  });

  it("proposes the live item's key, else the test id, and never takes a key from --yes alone", async () => {
    const initial = store();
    initial.live.products![1].external_id = "team-live";
    const fake = fakeCatalog(initial);
    const args = ["catalog", "link", "--kind", "product", "--test", "prod_t2", "--live", "prod_l2"];
    const unattended = await cli(fake).run([...args, "--yes"]);
    expect(unattended.code).toBe(2);
    expect(unattended.stderr).toContain("--key");
    expect(fake.writes()).toEqual([]);
    const h = cli(fake, { isTTY: true, answers: [""], confirms: [true] });
    const result = await h.run(args);
    expect(result.code).toBe(0);
    expect(h.asked[0]).toBe("ask: Key for prod_t2 and prod_l2 [team-live]");
    expect(fake.stores.test.products[1].external_id).toBe("team-live");
    const keyless = fakeCatalog(store());
    const k = cli(keyless, { isTTY: true, answers: [""], confirms: [true] });
    await k.run(args);
    expect(k.asked[0]).toBe("ask: Key for prod_t2 and prod_l2 [prod_t2]");
  });

  it("writes a key with no live candidate on test only", async () => {
    const fake = fakeCatalog(store());
    const { run } = cli(fake);
    const result = await run([
      "catalog",
      "link",
      "--kind",
      "product",
      "--test",
      "prod_t2",
      "--key",
      "team",
      "--yes",
      "--json",
    ]);
    expect(result.code).toBe(0);
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t2"]);
    expect(json(result.stdout).live).toBeNull();
  });
});

describe("creem catalog link --kind feature", () => {
  const featureStore = () => {
    const initial = store();
    initial.test.products = [
      sideProduct("test", "prod_t1", {
        name: "Pro",
        external_id: "pro",
        features: [
          featureJson("feat_t1", "custom", "Onboarding call", { external_id: "onboarding" }),
          featureJson("feat_t2", "custom", "Support"),
          featureJson("feat_t3", "licenseKey", "License"),
        ],
      }),
    ];
    initial.live.products = [
      sideProduct("live", "prod_l1", {
        name: "Pro",
        external_id: "pro",
        features: [
          featureJson("feat_l1", "custom", "Kickoff call"),
          featureJson("feat_l2", "custom", "Support"),
        ],
      }),
    ];
    return initial;
  };

  it("writes the key through each side's product write, live first, re-sending the product's complete set of that type", async () => {
    const fake = fakeCatalog(featureStore());
    const h = cli(fake, { isTTY: true, answers: [""], confirms: [true] });
    const result = await h.run([
      "catalog",
      "link",
      "--kind",
      "feature",
      "--product",
      "prod_t1",
      "--test",
      "feat_t1",
      "--live",
      "feat_l1",
    ]);
    expect(result.code).toBe(0);
    // The test feature's own key is proposed (a key renamed in test goes onto live).
    expect(h.asked[0]).toBe("ask: Key for feat_t1 and feat_l1 [onboarding]");
    expect(fake.writes().map(describeCall)).toEqual([
      "live PATCH /v1/products/prod_l1",
      "test PATCH /v1/products/prod_t1",
    ]);
    const liveWrite = fake.writes()[0].body!;
    expect(liveWrite.features.map((f: Json) => [f.id, f.external_id ?? null, f.type])).toEqual([
      ["feat_l1", "onboarding", "custom"],
      ["feat_l2", null, "custom"],
    ]);
    expect(fake.stores.live.products[0].features.map((f: Json) => f.id).sort()).toEqual([
      "feat_l1",
      "feat_l2",
    ]);
    expect(fake.stores.test.products[0].features).toHaveLength(3);
    const next = await h.run([
      "catalog",
      "promote",
      "--dry-run",
      "--json",
      "--select",
      "products=all",
    ]);
    expect(json(next.stdout).preview.items[0]).toMatchObject({
      testId: "prod_t1",
      result: "updated",
    });
  });

  it("is safe to run again: its live write is then unchanged", async () => {
    const fake = fakeCatalog(featureStore());
    const args = [
      "catalog",
      "link",
      "--kind",
      "feature",
      "--product",
      "prod_t1",
      "--test",
      "feat_t1",
      "--live",
      "feat_l1",
      "--key",
      "onboarding",
      "--yes",
      "--json",
    ];
    await cli(fake).run(args);
    const again = await cli(fake).run(args);
    expect(json(again.stdout)).toMatchObject({
      live: { result: "unchanged" },
      test: { result: "unchanged" },
    });
  });

  it("asks to link the product first when the test product has no key", async () => {
    const initial = featureStore();
    initial.test.products![0].external_id = null;
    const fake = fakeCatalog(initial);
    const result = await cli(fake).run([
      "catalog",
      "link",
      "--kind",
      "feature",
      "--product",
      "prod_t1",
      "--test",
      "feat_t2",
      "--live",
      "feat_l2",
      "--key",
      "support",
      "--yes",
    ]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("link the product first");
    expect(fake.writes()).toEqual([]);
  });
});

describe("creem catalog unlink", () => {
  it("clears the live item's key after confirmation, so the pair breaks", async () => {
    const fake = fakeCatalog(store());
    const declined = cli(fake, { isTTY: true, confirms: [false] });
    expect(
      (await declined.run(["catalog", "unlink", "--kind", "product", "--live", "prod_l1"])).code,
    ).toBe(2);
    expect(fake.writes()).toEqual([]);
    const h = cli(fake, { isTTY: true, confirms: [true] });
    const result = await h.run(["catalog", "unlink", "--kind", "product", "--live", "prod_l1"]);
    expect(result.code).toBe(0);
    expect(h.asked[0]).toBe(
      "confirm: Clear the key pro on LIVE prod_l1? Its test item is no longer paired.",
    );
    expect(fake.writes().map(describeCall)).toEqual(["live PATCH /v1/products/prod_l1"]);
    expect(fake.writes()[0].body).toEqual({ external_id: null });
    const next = await h.run(["catalog", "promote", "--dry-run", "--json"]);
    expect(json(next.stdout).preview.items.find((i: Json) => i.testId === "prod_t1")).toMatchObject(
      { result: "created" },
    );
  });

  it("needs --yes in non-interactive mode", async () => {
    const fake = fakeCatalog(store());
    const result = await cli(fake).run([
      "catalog",
      "unlink",
      "--kind",
      "meter",
      "--live",
      "mtr_l1",
    ]);
    expect(result.code).toBe(2);
    expect(fake.writes()).toEqual([]);
    const ok = await cli(fake).run([
      "catalog",
      "unlink",
      "--kind",
      "meter",
      "--live",
      "mtr_l1",
      "--yes",
    ]);
    expect(ok.code).toBe(0);
    expect(fake.stores.live.meters[0].external_id).toBeNull();
  });
});

describe("creem catalog: the store's test and live keys", () => {
  const withEnv = async (env: Record<string, string | undefined>, body: () => Promise<void>) => {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(env))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    try {
      await body();
    } finally {
      for (const [k, v] of Object.entries(saved))
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
  };

  it("takes CREEM_LIVE_API_KEY / CREEM_TEST_API_KEY, else the current key of that environment", async () => {
    const { environmentApiKey } = await import("../src/lib/api");
    await withEnv(
      {
        CREEM_API_KEY: "creem_test_current",
        CREEM_LIVE_API_KEY: undefined,
        CREEM_TEST_API_KEY: undefined,
      },
      async () => {
        expect(environmentApiKey("test")).toBe("creem_test_current");
        expect(environmentApiKey("live")).toBeUndefined();
      },
    );
    await withEnv(
      {
        CREEM_API_KEY: "creem_test_current",
        CREEM_LIVE_API_KEY: "creem_livekey",
        CREEM_TEST_API_KEY: "creem_test_other",
      },
      async () => {
        expect(environmentApiKey("live")).toBe("creem_livekey");
        expect(environmentApiKey("test")).toBe("creem_test_other");
      },
    );
    await withEnv({ CREEM_LIVE_API_KEY: "creem_test_wrong" }, async () => {
      expect(() => environmentApiKey("live")).toThrow(/CREEM_LIVE_API_KEY is not a live key/);
    });
  });

  it("stops with exit 3 and names the variable when there is no live key outside a terminal", async () => {
    await withEnv(
      { CREEM_API_KEY: "creem_test_current", CREEM_LIVE_API_KEY: undefined },
      async () => {
        const h = harness(undefined, { isTTY: false });
        const result = await h.run(["catalog", "promote", "--dry-run"]);
        expect(result.code).toBe(3);
        expect(result.stderr).toContain("CREEM_LIVE_API_KEY");
      },
    );
  });
});

describe("creem catalog promote --data and feature keys on test only", () => {
  it("sends --data's select and force", async () => {
    const fake = fakeCatalog(pairedStore());
    const { run } = cli(fake);
    const result = await run([
      "catalog",
      "promote",
      "--yes",
      "--json",
      "--data",
      JSON.stringify({ select: { products: "all" }, force: true }),
    ]);
    expect(result.code).toBe(0);
    expect(fake.realRuns()[0].body).toEqual({ select: { products: "all" }, force: true });
    const cursor = await run([
      "catalog",
      "promote",
      "--yes",
      "--data",
      JSON.stringify({ cursor: "x" }),
    ]);
    expect(cursor.code).toBe(2);
  });

  it("writes a feature key with no live feature on test only", async () => {
    const initial = store();
    initial.test.products = [
      sideProduct("test", "prod_t1", {
        external_id: "pro",
        features: [featureJson("feat_t1", "licenseKey", "License")],
      }),
    ];
    initial.live.products = [sideProduct("live", "prod_l1", { external_id: "pro" })];
    const fake = fakeCatalog(initial);
    const result = await cli(fake).run([
      "catalog",
      "link",
      "--kind",
      "feature",
      "--product",
      "prod_t1",
      "--test",
      "feat_t1",
      "--key",
      "license",
      "--yes",
      "--json",
    ]);
    expect(result.code).toBe(0);
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t1"]);
    expect(fake.stores.test.products[0].features[0]).toMatchObject({
      id: "feat_t1",
      external_id: "license",
      license_key: { activation_limit: 1, expiry: null },
    });
  });
});

describe("creem catalog: a test-only feature key needs no live product", () => {
  /** A new keyed test product (nothing in live) with two identical keyless license features. */
  const newProductStore = () => ({
    test: {
      products: [
        sideProduct("test", "prod_t8", {
          name: "Studio",
          external_id: "studio",
          features: [
            featureJson("feat_t1", "licenseKey", "License"),
            featureJson("feat_t2", "licenseKey", "License"),
          ],
        }),
      ],
    },
    live: { products: [] },
  });

  it("catalog link --kind feature without --live writes through the test client alone", async () => {
    const fake = fakeCatalog(newProductStore());
    const environments: string[] = [];
    const h = cli(fake, {
      clientFor: async (environment) => {
        environments.push(environment);
        return environment === "live" ? fake.live : fake.test;
      },
    });
    const result = await h.run([
      "catalog",
      "link",
      "--kind",
      "feature",
      "--product",
      "prod_t8",
      "--test",
      "feat_t1",
      "--key",
      "license-a",
      "--yes",
      "--json",
    ]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(environments).toEqual(["test"]);
    expect(fake.calls.filter((c) => c.side === "live")).toEqual([]);
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t8"]);
    expect(json(result.stdout)).toMatchObject({ live: null, test: { id: "feat_t1" } });
  });

  it("interactive promote gives such a feature its key on test only, and the next dry run creates the product", async () => {
    const fake = fakeCatalog(newProductStore());
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "test-only" }],
      answers: ["license-a"],
      confirms: [true, true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(fake.writes().map(describeCall)).toEqual(["test PATCH /v1/products/prod_t8"]);
    expect(fake.stores.live.products.find((p) => p.external_id === "studio")).toBeDefined();
  });
});

describe("creem catalog promote: its per-page timeout", () => {
  it("waits 90 s per promote page unless --timeout is given, and says so in the help", async () => {
    const fake = fakeCatalog(pairedStore());
    const promote = vi.spyOn(fake.live.catalog, "promote");
    const { run } = cli(fake);
    await run(["catalog", "promote", "--dry-run", "--json"]);
    expect(promote.mock.calls[0][1]).toMatchObject({ timeoutMs: 90000 });
    promote.mockClear();
    await run(["catalog", "promote", "--dry-run", "--json", "--timeout", "5000"]);
    expect(promote.mock.calls[0][1]).toMatchObject({ timeoutMs: 5000 });
    const help = await run(["catalog", "promote", "--help"]);
    expect(help.stdout).toMatch(/90 s per page/);
  });
});

describe("creem catalog promote: a run that stops mid-way", () => {
  const interrupted = () => {
    const fake = fakeCatalog(pairedStore(), { pageSize: 1 });
    // The real run's second page fails; its first page already wrote.
    fake.fail(
      (c) => c.path === "/v1/catalog/promote" && !c.dryRun && c.body?.cursor !== undefined,
      502,
      {
        code: "bad_gateway",
        message: "Upstream timed out",
      },
    );
    return fake;
  };

  it("keeps the run_id and the pages it got, says to promote again, and exits 4 (--json)", async () => {
    const fake = interrupted();
    const result = await cli(fake).run(["catalog", "promote", "--yes", "--json"]);
    expect(result.code).toBe(4);
    const output = json(result.stdout);
    expect(output.run).toMatchObject({
      runId: "cprun_102",
      dryRun: false,
      cursor: "cur_cprun_102_1",
      summary: expect.objectContaining({ unchanged: 1 }),
    });
    expect(output.run.items.map((i: Json) => i.testId)).toEqual(["mtr_t1"]);
    const error = json(result.stderr).error;
    expect(error.message).toContain("cprun_102");
    expect(error.message).toContain("Upstream timed out");
    expect(error.suggestion).toMatch(/promote again; items already written answer `unchanged`/i);
  });

  it("prints the partial report in the terminal", async () => {
    const fake = interrupted();
    const result = await cli(fake).run(["catalog", "promote", "--yes"]);
    expect(result.code).toBe(4);
    expect(result.stdout).toContain("Promote run (run cprun_102), interrupted");
    expect(result.stdout).toMatch(/meter\s+mtr_t1 → mtr_l1\s+unchanged/);
    expect(result.stderr).toMatch(/promote again/i);
  });
});

describe("creem catalog: every dry run is checked (Q59)", () => {
  /** A PATCH answer that says it wrote although dry_run was sent. */
  const wroteAnyway = (side: "test" | "live", id: string, fields: Json = {}) => ({
    ...sideProduct(side, id, fields),
    write_result: { result: "updated", dry_run: false, changes: [], warnings: [] },
  });

  it("link stops when live answers its dry run as a write, before test is asked", async () => {
    const fake = fakeCatalog(store());
    fake.fail(
      (c) => c.side === "live" && c.method === "PATCH" && c.dryRun === true,
      200,
      wroteAnyway("live", "prod_l2", { name: "Team" }),
    );
    const result = await cli(fake).run([
      "catalog",
      "link",
      "--kind",
      "product",
      "--test",
      "prod_t2",
      "--live",
      "prod_l2",
      "--key",
      "team",
      "--yes",
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("LIVE prod_l2");
    expect(fake.calls.filter((c) => c.method === "PATCH").map(describeCall)).toEqual([
      "live PATCH /v1/products/prod_l2 dry_run",
    ]);
  });

  it("the metadata copy stops when test answers its dry run as a write", async () => {
    const initial = pairedStore();
    initial.live.products![0].metadata = { stripe_lookup_key: "pro_m" };
    const fake = fakeCatalog(initial);
    fake.fail(
      (c) => c.side === "test" && c.method === "PATCH" && c.dryRun === true,
      200,
      wroteAnyway("test", "prod_t1", { name: "Pro Plan", external_id: "pro" }),
    );
    const h = cli(fake, { isTTY: true, confirms: [true] });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("TEST prod_t1");
    expect(fake.writes()).toEqual([]);
    expect(fake.realRuns()).toEqual([]);
  });

  it("a dry-run page whose item says its write wasn't a dry run stops the command", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.fail((c) => c.path === "/v1/catalog/promote" && c.dryRun === true, 200, {
      run_id: "cprun_9",
      dry_run: true,
      summary: {
        created: 0,
        updated: 1,
        unchanged: 0,
        needs_key: 0,
        conflict: 0,
        failed: 0,
        blocked: 0,
        not_written: 0,
      },
      items: [
        {
          kind: "product",
          test_id: "prod_t1",
          live_id: "prod_l1",
          result: "updated",
          write_result: { result: "updated", dry_run: false, changes: [], warnings: [] },
        },
      ],
      validation: null,
      next_cursor: null,
    });
    const result = await cli(fake).run(["catalog", "promote", "--yes", "--json"]);
    expect(result.code).toBe(1);
    expect(json(result.stderr).error.message).toContain("write_result.dry_run on prod_t1");
    expect(fake.realRuns()).toEqual([]);
  });
});

describe("creem catalog promote, interactive: refused items", () => {
  it("a failed item alone is refused too: the confirmed run sends force", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.refuse("mtr_t1", 500, "internal_error", "Boom");
    const h = cli(fake, { isTTY: true, confirms: [true] });
    await h.run(["catalog", "promote"]);
    expect(h.asked[0]).toMatch(/1 item is refused \(conflict or failed\)/);
    expect(fake.realRuns()[0].body).toEqual({ force: true });
  });
});

describe("creem catalog promote, interactive: the metadata copy (Q102)", () => {
  it("copies only the keys the merchant confirmed, never a key live gained since the dry run", async () => {
    const initial = pairedStore();
    initial.test.products![0].metadata = { plan: "pro" };
    initial.live.products![0].metadata = { plan: "pro", stripe_lookup_key: "pro_m" };
    const fake = fakeCatalog(initial);
    const questions: string[] = [];
    const h = cli(fake, {
      isTTY: true,
      confirm: async (message: string) => {
        questions.push(message);
        if (questions.length === 1) {
          // Live gains a key after the dry run, before the copy.
          fake.stores.live.products[0].metadata.region = "eu";
          return true;
        }
        return false;
      },
    });
    await h.run(["catalog", "promote"]);
    expect(questions[0]).toContain("stripe_lookup_key of LIVE prod_l1");
    expect(fake.writes().map((c) => c.body?.metadata)).toEqual([
      { plan: "pro", stripe_lookup_key: "pro_m" },
    ]);
  });
});

describe("creem catalog: the pairing question names each side's current key", () => {
  it("catalog link shows the key each item has now, so re-keying a paired item is visible", async () => {
    const initial = store();
    initial.live.products![1].external_id = "team-live";
    const fake = fakeCatalog(initial);
    const h = cli(fake, { isTTY: true, answers: ["team"], confirms: [false] });
    await h.run(["catalog", "link", "--kind", "product", "--test", "prod_t2", "--live", "prod_l2"]);
    expect(h.asked[1]).toBe(
      "confirm: Write the key team on LIVE prod_l2 (currently team-live), then on TEST prod_t2 (no key)?",
    );
  });

  it("interactive promote's pick names both sides' keys too", async () => {
    const fake = fakeCatalog(store());
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }],
      answers: ["team"],
      confirms: [false, false],
    });
    await h.run(["catalog", "promote"]);
    expect(h.asked[2]).toBe(
      "confirm: Write the key team on LIVE prod_l2 (no key), then on TEST prod_t2 (no key)?",
    );
  });
});

describe("creem catalog promote, interactive: a pick that fails", () => {
  /** Two keyless test products: Team (live has a keyless Team) and Solo (no live match). */
  const twoKeyless = () => {
    const initial = store();
    initial.test.products!.push(sideProduct("test", "prod_t3", { name: "Solo" }));
    return initial;
  };

  it("reports a 409 on the pairing check and goes on with the next item", async () => {
    const fake = fakeCatalog(twoKeyless());
    fake.fail((c) => c.side === "live" && c.method === "PATCH" && c.dryRun === true, 409, {
      code: "external_id_taken",
      message: "The external_id team is taken.",
    });
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }, { action: "skip" }],
      answers: ["team"],
      confirms: [true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.stderr).toContain("Not paired: The external_id team is taken.");
    expect(h.asked.filter((l) => l.startsWith("choose:"))[1]).toMatch(/prod_t3 "Solo" needs a key/);
    expect(fake.writes()).toEqual([]);
    expect(result.code).toBe(4);
  });

  it("reports a half-done pair, runs the dry run again, and offers the item again with the live key", async () => {
    const fake = fakeCatalog(twoKeyless());
    fake.fail((c) => c.side === "test" && c.method === "PATCH" && !c.dryRun, 422, {
      code: "invalid_external_id",
      message: "Boom",
    });
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }, { action: "skip" }, { action: "skip" }],
      answers: ["team"],
      confirms: [true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.stderr).toContain("Live written: LIVE prod_l2 has the key team");
    expect(result.stderr).toContain("TEST prod_t2 was not written");
    // The merchant never ran `catalog link`: the hint is the question that comes back.
    expect(result.stderr).not.toContain("Run the same creem catalog link again");
    expect(result.stderr).toContain(
      "The dry run runs again and asks about prod_t2 again: pick prod_l2 with the key team to finish the pair",
    );
    const chooses = h.asked.filter((l) => l.startsWith("choose:"));
    expect(chooses[1]).toMatch(/choose: prod_t2 "Team" needs a key/);
    expect(chooses[1]).toContain('1. prod_l2 "Team" (key team)');
    expect(chooses[2]).toMatch(/prod_t3 "Solo" needs a key/);
    expect(fake.promotes().filter((c) => c.dryRun)).toHaveLength(2);
    expect(result.code).toBe(4);
  });
});

describe("creem catalog promote, interactive: nothing to write", () => {
  it("says every item is unchanged and skips the real run", async () => {
    const initial = pairedStore();
    initial.test.products![0] = sideProduct("test", "prod_t1", { name: "Pro", external_id: "pro" });
    const fake = fakeCatalog(initial);
    const h = cli(fake, { isTTY: true });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("Every item is unchanged: nothing to promote.");
    expect(h.confirm).not.toHaveBeenCalled();
    expect(fake.realRuns()).toEqual([]);
  });
});

describe("creem catalog promote: a forced run", () => {
  it("names the items the run refused that the preview hadn't", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.refuse("mtr_t1", 409, "meter_in_use");
    const h = cli(fake, {
      isTTY: true,
      confirm: async () => {
        // Between the preview and the run, live changes under prod_t1.
        fake.refuse("prod_t1", 409, "external_id_taken", "Taken since the preview.");
        return true;
      },
    });
    const result = await h.run(["catalog", "promote"]);
    expect(fake.realRuns()[0].body).toEqual({ force: true });
    expect(result.stdout).toContain(
      "Refused in the run, not in the preview: product prod_t1 (external_id_taken)",
    );
    expect(result.stdout).not.toMatch(/not in the preview: .*mtr_t1/);
    expect(result.code).toBe(4);
  });
});

describe("creem catalog promote: a run left with not_written items", () => {
  it("says to promote again when an item changed since the check, and exits 4", async () => {
    const fake = fakeCatalog(pairedStore());
    fake.changeAfterCheck("prod_t1");
    const result = await cli(fake).run(["catalog", "promote", "--yes", "--json"]);
    const run = json(result.stdout).run;
    expect(run.items.map((i: Json) => [i.testId, i.result])).toEqual([
      ["mtr_t1", "unchanged"],
      ["prod_t1", "not_written"],
    ]);
    expect(result.code).toBe(4);
    const error = json(result.stderr).error;
    expect(error.message).toContain("1 not_written");
    expect(error.suggestion).toMatch(/promote again/i);
  });

  it("an archived item that live doesn't have stays out of the exit code", async () => {
    const initial = pairedStore();
    initial.test.products!.push(
      sideProduct("test", "prod_t4", { name: "Old", external_id: "old", status: "archived" }),
    );
    const fake = fakeCatalog(initial);
    const result = await cli(fake).run([
      "catalog",
      "promote",
      "--yes",
      "--json",
      "--select",
      "products=prod_t1,prod_t4",
    ]);
    expect(json(result.stdout).run.items.find((i: Json) => i.testId === "prod_t4").error.code).toBe(
      "archived_not_in_live",
    );
    expect(result.code).toBe(0);
  });
});

describe("creem catalog promote, interactive: a write without a clear answer", () => {
  /** Two keyless test products "Team" and one keyless live "Team". */
  const twoTeams = () => {
    const initial = store();
    initial.test.products!.push(sideProduct("test", "prod_t3", { name: "Team", price: 3000 }));
    return initial;
  };

  it("says live may have the key, runs the dry run again before the next question, and offers the item again", async () => {
    const fake = fakeCatalog(twoTeams());
    // Live commits the key, then its answer is a 502.
    fake.fail(
      (c) => c.side === "live" && c.method === "PATCH" && !c.dryRun,
      502,
      { code: "bad_gateway", message: "Upstream timed out" },
      { afterWrite: true },
    );
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }, { action: "skip" }, { action: "skip" }],
      answers: ["team"],
      confirms: [true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(fake.stores.live.products.find((p) => p.id === "prod_l2")?.external_id).toBe("team");
    expect(fake.writes().map(describeCall)).toEqual(["live PATCH /v1/products/prod_l2"]);
    expect(result.stderr).toContain("LIVE prod_l2 may have the key team");
    expect(result.stderr).toContain("TEST prod_t2 was not written");
    expect(fake.promotes().filter((c) => c.dryRun)).toHaveLength(2);
    const chooses = h.asked.filter((l) => l.startsWith("choose:"));
    expect(chooses[1]).toMatch(/choose: prod_t2 "Team" needs a key/);
    expect(chooses[1]).toContain('prod_l2 "Team" (key team)');
    expect(chooses[2]).toMatch(/choose: prod_t3 "Team" needs a key/);
    expect(chooses[2]).not.toContain('prod_l2 "Team" (no key)');
    expect(result.code).toBe(4);
  });

  it("a write refused with a 4xx wrote nothing: no new dry run, the next item follows", async () => {
    const fake = fakeCatalog(twoTeams());
    fake.fail((c) => c.side === "live" && c.method === "PATCH" && !c.dryRun, 409, {
      code: "external_id_taken",
      message: "The external_id team is taken.",
    });
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }, { action: "skip" }],
      answers: ["team"],
      confirms: [true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.stderr).toContain("Not paired: The external_id team is taken.");
    expect(fake.promotes().filter((c) => c.dryRun)).toHaveLength(1);
    expect(h.asked.filter((l) => l.startsWith("choose:"))[1]).toMatch(/prod_t3 "Team" needs a key/);
    expect(result.code).toBe(4);
  });
});

describe("creem catalog promote, interactive: auth errors and the metadata copy's label", () => {
  it("a 401 during a pick stops the command with exit 3", async () => {
    const fake = fakeCatalog(store());
    fake.fail((c) => c.side === "test" && c.method === "GET", 401, {
      code: "unauthorized",
      message: "The API key was revoked.",
    });
    const h = cli(fake, { isTTY: true });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(3);
    expect(result.stderr).not.toContain("Not paired");
    expect(result.stderr).toContain("The API key was revoked.");
  });

  it("a 403 on the pairing check stops the command with exit 3", async () => {
    const fake = fakeCatalog(store());
    fake.fail((c) => c.side === "live" && c.method === "PATCH", 403, {
      code: "forbidden",
      message: "The key can't write products.",
    });
    const h = cli(fake, {
      isTTY: true,
      choices: [{ action: "pair", liveId: "prod_l2" }],
      answers: ["team"],
      confirms: [true],
    });
    const result = await h.run(["catalog", "promote"]);
    expect(result.code).toBe(3);
    expect(result.stderr).not.toContain("Not paired");
    expect(fake.writes()).toEqual([]);
  });

  it("a failed metadata copy is reported as not copied", async () => {
    const initial = pairedStore();
    initial.live.products![0].metadata = { stripe_lookup_key: "pro_m" };
    const fake = fakeCatalog(initial);
    fake.fail((c) => c.side === "test" && c.method === "PATCH", 409, {
      code: "metadata_locked",
      message: "Metadata is locked.",
    });
    const h = cli(fake, { isTTY: true, confirms: [true, false] });
    const result = await h.run(["catalog", "promote"]);
    expect(result.stderr).toContain("Not copied: Metadata is locked.");
    expect(result.stderr).not.toContain("Not paired");
  });
});
