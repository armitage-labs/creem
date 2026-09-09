import { it, expect } from "vitest";
import { Creem } from "creem";
import { harness } from "./helpers";
it.skipIf(!process.env.TEST_API_KEY)(
  "optional test API smoke is read-only and rejects live keys",
  async () => {
    const key = process.env.TEST_API_KEY!;
    expect(key.startsWith("creem_test_")).toBe(true);
    const h = harness(
      new Creem({
        apiKey: key,
        server: "test",
        retryConfig: { strategy: "none" },
        timeoutMs: 15000,
      }),
    );
    const r = await h.run(["products", "list", "--limit", "1", "--json"]);
    expect(r.code, r.stderr).toBe(0);
    expect(Array.isArray(JSON.parse(r.stdout).items)).toBe(true);
  },
  20000,
);
