import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeCreem } from "./migrate-fixtures";
import { checkMigration, executeMigration } from "../src/lib/migration/writer";
import { adoptionMatcher, type MigrationPlan } from "../src/lib/migration/plan";
import {
  MIGRATION_REPORT_SCHEMA,
  MIGRATION_REPORT_VERSION,
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
