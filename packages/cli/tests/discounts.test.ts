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
    2,
    3,
    "prod_1",
    "active",
    "fixed",
    "2024-01-01",
    "2024-12-31",
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
    undefined,
    "SAVE",
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
    expect.objectContaining({
      name: "Save",
      percentage: 20,
      appliesToProducts: ["prod_1", "prod_2"],
      expiryDate: new Date("2028-01-01"),
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("discounts delete sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.discounts, "delete").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["discounts", "delete", "disc_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "disc_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
