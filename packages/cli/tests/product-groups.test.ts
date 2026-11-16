import { it, expect, vi } from "vitest";
import { harness } from "./helpers";

it("product-groups list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.productGroups, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "product-groups",
    "list",
    "--limit",
    "5",
    "--starting-after",
    "pgrp_1",
    "--external-id",
    "plans",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { limit: 5, startingAfter: "pgrp_1", externalId: "plans" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("product-groups list passes --ending-before for backward pagination", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.productGroups, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["product-groups", "list", "--ending-before", "pgrp_9", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    // The SDK applies the API's default page size.
    { endingBefore: "pgrp_9", limit: 10 },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});

it("product-groups list --all follows the cursor and prints one JSON list", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.productGroups, "list");
  spy
    .mockResolvedValueOnce({
      result: { object: "list", data: [{ id: "pgrp_1" }], hasMore: true },
    } as never)
    .mockResolvedValueOnce({
      result: { object: "list", data: [{ id: "pgrp_2" }], hasMore: false },
    } as never);
  const result = await h.run([
    "product-groups",
    "list",
    "--limit",
    "1",
    "--external-id",
    "plans",
    "--all",
    "--json",
  ]);
  expect(result.code, result.stderr).toBe(0);
  expect(spy.mock.calls.map((call) => call[0])).toEqual([
    { limit: 1, externalId: "plans" },
    { limit: 1, externalId: "plans", startingAfter: "pgrp_1" },
  ]);
  expect(JSON.parse(result.stdout)).toEqual({
    object: "list",
    data: [{ id: "pgrp_1" }, { id: "pgrp_2" }],
    hasMore: false,
  });
});

it("product-groups get sends the exact SDK arguments and prints the group as JSON", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.productGroups, "get")
    .mockResolvedValue({ id: "pgrp_1", object: "product_group", name: "Plans" } as never);
  const result = await h.run(["product-groups", "get", "pgrp_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "pgrp_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    id: "pgrp_1",
    object: "product_group",
    name: "Plans",
  });
});

it("product-groups get requires the group ID", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.productGroups, "get");
  const result = await h.run(["product-groups", "get", "--json"]);
  expect(result.code).toBe(2);
  expect(spy).not.toHaveBeenCalled();
});

it.each([
  [
    ["product-groups", "--help"],
    ["list", "get"],
  ],
  [
    ["product-groups", "list", "--help"],
    ["--limit", "--starting-after", "--ending-before", "--external-id", "--all"],
  ],
  [["product-groups", "get", "--help"], ["<id>"]],
])("%j documents its commands and flags", async (args, expected) => {
  const result = await harness().run(args);
  expect(result.code, result.stderr).toBe(0);
  for (const text of expected) expect(result.stdout).toContain(text);
});
