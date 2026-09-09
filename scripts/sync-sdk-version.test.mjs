import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/sync-sdk-version.mjs");
const files = [
  "package.json",
  "jsr.json",
  ".speakeasy/gen.yaml",
  ".speakeasy/gen.lock",
  ".speakeasy/workflow.lock",
  "RELEASES.md",
  "src/lib/config.ts",
  "src/mcp-server/mcp-server.ts",
  "src/mcp-server/server.ts",
  "package-lock.json",
  "examples/package-lock.json",
];

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "creem-sdk-version-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const path = (file) => join(cwd, "packages/sdk", file);
  for (const file of files) {
    mkdirSync(dirname(path(file)), { recursive: true });
    copyFileSync(join("packages/sdk", file), path(file));
  }
  const read = (file) => readFileSync(path(file), "utf8");
  const write = (file, contents) => writeFileSync(path(file), contents);
  const snapshot = () => Object.fromEntries(files.map((file) => [file, read(file)]));
  const version = (value) => {
    const pkg = JSON.parse(read("package.json"));
    pkg.version = value;
    write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  };
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { read, write, snapshot, version, run };
}

test("sync follows the package version, preserves generation history, and is idempotent", (t) => {
  const f = fixture(t);
  f.version("9.8.7-rc.1+build.2");
  const before = f.snapshot();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  for (const file of [
    "package.json",
    ".speakeasy/gen.lock",
    ".speakeasy/workflow.lock",
    "RELEASES.md",
  ]) {
    assert.equal(f.read(file), before[file], `${file} must be preserved`);
  }
  const json = (file) => JSON.parse(f.read(file));
  assert.equal(json("jsr.json").version, "9.8.7-rc.1+build.2");
  assert.equal(json("package-lock.json").version, "9.8.7-rc.1+build.2");
  assert.equal(json("package-lock.json").packages[""].version, "9.8.7-rc.1+build.2");
  assert.equal(json("examples/package-lock.json").packages[".."].version, "9.8.7-rc.1+build.2");
  assert.ok(f.read(".speakeasy/gen.yaml").includes("version: 9.8.7-rc.1+build.2"));
  assert.ok(f.read("src/lib/config.ts").includes('sdkVersion: "9.8.7-rc.1+build.2"'));
  const oldAgent = before["src/lib/config.ts"].match(/userAgent: "([^"]+)"/)[1];
  const newAgent = f.read("src/lib/config.ts").match(/userAgent: "([^"]+)"/)[1];
  assert.equal(newAgent, oldAgent.replace(/^(\S+ )\S+/, "$19.8.7-rc.1+build.2"));
  assert.ok(
    f.read("src/mcp-server/mcp-server.ts").includes('currentVersion: "9.8.7-rc.1+build.2"'),
  );
  assert.ok(f.read("src/mcp-server/server.ts").includes('version: "9.8.7-rc.1+build.2"'));
  const after = f.snapshot();
  assert.equal(f.run("--check").status, 0);
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.snapshot(), after);
});

test("check reports drift without writing files", (t) => {
  const f = fixture(t);
  f.version("9.8.7");
  const before = f.snapshot();
  const result = f.run("--check");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SDK version metadata does not match/);
  assert.match(result.stderr, /src\/mcp-server\/server.ts/);
  assert.deepEqual(f.snapshot(), before);
});

for (const change of ["missing", "duplicate"]) {
  test(`a ${change} generated version field fails before writing any files`, (t) => {
    const f = fixture(t);
    f.version("9.8.7");
    const source = f.read("src/mcp-server/server.ts");
    f.write(
      "src/mcp-server/server.ts",
      source.replace(/^(    version: .+)$/m, change === "missing" ? "" : "$1\n$1"),
    );
    const before = f.snapshot();
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected exactly one MCP server version/);
    assert.deepEqual(f.snapshot(), before);
  });
}

test("unchanged SDK versions leave file contents and formatting alone", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const lock = JSON.parse(f.read("package-lock.json"));
  f.write("package-lock.json", JSON.stringify(lock));
  const before = f.snapshot();
  assert.equal(f.run("--check").status, 0);
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.snapshot(), before);
});
