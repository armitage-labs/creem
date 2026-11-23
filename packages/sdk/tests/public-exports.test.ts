import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain ES module without types, shared with the CLI that makes the baseline.
import { breakingChanges, listPublicExports } from "./public-exports.mjs";

/**
 * ENG-2972: a regeneration may add to the SDK's public API, never take away or
 * change what a name means, or the release isn't a minor one. The baseline is
 * the public API of the last release, 2.0.0 (`node tests/public-exports.mjs
 * <its SDK root>`): every exported name, the members of its const enums and
 * unions, and the type of each property, function and constant. A name it lists
 * must still be exported and declare the same; additions are allowed, and a
 * request type may take more (see `breakingChanges`).
 */
type Exports = Record<string, Record<string, unknown>>;
type Edit = (file: string, text: string) => string;
const list = listPublicExports as (root: string, edit?: Edit) => Exports;
const changes = breakingChanges as (baseline: Exports, current: Exports) => string[];

const root = join(__dirname, "..");
const baseline: Exports = JSON.parse(
  readFileSync(join(__dirname, "public-exports.baseline.json"), "utf8"),
);

/** Reads the SDK with `edit` applied to the files it names (by path below `src`). */
const listEdited = (files: Record<string, (text: string) => string>) =>
  list(root, (file, text) => {
    const path = relative(join(root, "src"), file).split("\\").join("/");
    return files[path] ? files[path](text) : text;
  });

describe("public exports (ENG-2972)", () => {
  it("keeps every name, enum member and declaration of the last release", () => {
    expect(changes(baseline, list(root))).toEqual([]);
  });

  it("passes after version-packages bumps the SDK's version metadata", () => {
    // The release script itself, on a copy of the files it rewrites.
    const copy = mkdtempSync(join(tmpdir(), "creem-sdk-version-"));
    try {
      const files = [
        "package.json",
        "jsr.json",
        ".speakeasy/gen.yaml",
        "src/lib/config.ts",
        "src/mcp-server/mcp-server.ts",
        "src/mcp-server/server.ts",
        "package-lock.json",
        "examples/package-lock.json",
      ];
      for (const file of files) {
        mkdirSync(dirname(join(copy, "packages/sdk", file)), { recursive: true });
        cpSync(join(root, file), join(copy, "packages/sdk", file));
      }
      const manifest = join(copy, "packages/sdk/package.json");
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      writeFileSync(manifest, JSON.stringify({ ...pkg, version: "9.8.7" }));
      execFileSync(process.execPath, [join(root, "../../scripts/sync-sdk-version.mjs")], {
        cwd: copy,
        stdio: "pipe",
      });
      const config = readFileSync(join(copy, "packages/sdk/src/lib/config.ts"), "utf8");
      expect(config).toContain('sdkVersion: "9.8.7"');
      expect(changes(baseline, listEdited({ "lib/config.ts": () => config }))).toEqual([]);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it("finds an exported property whose type changed", () => {
    const retyped = listEdited({
      "models/operations/searchdiscounts.ts": (text) =>
        text.replace("status?: Status | undefined;", "status?: number | undefined;"),
    });
    expect(changes(baseline, retyped)).toEqual([
      expect.stringContaining("SearchDiscountsRequest.status?"),
    ]);
  });

  it("finds a renamed method of a sub-SDK reachable from the client", () => {
    const renamed = listEdited({
      "sdk/products.ts": (text) => text.replace("async get(", "async getRenamed("),
    });
    expect(changes(baseline, renamed)).toEqual([
      expect.stringMatching(/sdk\/products"\)\.Products\.get: .* -> removed$/),
    ]);
  });

  it("finds a sub-SDK method whose return type changed", () => {
    const retyped = listEdited({
      "sdk/products.ts": (text) =>
        text.replace(
          "options?: RequestOptions,\n  ): Promise<components.ProductEntity> {\n    return unwrapAsync(productsGet(",
          "options?: RequestOptions,\n  ): Promise<unknown> {\n    return unwrapAsync(productsGet(",
        ),
    });
    expect(changes(baseline, retyped)).toEqual([
      expect.stringMatching(/Products\.get: .*Promise<unknown>$/),
    ]);
  });

  it("lets a method return a type that keeps every field of the old one, and finds one that drops a field", () => {
    // Discounts.create returned DiscountEntity in 2.0.0; it now returns
    // DiscountWriteResponseEntity: the same fields (its enums renamed, same
    // members) plus writeResult.
    expect(changes(baseline, list(root)).filter((c) => c.includes("Discounts.create"))).toEqual([]);
    const dropped = listEdited({
      "models/components/discountwriteresponseentity.ts": (text) =>
        text.replace(/^ {2}code: string;$/m, ""),
    });
    expect(changes(baseline, dropped)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Discounts\.create: /)]),
    );
  });

  it("finds a sub-SDK method whose parameters changed", () => {
    const retyped = listEdited({
      "sdk/productgroups.ts": (text) =>
        text.replace(
          /async get\(\n {4}request: operations\.\w+,/,
          "async get(\n    request: string,",
        ),
    });
    expect(changes(baseline, retyped)).toEqual([
      expect.stringMatching(/ProductGroups\.get: \(request: import.* -> \(request: string/),
    ]);
  });

  it("finds a callable type whose return type changed", () => {
    const retyped = listEdited({
      "lib/http.ts": (text) =>
        text.replace(
          "  init?: RequestInit,\n) => Promise<Response>;",
          "  init?: RequestInit,\n) => Promise<unknown>;",
        ),
    });
    expect(changes(baseline, retyped)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/index\.ts Fetcher: call signature .* removed/),
      ]),
    );
  });

  it("finds a response property that became optional and a lost enum member", () => {
    const edited = listEdited({
      "models/components/productgroupentity.ts": (text) =>
        text
          .replace(
            "upgradeBehavior: UpgradeBehavior | null;",
            "upgradeBehavior?: UpgradeBehavior | null;",
          )
          .replace('ProrationNone: "proration-none",', ""),
    });
    expect(changes(baseline, edited)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ProductGroupEntity.upgradeBehavior"),
        expect.stringContaining("UpgradeBehavior: enum member ProrationNone changed"),
      ]),
    );
  });
});
