import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("splits create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.splits, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "splits",
    "create",
    "--type",
    "store",
    "--type-reference",
    "store_1",
    "--recipient",
    '{"recipientType":"store","recipientReference":"store_2","amount":20.5}',
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      type: "store",
      typeReference: "store_1",
      recipients: [{ recipientType: "store", recipientReference: "store_2", amount: 20.5 }],
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("splits list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.splits, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["splits", "list", "--page", "2", "--limit", "3", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("splits retrieve sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.splits, "retrieve").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["splits", "get", "split_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "split_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("splits delete sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.splits, "delete").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["splits", "delete", "split_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "split_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
