import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("moderation screenPrompt sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.moderation, "screenPrompt")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "moderation",
    "screen",
    "--prompt",
    "Hello",
    "--external-id",
    "ext_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ prompt: "Hello", externalId: "ext_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
