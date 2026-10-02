import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Convex rejects `paginate()` inside a component ("paginate() is only
// supported in the app"), but convex-test does not, so a component function
// using it passes every test and fails on a real deployment.
describe("component functions", () => {
  it("do not call paginate()", () => {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const offenders = readdirSync(dir)
      .filter((file) => file.endsWith(".ts") && !file.includes(".test."))
      .filter((file) =>
        /\.paginate\s*\(/.test(readFileSync(`${dir}/${file}`, "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
