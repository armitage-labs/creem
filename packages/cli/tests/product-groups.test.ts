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

it("product-groups create upserts by --external-id, with --dry-run and --if-none-match", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.productGroups, "create")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "product-groups",
    "create",
    "--name",
    "Plans",
    "--external-id",
    "plans",
    "--dry-run",
    "--if-none-match",
    "*",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      dryRun: true,
      ifNoneMatch: "*",
      createProductGroupRequestEntity: { name: "Plans", externalId: "plans" },
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});

it("product-groups update, add-product and remove-product send the exact SDK arguments", async () => {
  const h = harness();
  const update = vi
    .spyOn(h.client.productGroups, "update")
    .mockResolvedValue({ id: "pgrp_1" } as never);
  const add = vi
    .spyOn(h.client.productGroups, "addProduct")
    .mockResolvedValue({ id: "pgrp_1" } as never);
  const remove = vi
    .spyOn(h.client.productGroups, "removeProduct")
    .mockResolvedValue({ id: "pgrp_1" } as never);
  const updated = await h.run([
    "product-groups",
    "update",
    "pgrp_1",
    "--external-id",
    "plans",
    "--yes",
    "--json",
  ]);
  expect(updated.code, updated.stderr).toBe(0);
  expect(update).toHaveBeenCalledExactlyOnceWith(
    { id: "pgrp_1", updateProductGroupRequestEntity: { externalId: "plans" } },
    expect.anything(),
  );
  const added = await h.run([
    "product-groups",
    "add-product",
    "pgrp_1",
    "--data",
    '{"externalId":"pro-monthly"}',
    "--json",
  ]);
  expect(added.code, added.stderr).toBe(0);
  expect(add).toHaveBeenCalledExactlyOnceWith(
    { id: "pgrp_1", requestBody: { externalId: "pro-monthly" } },
    expect.anything(),
  );
  const removed = await h.run([
    "product-groups",
    "remove-product",
    "pgrp_1",
    "--product-id",
    "prod_1",
    "--yes",
    "--json",
  ]);
  expect(removed.code, removed.stderr).toBe(0);
  expect(remove).toHaveBeenCalledExactlyOnceWith(
    { id: "pgrp_1", productId: "prod_1" },
    expect.anything(),
  );
});

it("product-groups delete asks for --yes outside a terminal", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.productGroups, "delete");
  const result = await h.run(["product-groups", "delete", "pgrp_1", "--json"]);
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("--yes");
  expect(spy).not.toHaveBeenCalled();
});

it("catalog validate sends the --data batch to catalog.validate", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.catalog, "validate").mockResolvedValue({
    object: "catalog_validation",
    valid: true,
    items: [],
  } as never);
  const batch = { items: [{ kind: "product", body: { external_id: "pro", name: "Pro" } }] };
  const result = await h.run(["catalog", "validate", "--data", JSON.stringify(batch), "--json"]);
  expect(result.code, result.stderr).toBe(0);
  expect(spy).toHaveBeenCalledExactlyOnceWith(batch, expect.anything());
  expect(JSON.parse(result.stdout)).toMatchObject({ valid: true });
});

it.each([
  ["products", "create"],
  ["products", "update"],
  ["discounts", "create"],
  ["discounts", "update"],
  ["meters", "create"],
  ["product-groups", "create"],
  ["product-groups", "update"],
])(
  "%s %s --help explains --dry-run and --if-none-match instead of naming the SDK field",
  async (resource, command) => {
    const result = await harness().run([resource, command, "--help"]);
    expect(result.code, result.stderr).toBe(0);
    const line = (flag: string) => result.stdout.split("\n").find((l) => l.trim().startsWith(flag));
    expect(line("--dry-run")).toMatch(/^\s*--dry-run\s+Check the write/);
    expect(result.stdout).not.toMatch(/dryRun|ifNoneMatch/);
    if (command === "create")
      expect(line("--if-none-match")).toMatch(/--if-none-match <value>\s+\S+/);
  },
);

it("--dry-run alone is a dry run", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  await h.run(["products", "update", "prod_1", "--name", "X", "--dry-run", "--json", "--yes"]);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: "prod_1", dryRun: true });
});
