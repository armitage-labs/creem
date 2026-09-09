import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("licenses activate sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.licenses, "activate").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "licenses",
    "activate",
    "--key",
    "license-secret",
    "--instance-name",
    "Laptop",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ key: "license-secret", instanceName: "Laptop" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("licenses validate sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.licenses, "validate").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "licenses",
    "validate",
    "--key",
    "license-secret",
    "--instance-id",
    "ins_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ key: "license-secret", instanceId: "ins_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("licenses deactivate sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.licenses, "deactivate")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "licenses",
    "deactivate",
    "--key",
    "license-secret",
    "--instance-id",
    "ins_1",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ key: "license-secret", instanceId: "ins_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("licenses listInstances sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.licenses, "listInstances")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "licenses",
    "instances",
    "lic_1",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "lic_1",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
