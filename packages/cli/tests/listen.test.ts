import { it, expect, vi, afterEach } from "vitest";
import { harness } from "./helpers";

const pendingEvent = {
  id: "evt_1",
  object: "webhook_event",
  eventType: "checkout.completed" as const,
  createdAt: new Date("2026-09-17T08:00:00.000Z"),
  body: '{"id":"evt_1","eventType":"checkout.completed","object":{"id":"ch_1"}}',
  headers: { "creem-signature": "abc123", "Content-Type": "application/json" },
};

function wire(h: ReturnType<typeof harness>) {
  const create = vi.spyOn(h.client.webhooks, "create").mockResolvedValue({
    id: "wh_cli",
    object: "webhook",
    storeId: "sto_1",
    name: "creem listen",
    url: "creem-cli://listen",
    status: "enabled",
    events: [],
    deliveryMode: "cli",
    mode: "test",
    secret: "whsec_test",
  } as never);
  const listPendingEvents = vi
    .spyOn(h.client.webhooks, "listPendingEvents")
    .mockResolvedValue({ items: [pendingEvent] });
  const acknowledgeEvent = vi
    .spyOn(h.client.webhooks, "acknowledgeEvent")
    .mockImplementation(async (_webhookId, eventId, acknowledgment) => ({
      id: eventId,
      object: "webhook_event",
      success: acknowledgment.statusCode >= 200 && acknowledgment.statusCode < 300,
    }));
  const del = vi.spyOn(h.client.webhooks, "delete").mockResolvedValue({ id: "wh_cli" } as never);
  return { create, listPendingEvents, acknowledgeEvent, delete: del };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("creates a temporary CLI endpoint, forwards the raw body and headers, acks, and deletes", async () => {
  const h = harness();
  const spies = wire(h);
  const fetchMock = vi.fn(async () => new Response("OK", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const result = await h.run([
    "listen",
    "--forward-to",
    "http://localhost:3000/api/webhooks",
    "--events",
    "checkout.completed,subscription.paid",
    "--once",
    "--json",
  ]);

  expect(result.code, result.stderr).toBe(0);
  expect(spies.create).toHaveBeenCalledExactlyOnceWith({
    name: expect.stringContaining("creem listen"),
    deliveryMode: "cli",
    events: ["checkout.completed", "subscription.paid"],
  });
  expect(spies.listPendingEvents).toHaveBeenCalledExactlyOnceWith("wh_cli", 100);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "http://localhost:3000/api/webhooks",
    expect.objectContaining({
      method: "POST",
      body: pendingEvent.body,
      headers: pendingEvent.headers,
    }),
  );
  expect(spies.acknowledgeEvent).toHaveBeenCalledExactlyOnceWith("wh_cli", "evt_1", {
    statusCode: 200,
    responseBody: "OK",
  });
  expect(spies.delete).toHaveBeenCalledExactlyOnceWith("wh_cli");

  const lines = result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(lines[0]).toMatchObject({
    type: "listening",
    webhook_id: "wh_cli",
    secret: "whsec_test",
    temporary: true,
  });
  expect(lines[1]).toMatchObject({
    type: "event",
    event_id: "evt_1",
    event_type: "checkout.completed",
    status_code: 200,
    success: true,
  });
  expect(lines[2]).toMatchObject({ type: "stopped", forwarded: 1, failed: 0, deleted: true });
});

it("reports an unreachable local server as a 503 failure and keeps going", async () => {
  const h = harness();
  const spies = wire(h);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") });
    }),
  );

  const result = await h.run(["listen", "--forward-to", "http://localhost:3000/hook", "--once"]);

  expect(result.code, result.stderr).toBe(0);
  expect(spies.acknowledgeEvent).toHaveBeenCalledExactlyOnceWith("wh_cli", "evt_1", {
    statusCode: 503,
    responseBody: expect.stringContaining("ECONNREFUSED"),
  });
  expect(result.stdout).toContain("503");
  expect(result.stdout).toContain("ECONNREFUSED");
  expect(spies.delete).toHaveBeenCalledOnce();
});

it("refuses live mode without --live before touching the API", async () => {
  const h = harness(undefined, { environment: () => "live" });
  const spies = wire(h);

  const result = await h.run(["listen", "--forward-to", "http://localhost:3000/hook", "--once"]);

  expect(result.code).toBe(2);
  expect(result.stderr).toContain("--live");
  expect(spies.create).not.toHaveBeenCalled();
});

it("rejects an unknown event type before creating anything", async () => {
  const h = harness();
  const spies = wire(h);

  const result = await h.run([
    "listen",
    "--forward-to",
    "http://localhost:3000/hook",
    "--events",
    "order.shipped",
    "--once",
  ]);

  expect(result.code).toBe(2);
  expect(result.stderr).toContain("Unknown event type: order.shipped");
  expect(spies.create).not.toHaveBeenCalled();
});

it("reuses an existing CLI endpoint with --webhook and never deletes it", async () => {
  const h = harness();
  const spies = wire(h);
  vi.spyOn(h.client.webhooks, "get").mockResolvedValue({
    id: "wh_mine",
    deliveryMode: "cli",
  } as never);
  vi.spyOn(h.client.webhooks, "getSecret").mockResolvedValue({ secret: "whsec_mine" });
  // A 204 has no body by definition; the Response constructor enforces it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 })),
  );

  const result = await h.run([
    "listen",
    "--forward-to",
    "http://localhost:3000/hook",
    "--webhook",
    "wh_mine",
    "--once",
    "--json",
  ]);

  expect(result.code, result.stderr).toBe(0);
  expect(spies.create).not.toHaveBeenCalled();
  expect(spies.listPendingEvents).toHaveBeenCalledExactlyOnceWith("wh_mine", 100);
  expect(spies.acknowledgeEvent).toHaveBeenCalledExactlyOnceWith("wh_mine", "evt_1", {
    statusCode: 204,
    responseBody: "",
  });
  expect(spies.delete).not.toHaveBeenCalled();
  expect(result.stdout).toContain('"secret":"whsec_mine"');
});

it("refuses --webhook that points at an http endpoint", async () => {
  const h = harness();
  const spies = wire(h);
  vi.spyOn(h.client.webhooks, "get").mockResolvedValue({
    id: "wh_http",
    deliveryMode: "http",
  } as never);

  const result = await h.run([
    "listen",
    "--forward-to",
    "http://localhost:3000/hook",
    "--webhook",
    "wh_http",
    "--once",
  ]);

  expect(result.code).toBe(2);
  expect(result.stderr).toContain("not a CLI-mode endpoint");
  expect(spies.listPendingEvents).not.toHaveBeenCalled();
});

it("stops on SIGINT and deletes the temporary endpoint", async () => {
  const h = harness();
  const spies = wire(h);
  spies.listPendingEvents.mockImplementation(async () => {
    // Interrupt once the loop is provably running.
    setTimeout(() => process.emit("SIGINT"), 0);
    return { items: [] };
  });

  const result = await h.run([
    "listen",
    "--forward-to",
    "http://localhost:3000/hook",
    "--interval",
    "100",
    "--json",
  ]);

  expect(result.code, result.stderr).toBe(0);
  expect(spies.delete).toHaveBeenCalledExactlyOnceWith("wh_cli");
  expect(result.stdout).toContain('"type":"stopped"');
  expect(process.listenerCount("SIGINT")).toBe(0);
});

it("still deletes the endpoint when the poll fails under --once", async () => {
  const h = harness();
  const spies = wire(h);
  spies.listPendingEvents.mockRejectedValue(new Error("SDK_SENTINEL"));

  const result = await h.run(["listen", "--forward-to", "http://localhost:3000/hook", "--once"]);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(spies.delete).toHaveBeenCalledExactlyOnceWith("wh_cli");
});

it.each([
  { statusCode: 200, storedSuccess: false },
  { statusCode: 500, storedSuccess: true },
])(
  "reports the stored acknowledgment outcome for local status $statusCode",
  async ({ statusCode, storedSuccess }) => {
    const h = harness();
    const spies = wire(h);
    spies.acknowledgeEvent.mockResolvedValue({
      id: pendingEvent.id,
      object: "webhook_event",
      success: storedSuccess,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("local result", { status: statusCode })),
    );

    const result = await h.run([
      "listen",
      "--forward-to",
      "http://localhost:3000/hook",
      "--once",
      "--json",
    ]);
    const records = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(result.code, result.stderr).toBe(0);
    expect(records[1]).toMatchObject({
      type: "event",
      status_code: statusCode,
      success: storedSuccess,
    });
    expect(records[2]).toMatchObject({
      type: "stopped",
      forwarded: 1,
      failed: storedSuccess ? 0 : 1,
    });
  },
);

it.each([0, 1])(
  "drains a full pending page and %i additional events under --once",
  async (remaining) => {
    const h = harness();
    const spies = wire(h);
    const page = Array.from({ length: 100 }, (_, index) => ({
      ...pendingEvent,
      id: `evt_${index}`,
    }));
    spies.listPendingEvents
      .mockResolvedValueOnce({ items: page })
      .mockResolvedValueOnce({ items: remaining ? [{ ...pendingEvent, id: "evt_100" }] : [] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("OK", { status: 200 })),
    );

    const result = await h.run([
      "listen",
      "--forward-to",
      "http://localhost:3000/hook",
      "--once",
      "--json",
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(spies.listPendingEvents).toHaveBeenCalledTimes(2);
    expect(spies.acknowledgeEvent).toHaveBeenCalledTimes(100 + remaining);
    expect(spies.delete).toHaveBeenCalledOnce();
    const records = result.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records.at(-1)).toMatchObject({
      type: "stopped",
      forwarded: 100 + remaining,
      failed: 0,
    });
  },
);
