import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("discounts search sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "search").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "list",
    "--page",
    "2",
    "--limit",
    "3",
    "--product",
    "prod_1",
    "--status",
    "active",
    "--type",
    "fixed",
    "--created-after",
    "2024-01-01",
    "--created-before",
    "2024-12-31",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      pageNumber: 2,
      pageSize: 3,
      productId: "prod_1",
      status: "active",
      type: "fixed",
      createdAfter: "2024-01-01",
      createdBefore: "2024-12-31",
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "get").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["discounts", "get", "--code", "SAVE", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { discountCode: "SAVE" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "create",
    "--name",
    "Save",
    "--type",
    "percentage",
    "--percentage",
    "20",
    "--duration",
    "once",
    "--products",
    "prod_1,prod_2",
    "--expires",
    "2028-01-01",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      createDiscountRequestEntity: expect.objectContaining({
        name: "Save",
        percentage: 20,
        appliesToProducts: ["prod_1", "prod_2"],
        expiryDate: new Date("2028-01-01"),
      }),
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts create preserves the default and normalization for fixed currencies", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const baseArgs = [
    "discounts",
    "create",
    "--name",
    "Fixed",
    "--type",
    "fixed",
    "--amount",
    "100",
    "--duration",
    "once",
    "--products",
    "prod_1",
  ];

  await h.run([...baseArgs, "--json"]);
  expect(spy).toHaveBeenLastCalledWith(
    {
      createDiscountRequestEntity: expect.objectContaining({ amount: 100, currency: "USD" }),
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );

  await h.run([...baseArgs, "--currency", "eur", "--json"]);
  expect(spy).toHaveBeenLastCalledWith(
    {
      createDiscountRequestEntity: expect.objectContaining({ amount: 100, currency: "EUR" }),
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});
it("discounts create sends the idempotency key and accepts products named by external ID", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "create",
    "--data",
    JSON.stringify({
      name: "Spring",
      type: "percentage",
      percentage: 15,
      duration: "once",
      appliesToProductExternalIds: ["pro-monthly"],
    }),
    "--idempotency-key",
    "idem-1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      idempotencyKey: "idem-1",
      createDiscountRequestEntity: expect.objectContaining({
        name: "Spring",
        appliesToProductExternalIds: ["pro-monthly"],
      }),
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts create still refuses a discount without any product", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "create",
    "--data",
    JSON.stringify({ name: "None", type: "percentage", percentage: 15, duration: "once" }),
    "--json",
  ]);
  expect(spy).not.toHaveBeenCalled();
  expect(result.stderr).toContain("Provide at least one product");
});
it("discounts delete sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "delete").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["discounts", "delete", "disc_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "disc_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("discounts update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "update",
    "disc_1",
    "--name",
    "Spring",
    "--percentage",
    "25",
    "--max-redemptions",
    "100",
    "--products",
    "prod_1,prod_2",
    "--expires",
    "2028-01-01",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      id: "disc_1",
      updateDiscountRequestEntity: {
        name: "Spring",
        percentage: 25,
        maxRedemptions: 100,
        appliesToProducts: ["prod_1", "prod_2"],
        expiryDate: new Date("2028-01-01"),
      },
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts update takes the body from --data, including null to clear a field", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "discounts",
    "update",
    "disc_1",
    "--data",
    JSON.stringify({ maxRedemptions: null, externalId: "spring-2028" }),
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      id: "disc_1",
      updateDiscountRequestEntity: { maxRedemptions: null, externalId: "spring-2028" },
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});
it("discounts update asks before changing a live discount", async () => {
  const confirm = vi.fn(async () => false);
  const h = harness(undefined, { isTTY: true, confirm, environment: () => "live" });
  const spy = vi.spyOn(h.client.discounts, "update");
  const result = await h.run(["discounts", "update", "disc_1", "--name", "Spring"]);
  expect(confirm).toHaveBeenCalledWith("LIVE: discounts update disc_1?");
  expect(spy).not.toHaveBeenCalled();
  // A declined confirmation exits 2, as in safety.test.ts.
  expect(result.code).toBe(2);
});
it("discounts update requires the discount ID and documents its flags", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "update");
  const missing = await h.run(["discounts", "update", "--name", "Spring", "--yes", "--json"]);
  expect(missing.code).toBe(2);
  expect(spy).not.toHaveBeenCalled();
  const help = await h.run(["discounts", "update", "--help"]);
  expect(help.code, help.stderr).toBe(0);
  for (const flag of ["<id>", "--data", "--name", "--percentage", "--expires", "--products"])
    expect(help.stdout).toContain(flag);
});
// The API takes a percentage from 1 to 100, fractions included, on create and
// update alike.
it.each([
  ["a flag", ["--percentage", "12.5"]],
  [
    "--data",
    [
      "--data",
      JSON.stringify({
        name: "Half",
        type: "percentage",
        percentage: 12.5,
        duration: "once",
        appliesToProducts: ["prod_1"],
      }),
    ],
  ],
])("discounts create sends a fractional percentage from %s", async (_from, args) => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const flags =
    args[0] === "--percentage"
      ? ["--name", "Half", "--type", "percentage", "--duration", "once", "--products", "prod_1"]
      : [];
  const result = await h.run(["discounts", "create", ...flags, ...args, "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { createDiscountRequestEntity: expect.objectContaining({ percentage: 12.5 }) },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});
it.each([
  ["a flag", ["--percentage", "12.5"]],
  ["--data", ["--data", JSON.stringify({ percentage: 12.5 })]],
])("discounts update sends a fractional percentage from %s", async (_from, args) => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["discounts", "update", "disc_1", ...args, "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "disc_1", updateDiscountRequestEntity: { percentage: 12.5 } },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
});
it.each([
  ["create", ["--name", "X", "--type", "percentage", "--duration", "once", "--products", "prod_1"]],
  ["update", ["disc_1", "--yes"]],
])(
  "discounts %s refuses a percentage that is not a plain decimal from 1 to 100",
  async (command, args) => {
    for (const percentage of ["0.5", "100.5", "abc", "0x1A", "1e1", " 50"]) {
      const h = harness();
      const spy = vi.spyOn(h.client.discounts, command as "create" | "update");
      const result = await h.run([
        "discounts",
        command,
        ...args,
        "--percentage",
        percentage,
        "--json",
      ]);
      expect(result.code, percentage).toBe(2);
      expect(spy).not.toHaveBeenCalled();
      expect(result.stderr).toContain("percentage");
    }
  },
);
