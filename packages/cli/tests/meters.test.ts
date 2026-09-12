import { it, expect, vi } from "vitest";
import { harness } from "./helpers";

it("meters create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.meters, "createMeter").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "meters",
    "create",
    "--data",
    JSON.stringify({
      name: "tokens",
      eventName: "tokens_used",
      aggregation: "sum",
      aggregationProperty: "tokens",
      unitLabel: "tokens",
    }),
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      name: "tokens",
      eventName: "tokens_used",
      aggregation: "sum",
      aggregationProperty: "tokens",
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.meters, "listMeters").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "meters",
    "list",
    "--limit",
    "7",
    "--starting-after",
    "mtr_1",
    "--include-archived",
    "true",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    7,
    "mtr_1",
    undefined,
    true,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.meters, "getMeter").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["meters", "get", "mtr_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.meters, "updateMeter").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "meters",
    "update",
    "mtr_1",
    "--data",
    JSON.stringify({ name: "tokens-v2" }),
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    expect.objectContaining({ name: "tokens-v2" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters preview sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.meters, "previewMeter")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "meters",
    "preview",
    "--data",
    JSON.stringify({ eventName: "tokens_used", aggregation: "count" }),
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ eventName: "tokens_used", aggregation: "count" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters preview-stored sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.meters, "previewExistingMeter")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["meters", "preview-stored", "mtr_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters consumed sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.meters, "getConsumedUnits")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "meters",
    "consumed",
    "mtr_1",
    "--customer",
    "cust_1",
    "--at",
    "2026-09-01T00:00:00Z",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    "cust_1",
    "2026-09-01T00:00:00Z",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters archive sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.meters, "archiveMeter")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["meters", "archive", "mtr_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("meters unarchive sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.meters, "unarchiveMeter")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["meters", "unarchive", "mtr_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
