import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("migration inherits global JSON and remains a read-only preview", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://api.lemonsqueezy.com");
    return Response.json({
      data: url.pathname.endsWith("/stores")
        ? [{ id: "123", attributes: { name: "Fixture", currency: "USD" } }]
        : [],
      links: { next: null },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  try {
    const clientFactory = vi.fn(() => {
      throw new Error("CREEM_CLIENT_MUST_NOT_BE_CREATED");
    });
    const h = harness(undefined, { client: clientFactory });
    const write = vi.spyOn(h.client.products, "create");
    const consoleLog = vi.spyOn(console, "log");
    const r = await h.run([
      "--json",
      "migrate",
      "lemon-squeezy",
      "--ls-api-key",
      "ls_fixture",
      "--ls-store-id",
      "123",
    ]);
    expect(r.code, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toHaveProperty("products");
    expect(write).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("migration automation fails before any prompt or fetch when approval or credentials are absent", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  try {
    const h = harness();
    const denied = await h.run(["migrate", "lemon-squeezy"]);
    expect(denied.code).toBe(2);
    const noKey = await h.run(["migrate", "lemon-squeezy", "--json"]);
    expect(noKey.code).toBe(3);
    expect(JSON.parse(noKey.stderr).error.message).toContain("--ls-api-key");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
