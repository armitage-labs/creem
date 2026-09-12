import { it, expect, vi } from "vitest";
import { harness } from "./helpers";

it("events ingest sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.events, "ingestEvents")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "events",
    "ingest",
    "--data",
    JSON.stringify({
      events: [
        {
          name: "tokens_used",
          customerId: "cust_1",
          eventId: "evt-abc",
          metadata: { tokens: 512 },
        },
      ],
    }),
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      events: [
        expect.objectContaining({
          name: "tokens_used",
          customerId: "cust_1",
          eventId: "evt-abc",
        }),
      ],
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("events list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.events, "listEvents").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "events",
    "list",
    "--meter",
    "mtr_1",
    "--customer",
    "cust_1",
    "--reference",
    "evt-abc",
    "--limit",
    "5",
    "--starting-after",
    "uev_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "mtr_1",
    "cust_1",
    "evt-abc",
    5,
    "uev_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
