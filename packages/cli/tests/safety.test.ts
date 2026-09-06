import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it.each([
  [false, false, false],
  [true, true, false],
  [true, false, false],
  [true, false, true],
])("destructive confirmation tty=%s json=%s answer=%s", async (isTTY, json, answer) => {
  const confirm = vi.fn(async () => answer);
  const h = harness(undefined, { isTTY, confirm, environment: () => "live" });
  const spy = vi.spyOn(h.client.splits, "delete").mockRejectedValue(new Error("CALLED"));
  const r = await h.run(["splits", "delete", "split_1", ...(json ? ["--json"] : [])]);
  expect(spy).toHaveBeenCalledTimes(isTTY && !json && answer ? 1 : 0);
  expect(confirm).toHaveBeenCalledTimes(isTTY && !json ? 1 : 0);
  if (isTTY && !json) expect(confirm).toHaveBeenCalledWith("LIVE: splits delete split_1?");
  expect(r.code).toBe(isTTY && !json && answer ? 1 : 2);
});
it("explicit --yes suppresses all prompts", async () => {
  const h = harness();
  vi.spyOn(h.client.splits, "delete").mockResolvedValue({ id: "split_1" } as never);
  const r = await h.run(["--yes", "splits", "delete", "split_1", "--json"]);
  expect(r.code).toBe(0);
  expect(h.context.confirm).not.toHaveBeenCalled();
});
