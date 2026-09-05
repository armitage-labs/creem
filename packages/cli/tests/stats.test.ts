import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("stats getSummary sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.stats, "getSummary").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "stats",
    "summary",
    "--currency",
    "USD",
    "--start-date",
    "1700000000000",
    "--end-date",
    "1800000000000",
    "--interval",
    "day",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "USD",
    1700000000000,
    1800000000000,
    "day",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
