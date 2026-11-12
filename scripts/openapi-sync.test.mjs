import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  breakingChanges,
  main,
  maxMethodParams,
  newPositionalParameters,
  parseSdkChanges,
  releaseLevel,
  renderBody,
  renderChangeset,
} from "./openapi-sync.mjs";

// Shaped like Speakeasy's changes.md (`speakeasy diff files -l typescript`).
const breakingReport = `## Typescript SDK Changes:
* \`creem.products.get()\`: \`response\` **Changed** (Breaking ⚠️)
    - \`features[].type.enum(githubRepository)\` **Added** (Breaking ⚠️)
    - \`metadata\` **Added**
* \`creem.products.search()\`:
  *  \`request.externalId\` **Added**
  * \`response.items[]\` **Changed** (Breaking ⚠️)
    - \`features[].type.enum(githubRepository)\` **Added** (Breaking ⚠️)
* \`creem.webhooks.get()\`:  \`response.events[].enum(marketplace.grant.requested)\` **Added** (Breaking ⚠️)
* \`creem.customerCredits.debitAccount()\`:
  * \`request\` **Changed** (Breaking ⚠️)
    - \`creditDebitRequestDto\` **Removed** (Breaking ⚠️)
    - \`debitRequestDto\` **Added** (Breaking ⚠️)
  *  \`response.moderationId\` **Added**
`;

const additiveReport = `## Typescript SDK Changes:
* \`creem.meters.getMeter()\`:  \`response.externalId\` **Added**
* \`creem.stats.getSummary()\`: **Added**
`;

const spec = (parameters) => ({
  openapi: "3.0.0",
  paths: {
    "/v1/products/search": {
      get: { operationId: "searchProducts", parameters },
    },
  },
});

test("reports breaking changes at the level Speakeasy marks them, grouped across methods", () => {
  const methods = parseSdkChanges(breakingReport);
  assert.deepEqual(
    methods.map(({ method }) => method),
    [
      "creem.products.get()",
      "creem.products.search()",
      "creem.webhooks.get()",
      "creem.customerCredits.debitAccount()",
    ],
  );
  assert.deepEqual(breakingChanges(methods), [
    {
      change: "`features[].type.enum(githubRepository)` **Added**",
      methods: ["creem.products.get()", "creem.products.search()"],
    },
    {
      change: "`response.events[].enum(marketplace.grant.requested)` **Added**",
      methods: ["creem.webhooks.get()"],
    },
    {
      change: "`creditDebitRequestDto` **Removed**",
      methods: ["creem.customerCredits.debitAccount()"],
    },
    {
      change: "`debitRequestDto` **Added**",
      methods: ["creem.customerCredits.debitAccount()"],
    },
  ]);
});

test("derives the release level from Speakeasy's markers", () => {
  assert.equal(releaseLevel(parseSdkChanges(breakingReport)), "major");
  assert.equal(releaseLevel(parseSdkChanges(additiveReport)), "minor");
  assert.equal(releaseLevel(parseSdkChanges("## Typescript SDK Changes:\n")), "patch");
  assert.equal(releaseLevel(parseSdkChanges("")), "patch");
});

test("reads maxMethodParams from gen.yaml", () => {
  assert.equal(maxMethodParams("typescript:\n  maxMethodParams: 99\n"), 99);
  assert.equal(maxMethodParams("typescript:\n  maxMethodParams: 0\n"), 0);
  assert.equal(maxMethodParams("typescript:\n  version: 1.0.0\n"), 0);
});

test("finds new parameters on existing operations only", () => {
  const before = spec([{ in: "query", name: "page_number" }]);
  const after = spec([
    { in: "query", name: "page_number" },
    { in: "query", name: "external_id" },
    { $ref: "#/components/parameters/Shared" },
  ]);
  after.paths["/v1/stats"] = {
    get: { operationId: "getStats", parameters: [{ in: "query", name: "from" }] },
  };
  assert.deepEqual(newPositionalParameters(before, after), [
    {
      operationId: "searchProducts",
      endpoint: "GET /v1/products/search",
      location: "query",
      name: "external_id",
    },
  ]);
  assert.deepEqual(newPositionalParameters(after, after), []);
});

test("renders a changeset for the creem package", () => {
  assert.equal(
    renderChangeset("minor", "2026-11-12"),
    `---
"creem": minor
---

Regenerate the SDK from the live Creem API contract (2026-11-12).
`,
  );
});

const bodyInput = {
  breaking: [],
  positional: [],
  positionalLimit: 99,
  report: additiveReport,
  specUrl: "https://api.creem.io/open-api/json",
  specSha256: "c".repeat(64),
  date: "2026-11-12",
};

test("the body highlights the level and why, and lists breaking changes", () => {
  const methods = parseSdkChanges(breakingReport);
  const body = renderBody({
    ...bodyInput,
    level: "major",
    breaking: breakingChanges(methods),
    report: breakingReport,
  });
  assert.match(body, /## Release level: `major`/);
  assert.match(body, /> \[!IMPORTANT\]\n> The changeset releases `creem` as \*\*major\*\*/);
  assert.match(
    body,
    /- `features\[\]\.type\.enum\(githubRepository\)` \*\*Added\*\*, in 2 methods: `creem\.products\.get\(\)`, `creem\.products\.search\(\)`/,
  );
  assert.match(body, /<summary>TypeScript SDK changes<\/summary>\n\n## Typescript SDK Changes:/);
});

test("the body warns about positional parameters only while the SDK uses them", () => {
  const positional = [
    {
      operationId: "searchProducts",
      endpoint: "GET /v1/products/search",
      location: "query",
      name: "external_id",
    },
  ];
  const warned = renderBody({ ...bodyInput, level: "minor", positional });
  assert.match(warned, /## New positional parameters/);
  assert.match(
    warned,
    /`searchProducts` \(`GET \/v1\/products\/search`\): new query parameter `external_id`/,
  );

  const requestObjects = renderBody({
    ...bodyInput,
    level: "minor",
    positional,
    positionalLimit: 0,
  });
  assert.doesNotMatch(requestObjects, /New positional parameters/);
});

test("the body stays under GitHub's size limit", () => {
  const body = renderBody({ ...bodyInput, level: "minor", report: "x".repeat(200_000) });
  assert.ok(body.length < 65_536);
  assert.match(body, /The report is truncated/);
});

test("main writes the changeset and the body and returns the level", () => {
  const dir = mkdtempSync(join(tmpdir(), "openapi-sync-"));
  try {
    const file = (name, content) => {
      const path = join(dir, name);
      writeFileSync(path, content);
      return path;
    };
    const args = {
      old: file("old.json", JSON.stringify(spec([]))),
      new: file("new.json", JSON.stringify(spec([{ in: "query", name: "external_id" }]))),
      report: file("changes.md", additiveReport),
      "gen-yaml": file("gen.yaml", "typescript:\n  maxMethodParams: 99\n"),
      changeset: join(dir, "changeset.md"),
      body: join(dir, "body.md"),
      "spec-url": "https://api.creem.io/open-api/json",
      "spec-sha256": "d".repeat(64),
      date: "2026-11-12",
    };
    const level = main(Object.entries(args).map(([key, value]) => `--${key}=${value}`));
    assert.equal(level, "minor");
    assert.match(readFileSync(args.changeset, "utf8"), /"creem": minor/);
    assert.match(readFileSync(args.body, "utf8"), /new query parameter `external_id`/);
    assert.throws(() => main(["--old=x"]), /Missing --new/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
