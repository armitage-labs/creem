import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("checkouts retrieve sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.checkouts, "retrieve").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["checkouts", "get", "ch_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "ch_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("checkouts create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.checkouts, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "checkouts",
    "create",
    "--product",
    "prod_1",
    "--customer-email",
    "person@example.com",
    "--units",
    "3",
    "--custom-price",
    "100",
    "--affiliate-code",
    "aff",
    "--discount",
    "SAVE",
    "--metadata",
    "user=123",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      productId: "prod_1",
      customer: { email: "person@example.com" },
      units: 3,
      customPrice: 100,
      affiliateCode: "aff",
      discountCode: "SAVE",
      metadata: { user: "123" },
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
