import { it, expect, vi } from "vitest";
import { Creem } from "creem";
import { HTTPClient } from "creem/lib/http";
import { harness } from "./helpers";

const customer = {
  id: "cust_1",
  mode: "test",
  object: "customer",
  email: "person@example.com",
  name: "Person",
  country: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};
const account = (id: string) => ({
  id,
  store_id: "store_1",
  customer_id: "cust_1",
  name: "default",
  unit_label: "credits",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});
function httpHarness(respond: (request: Request) => Promise<Response> | Response) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(input instanceof Request ? input : new Request(input, init)),
  );
  const client = new Creem({
    apiKey: "creem_test_fixture",
    server: "test",
    httpClient: new HTTPClient({ fetcher }),
    retryConfig: { strategy: "none" },
  });
  return { ...harness(client), fetcher };
}
it("real SDK read preserves dates and raw result JSON", async () => {
  const h = httpHarness((req) => {
    expect(new URL(req.url).pathname).toBe("/v1/customers");
    expect(new URL(req.url).searchParams.get("customer_id")).toBe("cust_1");
    expect(req.headers.get("x-api-key")).toBe("creem_test_fixture");
    return Response.json(customer);
  });
  const r = await h.run(["--json", "customers", "get", "cust_1"]);
  expect(r.code, r.stderr).toBe(0);
  expect(JSON.parse(r.stdout)).toMatchObject({
    id: "cust_1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  expect(r.stderr).toBe("");
});
it("real SDK write serializes --data camelCase and attempts once", async () => {
  const h = httpHarness(async (req) => {
    expect(req.method).toBe("POST");
    expect(await req.json()).toEqual({
      email: "person@example.com",
      name: "Person",
      metadata: { visits: 42 },
    });
    return Response.json(customer, { status: 200 });
  });
  const r = await h.run([
    "customers",
    "create",
    "--data",
    '{"email":"person@example.com","name":"Person","metadata":{"visits":42}}',
    "--json",
  ]);
  expect(r.code, r.stderr).toBe(0);
  expect(h.fetcher).toHaveBeenCalledTimes(1);
});
it("real SDK numbered pagination emits each item as NDJSON", async () => {
  const h = httpHarness((req) => {
    const page = Number(new URL(req.url).searchParams.get("page_number"));
    return Response.json({
      items: [{ ...customer, id: `cust_${page}` }],
      pagination: {
        current_page: page,
        total_pages: 2,
        total_records: 2,
        next_page: page === 1 ? 2 : 0,
        prev_page: page === 2 ? 1 : 0,
      },
    });
  });
  const r = await h.run(["customers", "list", "--limit", "1", "--all", "--output", "ndjson"]);
  expect(r.code, r.stderr).toBe(0);
  expect(
    r.stdout
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s).id),
  ).toEqual(["cust_1", "cust_2"]);
  expect(h.fetcher).toHaveBeenCalledTimes(2);
});
it.each(["starting-after", "ending-before"])(
  "real SDK cursor pagination honors %s direction",
  async (direction) => {
    const h = httpHarness((req) => {
      const cursor = new URL(req.url).searchParams.get(direction.replace("-", "_"));
      return Response.json({
        object: "list",
        data: [account(cursor === "acc_0" ? "acc_1" : "acc_2")],
        has_more: cursor === "acc_0",
      });
    });
    const r = await h.run([
      "credits",
      "list",
      `--${direction}`,
      "acc_0",
      "--limit",
      "1",
      "--all",
      "--json",
    ]);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).data.map((a: { id: string }) => a.id)).toEqual(["acc_1", "acc_2"]);
    expect(h.fetcher).toHaveBeenCalledTimes(2);
  },
);
it.each([401, 403, 404, 409, 429, 500])(
  "real SDK HTTP %s has stable error details and never retries writes",
  async (status) => {
    const h = httpHarness(() =>
      Response.json(
        { message: ["First problem", "Second problem creem_test_fixture"], trace_id: "trace_123" },
        { status, headers: { "retry-after": "5" } },
      ),
    );
    const r = await h.run([
      "customers",
      "create",
      "--email",
      "person@example.com",
      "--name",
      "Person",
      "--json",
    ]);
    expect(r.code).toBe(status === 401 || status === 403 ? 3 : 4);
    expect(r.stdout).toBe("");
    const e = JSON.parse(r.stderr).error;
    expect(e).toMatchObject({ status, traceId: "trace_123", retryAfter: "5" });
    expect(e.message).toContain("First problem; Second problem");
    expect(r.stderr).not.toContain("creem_test_fixture");
    expect(h.fetcher).toHaveBeenCalledTimes(1);
  },
);
it("real SDK network failure preserves cause", async () => {
  const h = httpHarness(() => {
    throw new TypeError("connection refused");
  });
  const r = await h.run(["customers", "get", "cust_1", "--json"]);
  expect(r.code, r.stderr).toBe(5);
  expect(JSON.parse(r.stderr).error.cause).toContain("connection refused");
});
it("malformed SDK response is an API failure", async () => {
  const h = httpHarness(() => Response.json({ id: "missing-fields" }));
  const r = await h.run(["customers", "get", "cust_1", "--json"]);
  expect(r.code, r.stderr).toBe(4);
});
it("product creation sends the idempotency header and custom cadence", async () => {
  const h = httpHarness(async (req) => {
    expect(req.headers.get("Idempotency-Key")).toBe("idem1");
    expect(await req.json()).toMatchObject({
      billing_period: "custom",
      recurring_interval: "week",
      recurring_interval_count: 2,
    });
    return Response.json({ message: "fixture end" }, { status: 400 });
  });
  const r = await h.run([
    "products",
    "create",
    "--data",
    '{"name":"Plan","description":"Biweekly","price":100,"currency":"USD","billingType":"recurring","billingPeriod":"custom","recurringInterval":"week","recurringIntervalCount":2}',
    "--idempotency-key",
    "idem1",
    "--json",
  ]);
  expect(r.code, r.stderr).toBe(4);
  expect(h.fetcher).toHaveBeenCalledTimes(1);
});
