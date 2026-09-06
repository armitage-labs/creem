import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("affiliates createInvite sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.affiliates, "createInvite")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "affiliates",
    "invites",
    "create",
    "--name",
    "Partner",
    "--email",
    "partner@example.com",
    "--program",
    "prog_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Partner", email: "partner@example.com", programId: "prog_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("affiliates listInvites sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.affiliates, "listInvites")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "affiliates",
    "invites",
    "list",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("affiliates list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.affiliates, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["affiliates", "list", "--page", "2", "--limit", "3", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("affiliates retrieve sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.affiliates, "retrieve")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["affiliates", "get", "aff_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "aff_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("affiliates listCommissions sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.affiliates, "listCommissions")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "affiliates",
    "commissions",
    "aff_1",
    "--status",
    "approved",
    "--page",
    "2",
    "--limit",
    "3",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "aff_1",
    "approved",
    2,
    3,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
