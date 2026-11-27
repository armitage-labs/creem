import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeCreem } from "./migrate-fixtures";
import { ACCOUNT_ID, ID, STRIPE_KEY, stripeDocs, stripeFetch } from "./migrate-stripe-fixtures";
import { fetchStripeCatalog, stripeClient } from "../src/lib/migration/stripe/source";
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

async function stripeObjects(
  options: {
    includeArchived?: boolean;
    pageSize?: number;
    docs?: ReturnType<typeof stripeDocs>;
  } = {},
) {
  const stripe = stripeFetch(options.docs, { pageSize: options.pageSize });
  const client = stripeClient(STRIPE_KEY, { fetch: stripe.fetcher });
  return {
    ...(await fetchStripeCatalog(client, { includeArchived: options.includeArchived })),
    stripe,
  };
}
const paths = (requests: { url: string }[]) => requests.map((r) => new URL(r.url).pathname);

describe("Stripe source", () => {
  it("reads the account, active products and prices, active meters and webhook endpoints with GETs only", async () => {
    const { objects, failures, stripe } = await stripeObjects();
    expect(failures).toEqual([]);
    expect(objects.account).toEqual({ id: ACCOUNT_ID, name: "eng2012 sandbox", currency: "EUR" });
    expect(objects.products.map((p) => p.id)).not.toContain(ID.productOld);
    expect(objects.products).toHaveLength(10);
    expect(objects.prices.map((p) => p.id)).not.toContain(ID.priceProLegacy);
    expect(objects.prices.map((p) => p.id)).toContain(ID.priceOld);
    expect(objects.prices.find((p) => p.id === ID.priceUkGbp)?.currency_options).toHaveProperty(
      "usd",
    );
    expect(objects.meters.map((m) => m.id)).toEqual(
      expect.arrayContaining([ID.meterCalls, ID.meterUsers, ID.meterStorage]),
    );
    expect(objects.webhookEndpoints).toBe(0);
    expect(new Set(paths(stripe.requests))).toEqual(
      new Set([
        "/v1/account",
        "/v1/products",
        "/v1/prices",
        "/v1/billing/meters",
        "/v1/webhook_endpoints",
      ]),
    );
    for (const r of stripe.requests) {
      expect(new URL(r.url).hostname).toBe("api.stripe.com");
      expect(r.authorization).toBe(`Bearer ${STRIPE_KEY}`);
    }
    const query = (path: string) =>
      new URL(stripe.requests.find((r) => new URL(r.url).pathname === path)!.url).searchParams;
    expect(query("/v1/products").get("active")).toBe("true");
    expect(query("/v1/prices").get("active")).toBe("true");
    expect(query("/v1/billing/meters").get("status")).toBe("active");
  });

  it("reads inactive products and prices too with includeArchived", async () => {
    const { objects } = await stripeObjects({ includeArchived: true });
    expect(objects.products.map((p) => p.id)).toContain(ID.productOld);
    expect(objects.prices.map((p) => p.id)).toContain(ID.priceProLegacy);
    expect(objects.prices).toHaveLength(15);
  });

  it("reads every page of a list", async () => {
    const { objects, stripe } = await stripeObjects({ pageSize: 4 });
    expect(objects.prices).toHaveLength(14);
    expect(paths(stripe.requests).filter((p) => p === "/v1/prices")).toHaveLength(4);
  });

  it("lists webhook endpoints as unknown when the key may not read them", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/webhook_endpoints", 403, {
      error: {
        type: "invalid_request_error",
        code: "secret_key_required",
        message: "The provided key does not have the required permissions.",
      },
    });
    const { objects, failures } = await fetchStripeCatalog(
      stripeClient(STRIPE_KEY, { fetch: stripe.fetcher }),
    );
    expect(failures).toEqual([]);
    expect(objects.webhookEndpoints).toBeNull();
  });

  it("reports a list it couldn't read as a fetch failure, without the key", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/prices", 403, {
      error: {
        type: "invalid_request_error",
        message: `The provided key '${STRIPE_KEY.slice(0, 12)}***' does not have the required permissions for this endpoint.`,
      },
    });
    const { failures } = await fetchStripeCatalog(
      stripeClient(STRIPE_KEY, { fetch: stripe.fetcher, maxNetworkRetries: 0 }),
    );
    expect(failures).toEqual([{ kind: "prices", message: expect.stringContaining("permissions") }]);
    expect(JSON.stringify(failures)).not.toContain(STRIPE_KEY);
  });

  it("throws the authentication error of a refused key", async () => {
    const stripe = stripeFetch();
    stripe.fail("/v1/account", 401, {
      error: {
        type: "invalid_request_error",
        message: "Invalid API Key provided: rk_test_****0000",
      },
    });
    await expect(
      fetchStripeCatalog(stripeClient(STRIPE_KEY, { fetch: stripe.fetcher })),
    ).rejects.toMatchObject({ type: "StripeAuthenticationError" });
  });
});
