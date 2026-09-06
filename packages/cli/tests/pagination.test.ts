import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
import { pages } from "../src/lib/pagination";
import { operationManifest } from "../src/operation-manifest";
it("plain-entity lists traverse pages and aggregate", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customers, "getOrders");
  spy
    .mockResolvedValueOnce({
      items: [{ id: "order_1" }],
      pagination: { currentPage: 1, totalPages: 2, totalRecords: 2, nextPage: 2, prevPage: 0 },
    } as never)
    .mockResolvedValueOnce({
      items: [{ id: "order_2" }],
      pagination: { currentPage: 2, totalPages: 2, totalRecords: 2, nextPage: 0, prevPage: 1 },
    } as never);
  const r = await h.run(["customers", "orders", "cust_1", "--limit", "1", "--all", "--json"]);
  expect(r.code, r.stderr).toBe(0);
  expect(JSON.parse(r.stdout).items.map((x: { id: string }) => x.id)).toEqual([
    "order_1",
    "order_2",
  ]);
  expect(spy.mock.calls.map((c) => c[1])).toEqual([1, 2]);
});
it("legacy subscription status filters the complete endpoint, with accurate totals", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.subscriptions, "search");
  spy
    .mockResolvedValueOnce({
      result: {
        items: [{ id: "sub_1", status: "paused" }],
        pagination: { currentPage: 1, totalPages: 2, totalRecords: 2, nextPage: 2, prevPage: 0 },
      },
    } as never)
    .mockResolvedValueOnce({
      result: {
        items: [{ id: "sub_2", status: "active" }],
        pagination: { currentPage: 2, totalPages: 2, totalRecords: 2, nextPage: 0, prevPage: 1 },
      },
    } as never);
  const r = await h.run(["subs", "list", "--status", "active", "--json"]);
  expect(r.code, r.stderr).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({
    items: [{ id: "sub_2", status: "active" }],
    filter: { scope: "client", status: "active" },
    totalRecords: 1,
  });
  expect(spy).toHaveBeenCalledTimes(2);
});
it("legacy list commands preserve their page and limit defaults", async () => {
  const h = harness();
  const products = vi
    .spyOn(h.client.products, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const customers = vi
    .spyOn(h.client.customers, "list")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const subscriptions = vi
    .spyOn(h.client.subscriptions, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const discounts = vi
    .spyOn(h.client.discounts, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const transactions = vi
    .spyOn(h.client.transactions, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));

  await h.run(["products", "list", "--json"]);
  await h.run(["customers", "list", "--json"]);
  await h.run(["subscriptions", "list", "--json"]);
  await h.run(["discounts", "list", "--json"]);
  await h.run(["transactions", "list", "--json"]);

  expect(products).toHaveBeenCalledWith(
    1,
    20,
    undefined,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(customers).toHaveBeenCalledWith(
    1,
    20,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(subscriptions).toHaveBeenCalledWith(
    1,
    10,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(discounts).toHaveBeenCalledWith(
    1,
    20,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(transactions).toHaveBeenCalledWith(
    undefined,
    undefined,
    undefined,
    1,
    20,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});
it("stuck cursors fail instead of looping", async () => {
  const row = operationManifest.find((r) => r.cliPath === "customer-credits list")!;
  const consume = async () => {
    for await (const _page of pages(row, {}, true, async () => ({
      result: { data: [{ id: "same" }], hasMore: true },
    }))) {
      /* consume */
    }
  };
  await expect(consume()).rejects.toThrow("non-advancing");
});
it("NDJSON streams prior pages before a later failure", async () => {
  const h = harness();
  vi.spyOn(h.client.customers, "list")
    .mockResolvedValueOnce({
      result: {
        items: [{ id: "cust_1" }],
        pagination: { currentPage: 1, totalPages: 2, nextPage: 2 },
      },
    } as never)
    .mockRejectedValueOnce(new Error("second page failed"));
  const r = await h.run(["customers", "list", "--all", "--output", "ndjson"]);
  expect(r.code).toBe(1);
  expect(JSON.parse(r.stdout)).toEqual({ id: "cust_1" });
  expect(JSON.parse(r.stderr).error.message).toContain("second page failed");
});
