import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("customers list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customers, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customers", "list", "--page", "2", "--limit", "3", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers getOrders sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customers, "getOrders")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customers",
    "orders",
    "cust_1",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cust_1",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers listSubscriptions sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customers, "listSubscriptions")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customers",
    "subscriptions",
    "cust_1",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cust_1",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers listLicenses sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customers, "listLicenses")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customers",
    "licenses",
    "cust_1",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cust_1",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers retrieve sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customers, "retrieve").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customers", "get", "--email", "person@example.com", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    undefined,
    "person@example.com",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customers, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customers",
    "create",
    "--email",
    "person@example.com",
    "--name",
    "Person",
    "--metadata",
    "x=1",
    "--metadata",
    "x=2",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ email: "person@example.com", name: "Person", metadata: { x: "2" } }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customers, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customers",
    "update",
    "cust_1",
    "--name",
    "Updated",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ customerId: "cust_1", name: "Updated" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customers generateBillingLinks sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customers, "generateBillingLinks")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customers", "billing", "cust_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ customerId: "cust_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
