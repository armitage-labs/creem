import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  compareVersions,
  fetchWithRetry,
  formulaVersion,
  main,
  publishedArtifact,
  publishedCliVersion,
  updateFormula,
  validateVersion,
} from "./update-homebrew.mjs";

const oldFormula = `class Creem < Formula
  url "https://github.com/armitage-labs/creem-cli/releases/download/v0.2.0/creem-cli-0.2.0.tgz"
  sha256 "${"a".repeat(64)}"
  depends_on "node@22"
end
`;
const checksum = "b".repeat(64);
const tarball = "https://registry.npmjs.org/@creem_io/cli/-/cli-0.3.0.tgz";
const bytes = Buffer.from("fixture tarball");
const metadata = {
  name: "@creem_io/cli",
  version: "0.3.0",
  dist: { tarball, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` },
};

test("accepts only exact stable versions; compares numeric components", () => {
  for (const invalid of [
    undefined,
    "latest",
    "v0.3.0",
    "0.3.0-beta.1",
    "0.3.0\n",
    "01.3.0",
    "0.3.0; echo secret",
  ]) {
    assert.throws(() => validateVersion(invalid));
  }
  assert.equal(validateVersion("0.3.0"), "0.3.0");
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareVersions("1.0.0", "0.99.0"), 1);
  assert.equal(compareVersions("0.3.0", "0.3.1"), -1);
});

test("migrates the old tarball and changes only release metadata", () => {
  const updated = updateFormula(oldFormula, "0.3.0", checksum);
  assert.equal(
    updated,
    oldFormula.replace(/https:[^"]+/, tarball).replace("a".repeat(64), checksum),
  );
  assert.equal(formulaVersion(updated), "0.3.0");
  assert.equal(updateFormula(updated, "0.3.0", checksum), updated);
  assert.equal(updateFormula(updated, "0.2.9", checksum), updated);
  assert.equal(
    formulaVersion(updateFormula(`${oldFormula}  version "0.2.0"\n`, "0.3.0", checksum)),
    "0.3.0",
  );
});

test("rejects invalid formula/checksum without guessing", () => {
  assert.throws(() => updateFormula(oldFormula, "0.3.0", "bad"));
  assert.throws(() => updateFormula("class Creem < Formula\nend", "0.3.0", checksum));
  assert.throws(() => updateFormula(oldFormula.replace(/  sha256[^\n]+\n/, ""), "0.3.0", checksum));
  assert.throws(() => updateFormula(`${oldFormula}  sha256 "${checksum}"\n`, "0.3.0", checksum));
});

test("downloads only the expected package and verifies registry integrity", async () => {
  const requests = [];
  const result = await publishedArtifact("0.3.0", {
    fetchImpl: async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "error");
      return requests.length === 1 ? Response.json(metadata) : new Response(bytes);
    },
  });
  assert.deepEqual(requests, ["https://registry.npmjs.org/@creem_io/cli/0.3.0", tarball]);
  assert.deepEqual(result, { tarball, sha256: createHash("sha256").update(bytes).digest("hex") });
});

test("rejects mismatched metadata and missing integrity before downloading", async () => {
  for (const invalid of [
    { ...metadata, name: "creem-cli" },
    { ...metadata, version: "0.2.0" },
    { ...metadata, dist: { ...metadata.dist, tarball: "https://example.com/payload.tgz" } },
    { ...metadata, dist: { tarball } },
  ]) {
    let calls = 0;
    await assert.rejects(
      publishedArtifact("0.3.0", {
        fetchImpl: async () => {
          calls++;
          return Response.json(invalid);
        },
      }),
    );
    assert.equal(calls, 1);
  }
});

test("rejects tampered tarball bytes", async () => {
  await assert.rejects(
    publishedArtifact("0.3.0", {
      fetchImpl: async (url) =>
        url === tarball ? new Response("tampered") : Response.json(metadata),
    }),
    /integrity check/,
  );
});

test("retries registry lag, rate limits, server and network errors", async () => {
  let calls = 0;
  let waits = 0;
  const response = await fetchWithRetry(tarball, {
    fetchImpl: async () => {
      calls++;
      if (calls === 1) throw new TypeError("network unavailable");
      return new Response("", { status: [0, 0, 404, 429, 503, 200][calls] });
    },
    wait: async (delay) => {
      assert.equal(delay, 10_000);
      waits++;
    },
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 5);
  assert.equal(waits, 4);
});

test("stops after bounded retries and fails immediately for permanent errors", async () => {
  for (const status of [404, 401]) {
    let calls = 0;
    await assert.rejects(
      fetchWithRetry(tarball, {
        fetchImpl: async () => {
          calls++;
          return new Response("", { status });
        },
        wait: async () => {},
      }),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(calls, status === 404 ? 6 : 1);
  }
});

test("already-current formula requires no network and writes no changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "homebrew-update-test-"));
  const path = join(dir, "creem.rb");
  try {
    writeFileSync(path, oldFormula);
    await main("0.2.0", path);
    assert.equal(readFileSync(path, "utf8"), oldFormula);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main verifies before writing and exposes retry-safe workflow outputs", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "homebrew-main-test-"));
  const formulaPath = join(dir, "creem.rb");
  const outputPath = join(dir, "output");
  const originalOutput = process.env.GITHUB_OUTPUT;
  process.env.GITHUB_OUTPUT = outputPath;
  t.mock.method(globalThis, "fetch", async (url) =>
    url === tarball ? new Response(bytes) : Response.json(metadata),
  );
  try {
    writeFileSync(formulaPath, oldFormula);
    await main("0.3.0", formulaPath);
    assert.equal(formulaVersion(readFileSync(formulaPath, "utf8")), "0.3.0");
    assert.equal(readFileSync(outputPath, "utf8"), "version=0.3.0\nchanged=true\n");
    await main("0.3.0", formulaPath);
    assert.equal(
      readFileSync(outputPath, "utf8"),
      "version=0.3.0\nchanged=true\nversion=0.3.0\nchanged=false\n",
    );
    writeFileSync(formulaPath, oldFormula);
    t.mock.method(globalThis, "fetch", async (url) =>
      url === tarball ? new Response("bad bytes") : Response.json(metadata),
    );
    await assert.rejects(main("0.3.0", formulaPath), /integrity/);
    assert.equal(readFileSync(formulaPath, "utf8"), oldFormula);
  } finally {
    if (originalOutput === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = originalOutput;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release workflow selects only the CLI's actual published version", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const selection = workflow.slice(
    workflow.indexOf("      - name: Select the published CLI release"),
    workflow.indexOf("\n  homebrew:"),
  );
  assert.match(selection, /if: steps\.changesets\.outputs\.published == 'true'/);
  assert.match(
    selection,
    /PUBLISHED_PACKAGES: \$\{\{ steps\.changesets\.outputs\.publishedPackages \}\}/,
  );
  assert.match(selection, /publishedCliVersion\(process\.env\.PUBLISHED_PACKAGES\)/);
  for (const [packages, expected] of [
    [[], ""],
    [[{ name: "creem", version: "1.7.0" }], ""],
    [
      [
        { name: "creem", version: "1.7.0" },
        { name: "@creem_io/cli", version: "0.3.0" },
      ],
      "0.3.0",
    ],
  ]) {
    assert.equal(publishedCliVersion(JSON.stringify(packages)), expected);
  }
  assert.throws(() => publishedCliVersion('{"name":"@creem_io/cli"}'));
  assert.throws(() => publishedCliVersion("not JSON"));
  assert.throws(() =>
    publishedCliVersion('[{"name":"@creem_io/cli","version":"0.3.0\\nchanged=true"}]'),
  );
  assert.throws(() =>
    publishedCliVersion(
      '[{"name":"@creem_io/cli","version":"0.3.0"},{"name":"@creem_io/cli","version":"0.3.1"}]',
    ),
  );
});
