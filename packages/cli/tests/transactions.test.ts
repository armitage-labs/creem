import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("transactions getById sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.transactions, "getById")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["transactions", "get", "tx_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "tx_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("transactions search sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.transactions, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "transactions",
    "list",
    "--customer",
    "cust_1",
    "--order",
    "ord_1",
    "--product",
    "prod_1",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cust_1",
    "ord_1",
    "prod_1",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("transactions refund sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.transactions, "refund")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["transactions", "refund", "tx_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ transactionId: "tx_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
