import { it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkOpenApiSync, checkParity, reportFailure } from "../scripts/check-parity.mjs";

const spec = {
  paths: { "/v1/events": { get: { operationId: "listUsageEvents" } } },
};
const empty = { paths: {} };

it("reports the files, counts, missing endpoints and repair command without dumping JSON", () => {
  const largeSpec = { ...spec, description: "irrelevant payload".repeat(20000) };
  let failure: Error | undefined;
  try {
    checkOpenApiSync(JSON.stringify(largeSpec), JSON.stringify(empty));
  } catch (error) {
    failure = error as Error;
  }
  expect(failure?.message).toContain("packages/sdk/openapi.json (1 operations)");
  expect(failure?.message).toContain("packages/docs/api-reference/openapi.json (0 operations)");
  expect(failure?.message).toContain("listUsageEvents (GET /v1/events)");
  expect(failure?.message).toContain("pnpm gen:sdk");
  expect(failure?.message).not.toContain("irrelevant payload");
  expect(failure?.message.length).toBeLessThan(1500);
});

it("keeps byte equality enforcement and identifies formatting-only drift", () => {
  const text = JSON.stringify(spec);
  expect(() => checkOpenApiSync(text, text)).not.toThrow();
  expect(() => checkOpenApiSync(text, JSON.stringify(spec, null, 2))).toThrow(
    "only formatting or key order differs",
  );
});

it("detects schema or metadata drift even with identical operation inventories", () => {
  expect(() =>
    checkOpenApiSync(JSON.stringify(spec), JSON.stringify({ ...spec, info: { title: "changed" } })),
  ).toThrow("The parsed JSON differs");
});

it("reports extra documentation operations", () => {
  expect(() => checkOpenApiSync(JSON.stringify(empty), JSON.stringify(spec))).toThrow(
    "Extra in packages/docs/api-reference/openapi.json: listUsageEvents (GET /v1/events)",
  );
});

it("makes the test-runner manifest error actionable without assertion array diffs", () => {
  expect(() =>
    checkParity({ spec, manifest: [], program: {}, sdkMethods: [], handlerSources: "" }),
  ).toThrow(
    "Missing from packages/cli/src/operation-manifest.json: listUsageEvents (GET /v1/events)",
  );
});

it("reports extra manifest operations and missing SDK mappings", () => {
  expect(() =>
    checkParity({
      spec: empty,
      manifest: [{ operationId: "stale", sdkMethod: "events.stale", cliPath: "events stale" }],
      program: {},
      sdkMethods: [],
      handlerSources: "",
    }),
  ).toThrow("Extra in packages/cli/src/operation-manifest.json: stale");
  expect(() =>
    checkParity({
      spec: empty,
      manifest: [],
      program: {},
      sdkMethods: ["events.list"],
      handlerSources: "",
    }),
  ).toThrow("Missing from packages/cli/src/operation-manifest.json: events.list");
});

it("escapes annotations and appends readable summaries for multiple failures", () => {
  const dir = mkdtempSync(join(tmpdir(), "creem-parity-report-"));
  try {
    const summary = join(dir, "summary.md");
    const output: string[] = [];
    const error = Object.assign(new Error("Missing 100%\n::warning:: <endpoint>"), {
      file: "packages/cli/src/operation-manifest.json",
    });
    reportFailure(error, { github: true, summary, write: (line: string) => output.push(line) });
    reportFailure(new Error("Second failure"), {
      github: true,
      summary,
      write: (line: string) => output.push(line),
    });
    expect(output[0]).toBe(error.message);
    expect(output[1]).toBe(
      "::error file=packages/cli/src/operation-manifest.json,title=CLI parity failed::Missing 100%25%0A::warning:: <endpoint>",
    );
    const text = readFileSync(summary, "utf8");
    expect(text).toContain("Missing 100%\n::warning:: &lt;endpoint&gt;");
    expect(text).toContain("Second failure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("prints plain errors outside GitHub Actions", () => {
  const output: string[] = [];
  reportFailure(new Error("Missing operation"), {
    github: false,
    summary: "",
    write: (line: string) => output.push(line),
  });
  expect(output).toEqual(["Missing operation"]);
});

it("reports both failures in one invocation and exits successfully once both contracts match", () => {
  const dir = mkdtempSync(join(tmpdir(), "creem-parity-cli-"));
  const put = (path: string, text: string) => {
    const file = join(dir, "packages", path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  try {
    put("cli/scripts/check-parity.mjs", readFileSync("scripts/check-parity.mjs", "utf8"));
    put("cli/dist/program.js", "exports.createProgram = () => ({});");
    put("cli/src/operation-manifest.json", "[]");
    put("sdk/openapi.json", JSON.stringify(spec));
    put("docs/api-reference/openapi.json", JSON.stringify(empty));
    put("docs/snippets/cli-reference.mdx", "");
    mkdirSync(join(dir, "packages/sdk/src/sdk"), { recursive: true });
    mkdirSync(join(dir, "packages/cli/src/commands/operations"), { recursive: true });
    const summary = join(dir, "summary.md");
    const run = () =>
      spawnSync(
        process.execPath,
        [join(dir, "packages/cli/scripts/check-parity.mjs"), "--strict"],
        {
          encoding: "utf8",
          env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
        },
      );
    const failed = run();
    expect(failed.status).toBe(1);
    expect(failed.stdout).toBe("");
    expect(failed.stderr).toContain("SDK/docs OpenAPI drift");
    expect(failed.stderr).toContain("OpenAPI/manifest operation drift");
    expect(failed.stderr.match(/::error file=/g)).toHaveLength(2);
    expect(failed.stderr).not.toContain("triggerUncaughtException");
    expect(readFileSync(summary, "utf8")).toContain("listUsageEvents (GET /v1/events)");
    put("sdk/openapi.json", JSON.stringify(empty));
    const passed = run();
    expect(passed.status).toBe(0);
    expect(passed.stderr).toBe("");
    expect(passed.stdout).toContain("CLI parity: 0/0 operations (100%)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("preserves rejection of duplicate SDK methods", () => {
  expect(() =>
    checkParity({
      spec: empty,
      manifest: [],
      program: {},
      sdkMethods: ["events.list", "events.list"],
      handlerSources: "",
    }),
  ).toThrow("expected 2 occurrences; found 0");
});
