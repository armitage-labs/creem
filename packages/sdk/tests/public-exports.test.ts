import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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

/** How the checker prints a reference to `name` declared in `src/models/<module>.ts`. */
const ref = (module: string, name: string) => `import("<sdk>/models/${module}").${name}`;
const UNRECOGNIZED = 'import("<sdk>/types/unrecognized").Unrecognized<string>';
const FILES = 'import("<sdk>/sdk/files").Files';
const method = (result: string) => `(request: string) => Promise<${result}>`;

/**
 * A listing by hand: the sub-SDK method `Files.get` returns `result`, an
 * exported object type with `properties`.
 */
const fileSdk = (properties: Record<string, string>, result = "FileEntity"): Exports => ({
  "models/components/index.ts": {
    [result]: { ref: ref(`components/${result.toLowerCase()}`, result), properties },
  },
  reachable: {
    [FILES]: { properties: { get: method(ref(`components/${result.toLowerCase()}`, result)) } },
  },
});

/** `changes` when `after` adds to `before`'s names and changes `reachable`. */
const changesTo = (before: Exports, after: Exports) => {
  const merged: Exports = { ...after };
  for (const [entry, names] of Object.entries(before))
    if (entry !== "reachable") merged[entry] = { ...names, ...after[entry] };
  return changes(before, merged);
};

describe("public exports (ENG-2972)", () => {
  // Each test builds a TypeScript program synchronously, 2 to 10 s each. Between
  // tests the runner only yields to microtasks, so the worker never reads
  // vitest's RPC replies, and once the file passes birpc's 60 s timeout under
  // CI load it fails with 'Timeout calling "onTaskUpdate"'. A macrotask turn
  // after each test lets the worker read the replies.
  afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));

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

  it("finds a method result whose closed enum lost a member, and lets an open one or a nullable field narrow", () => {
    // A caller's `case "pdf":` stops compiling once the result can't be "pdf".
    const closed = changesTo(
      fileSdk({ kind: '"image" | "pdf"' }),
      fileSdk({ kind: '"image"' }, "FileWriteEntity"),
    );
    expect(closed).toEqual([expect.stringMatching(/Files\.get: /)]);
    // An open enum keeps `Unrecognized<string>`, so `=== "pdf"` still compiles;
    // a field that is no longer `null` or `undefined` only drops a case.
    const open = changesTo(
      fileSdk({ kind: `"image" | "pdf" | ${UNRECOGNIZED}`, note: "string | null | undefined" }),
      fileSdk({ kind: `"image" | ${UNRECOGNIZED}`, note: "string" }, "FileWriteEntity"),
    );
    expect(open).toEqual([]);
    // In the SDK: the discount's open `type` turned into a closed "percentage".
    const narrowed = listEdited({
      "models/components/discountwriteresponseentity.ts": (text) =>
        text.replace(
          /export type DiscountWriteResponseEntityType = OpenEnum<\n {2}typeof DiscountWriteResponseEntityType\n>;/,
          'export type DiscountWriteResponseEntityType = "percentage";',
        ),
    });
    expect(changes(baseline, narrowed)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Discounts\.create: /)]),
    );
  });

  it("finds a result whose two fields fail the same comparison", () => {
    // The second `string -> null` must not pass as already seen.
    const nulled = listEdited({
      "models/components/discountwriteresponseentity.ts": (text) =>
        text
          .replace(/^ {2}id: string;$/m, "  id: null;")
          .replace(/^ {2}externalId: string \| null;$/m, "  externalId: null;"),
    });
    expect(changes(baseline, nulled)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Discounts\.create: /),
        expect.stringMatching(/Discounts\.update: /),
      ]),
    );
    // Without the cached pass, in isolation: the open `kind` tries "pdf"
    // against "image" and fails on the way to a match; `format` then needs
    // that same comparison to hold.
    const reused = changesTo(
      fileSdk({ kind: `"image" | "pdf" | ${UNRECOGNIZED}`, format: '"pdf"' }),
      fileSdk({ kind: `"image" | ${UNRECOGNIZED}`, format: '"image"' }, "FileWriteEntity"),
    );
    expect(reused).toEqual([expect.stringMatching(/Files\.get: /)]);
  });

  it("finds a changed parameter type a method takes, and lets it widen", () => {
    const narrowed = listEdited({
      "lib/sdks.ts": (text) =>
        text.replace("  timeoutMs?: number;\n  /**", "  timeoutMs?: string;\n  /**"),
    });
    expect(changes(baseline, narrowed)).toEqual([
      expect.stringMatching(
        /lib\/sdks"\)\.RequestOptions\.timeoutMs\?: number \| undefined -> string/,
      ),
    ]);
    const widened = listEdited({
      "lib/sdks.ts": (text) =>
        text.replace("  timeoutMs?: number;\n  /**", "  timeoutMs?: number | string;\n  /**"),
    });
    expect(changes(baseline, widened)).toEqual([]);
  });

  it("looks a result's types up by module and name: Status is in two entry points", () => {
    // `status` was the operations' closed Status ("a" | "b"); the result now
    // may be "c". The components' Status of the same name has "c".
    const status = (module: string, members: string[]) => ({
      ref: ref(module, "Status"),
      union: members,
    });
    const listing = (
      result: string,
      declares: Record<string, Record<string, unknown>>,
    ): Exports => ({
      "models/components/index.ts": {
        Status: status("components/thing", ['"a"', '"b"', '"c"']),
        ...declares.components,
      },
      "models/operations/index.ts": {
        Status: status("operations/searchthings", ['"a"', '"b"']),
        ...declares.operations,
      },
      reachable: { [FILES]: { properties: { get: method(result) } } },
    });
    const thing = ref("operations/searchthings", "Thing");
    const before = listing(thing, {
      operations: {
        Thing: { ref: thing, properties: { status: ref("operations/searchthings", "Status") } },
      },
    });
    const thingV2 = ref("components/thingv2", "ThingV2");
    const after = listing(thingV2, {
      components: {
        ThingV2: {
          ref: thingV2,
          properties: { status: ref("components/thingv2", "ThingV2Status") },
        },
        ThingV2Status: {
          ref: ref("components/thingv2", "ThingV2Status"),
          union: ['"a"', '"b"', '"c"'],
        },
      },
    });
    expect(changesTo(before, after)).toEqual([expect.stringMatching(/Files\.get: /)]);
  });

  it("compares the results of an interface the caller implements as they are", () => {
    // Logger reaches the SDK through SDKOptions.debugLogger: the SDK calls it,
    // so a richer result is one the caller's logger doesn't return.
    const logger = (result: string): Exports => ({
      "models/components/index.ts": {
        Label: { ref: ref("components/label", "Label"), properties: { text: "string" } },
        LabelV2: {
          ref: ref("components/labelv2", "LabelV2"),
          properties: { color: "string", text: "string" },
        },
      },
      reachable: {
        'import("<sdk>/lib/logger").Logger': { properties: { group: `() => ${result}` } },
      },
    });
    expect(
      changes(
        logger(ref("components/label", "Label")),
        logger(ref("components/labelv2", "LabelV2")),
      ),
    ).toEqual([expect.stringMatching(/lib\/logger"\)\.Logger\.group: /)]);
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
