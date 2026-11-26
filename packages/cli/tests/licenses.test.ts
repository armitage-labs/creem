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
    { id: "lic_1", pageNumber: 2, pageSize: 3 },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("never prints the license key: an error that echoes it shows [REDACTED]", async () => {
  const h = harness();
  vi.spyOn(h.client.licenses, "validate").mockRejectedValue(
    new Error("License key license-secret-42 is not valid"),
  );
  const result = await h.run([
    "licenses",
    "validate",
    "--key",
    "license-secret-42",
    "--instance-id",
    "ins_1",
    "--json",
  ]);
  expect(result.stderr).toContain("License key [REDACTED] is not valid");
  expect(result.stderr).not.toContain("license-secret-42");
});
it("redacts a --key that Commander echoes while parsing, before the command runs", async () => {
  const h = harness();
  // The key pasted where --output's value belongs: Commander's own error quotes it.
  const result = await h.run([
    "licenses",
    "validate",
    "--key",
    "license-secret-42",
    "--output",
    "license-secret-42",
  ]);
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("argument '[REDACTED]' is invalid");
  expect(result.stderr).not.toContain("license-secret-42");
});
