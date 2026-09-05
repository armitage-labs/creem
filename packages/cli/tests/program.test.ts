import { describe, it, expect } from "vitest";
import { createProgram } from "../src/program";
import { operationManifest } from "../src/operation-manifest";
import { harness } from "./helpers";
describe("command contracts", () => {
  for (const row of operationManifest)
    it(`${row.cliPath} is registered and has working help`, async () => {
      const h = harness();
      const result = await h.run([...row.cliPath.split(" "), "--help"]);
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stderr).toBe("");
    });
  it.each(["cust", "subs", "txn", "credits"])("preserves %s alias", (alias) =>
    expect(createProgram().commands.some((c) => c.aliases().includes(alias))).toBe(true),
  );
  it.each([
    ["--json", "missing"],
    ["products", "get", "--json"],
    ["products", "list", "--page", "3junk", "--json"],
    ["--output", "json", "products", "list", "--bogus"],
  ])("usage errors use stderr JSON: %s", async (...args) => {
    const r = await harness().run(args);
    expect(r.code).toBe(2);
    expect(r.stdout).toBe("");
    expect(JSON.parse(r.stderr).error.type).toBe("validation");
  });
});
