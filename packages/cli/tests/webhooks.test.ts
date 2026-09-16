import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("webhooks list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "list").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["webhooks", "list", "--page", "2", "--limit", "5", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    5,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("webhooks create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "webhooks",
    "create",
    "--url",
    "https://example.com/webhooks/creem",
    "--name",
    "Billing",
    "--event",
    "checkout.completed",
    "--event",
    "subscription.paid",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      url: "https://example.com/webhooks/creem",
      name: "Billing",
      events: ["checkout.completed", "subscription.paid"],
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("webhooks create rejects an unknown event type before calling the SDK", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "webhooks",
    "create",
    "--url",
    "https://example.com/webhooks/creem",
    "--event",
    "order.shipped",
    "--json",
  ]);
  expect(spy).not.toHaveBeenCalled();
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("body.events[0] must be one of: checkout.completed");
});
it("webhooks get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "get").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["webhooks", "get", "wh_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "wh_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("webhooks update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "webhooks",
    "update",
    "wh_1",
    "--status",
    "disabled",
    "--url",
    "https://example.com/v2",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "wh_1",
    expect.objectContaining({ status: "disabled", url: "https://example.com/v2" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("webhooks delete requires confirmation and sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "delete").mockRejectedValue(new Error("SDK_SENTINEL"));
  const refused = await h.run(["webhooks", "delete", "wh_1", "--json"]);
  expect(spy).not.toHaveBeenCalled();
  expect(refused.code).toBe(2);
  const result = await h.run(["webhooks", "delete", "wh_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "wh_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("webhooks secret sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.webhooks, "getSecret").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["webhooks", "secret", "wh_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "wh_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
