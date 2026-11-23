import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain ES module without types, shared with the CLI that makes the baseline.
import { listPublicExports } from "./public-exports.mjs";

/**
 * ENG-2972: a regeneration may add to the SDK's public API, never take away or
 * change what a name means, or the release isn't a minor one. The baseline is
 * the public API of the last release (`node tests/public-exports.mjs <its SDK
 * root>`); a name it lists must still be exported, and an exported const enum
 * must keep its members (new members may be added).
 */
type Exports = Record<string, Record<string, Record<string, string> | null>>;
const baseline: Exports = JSON.parse(
  readFileSync(join(__dirname, "public-exports.baseline.json"), "utf8"),
);
const current: Exports = listPublicExports(join(__dirname, ".."));

describe("public exports (ENG-2972)", () => {
  for (const [entry, names] of Object.entries(baseline))
    it(`${entry} keeps every name and enum of the last release`, () => {
      const now = current[entry];
      expect(Object.keys(names).filter((name) => !(name in now))).toEqual([]);
      for (const [name, members] of Object.entries(names)) {
        if (!members) continue;
        expect(now[name], `${entry} ${name}`).toEqual(expect.objectContaining(members));
      }
    });
});
