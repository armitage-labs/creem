import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("subscriptions get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.subscriptions, "get").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["subscriptions", "get", "sub_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions search sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "search")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["subscriptions", "list", "--page", "2", "--limit", "3", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions cancel sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "cancel")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "subscriptions",
    "cancel",
    "sub_1",
    "--mode",
    "scheduled",
    "--on-execute",
    "pause",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({ mode: "scheduled", onExecute: "pause" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "update")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "subscriptions",
    "update",
    "sub_1",
    "--item",
    '{"id":"item_1","units":2}',
    "--update-behavior",
    "proration-none",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({
      items: [{ id: "item_1", units: 2 }],
      updateBehavior: "proration-none",
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions upgrade sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "upgrade")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "subscriptions",
    "upgrade",
    "sub_1",
    "--product",
    "prod_1",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({ productId: "prod_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions pause sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "pause")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["subscriptions", "pause", "sub_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("subscriptions resume sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.subscriptions, "resume")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["subscriptions", "resume", "sub_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "sub_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
