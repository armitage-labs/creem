import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  breakingChanges,
  labelLevel,
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
* \`creem.subscriptions.get()\`: \`response\` **Changed** (Breaking ⚠️)
    - \`product.union(ProductEntity).features[].type.enum(githubRepository)\` **Added** (Breaking ⚠️)
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

test("reports breaking changes as Speakeasy marks them, one line per enum value", () => {
  const methods = parseSdkChanges(breakingReport);
  assert.deepEqual(
    methods.map(({ method }) => method),
    [
      "creem.products.get()",
      "creem.subscriptions.get()",
      "creem.products.search()",
      "creem.webhooks.get()",
      "creem.customerCredits.debitAccount()",
    ],
  );
  assert.deepEqual(breakingChanges(methods), [
    {
      change: "New enum value `githubRepository`",
      methods: ["creem.products.get()", "creem.subscriptions.get()", "creem.products.search()"],
    },
    {
      change: "New enum value `marketplace.grant.requested`",
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

test("derives the release level from Speakeasy's markers and the generated source", () => {
  assert.equal(releaseLevel(parseSdkChanges(breakingReport)), "major");
  assert.equal(releaseLevel(parseSdkChanges(additiveReport)), "minor");
  assert.equal(releaseLevel(parseSdkChanges("## Typescript SDK Changes:\n")), "patch");
  assert.equal(releaseLevel(parseSdkChanges("")), "patch");
  // A new schema no operation references yet is not in the report but is exported.
  assert.equal(releaseLevel(parseSdkChanges(""), { sdkFilesChanged: true }), "minor");
  assert.equal(releaseLevel(parseSdkChanges(breakingReport), { sdkFilesChanged: true }), "major");
});

test("a release label overrides the level; conflicting labels fail", () => {
  assert.equal(labelLevel([]), "");
  assert.equal(labelLevel(["documentation", "sdk-release:minor"]), "minor");
  assert.equal(labelLevel(["sdk-release:minor", "sdk-release:minor"]), "minor");
  assert.equal(labelLevel(["sdk-release:huge"]), "");
  assert.throws(() => labelLevel(["sdk-release:minor", "sdk-release:major"]), /Conflicting/);
});

test("reads maxMethodParams from gen.yaml; a missing value is unknown", () => {
  assert.equal(maxMethodParams("typescript:\n  maxMethodParams: 99\n"), 99);
  assert.equal(maxMethodParams("typescript:\n  maxMethodParams: 0\n"), 0);
  assert.equal(maxMethodParams("typescript:\n  version: 1.0.0\n"), null);
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

test("the changeset is the same on every run for the same level", () => {
  assert.equal(
    renderChangeset("minor"),
    `---
"creem": minor
---

Regenerate the SDK from the live Creem API contract.
`,
  );
});

const bodyInput = {
  breaking: [],
  positional: [],
  positionalLimit: 99,
  changesetPath: ".changeset/openapi-sync-cccccccc.md",
  report: additiveReport,
  specUrl: "https://api.creem.io/open-api/json",
  specSha256: "c".repeat(64),
};

test("the body highlights the level and why, and lists breaking changes", () => {
  const methods = parseSdkChanges(breakingReport);
  const body = renderBody({
    ...bodyInput,
    level: "major",
    breaking: breakingChanges(methods),
    methods,
    report: breakingReport,
  });
  assert.match(body, /## Release level: `major`/);
  assert.match(body, /> \[!IMPORTANT\]\n> The changeset releases `creem` as \*\*major\*\*/);
  assert.match(body, /add the label `sdk-release:patch`/);
  assert.match(
    body,
    /The label only works while this pull request has nothing but workflow commits/,
  );
  assert.match(
    body,
    /- New enum value `githubRepository`, in 3 methods: `creem\.products\.get\(\)`/,
  );
  assert.match(body, /peer range/);
  assert.match(body, /<summary>TypeScript SDK changes<\/summary>\n\n## Typescript SDK Changes:/);
  assert.equal(
    body,
    renderBody({
      ...bodyInput,
      level: "major",
      breaking: breakingChanges(methods),
      methods,
      report: breakingReport,
    }),
  );
});

test("the body names a label override next to Speakeasy's suggestion", () => {
  const body = renderBody({ ...bodyInput, level: "minor", suggestedLevel: "major" });
  assert.match(body, /## Release level: `minor`/);
  assert.match(
    body,
    /set by the `sdk-release:minor` label\. Speakeasy's report suggests \*\*major\*\*/,
  );
});

test("the body explains a minor level from generated source without report entries", () => {
  const body = renderBody({ ...bodyInput, level: "minor", sdkFilesChanged: true, report: "" });
  assert.match(body, /lists no method changes, but generated SDK files were added or removed/);
  const patch = renderBody({ ...bodyInput, level: "patch", report: "" });
  assert.match(patch, /no generated files were added or removed/);
});

test("the body warns about positional parameters unless the SDK uses request objects", () => {
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

  const unknown = renderBody({ ...bodyInput, level: "minor", positional, positionalLimit: null });
  assert.match(unknown, /sets no `maxMethodParams`/);

  const requestObjects = renderBody({
    ...bodyInput,
    level: "minor",
    positional,
    positionalLimit: 0,
  });
  assert.doesNotMatch(requestObjects, /New positional parameters/);
});

test("the body reports API reference pages that could not be regenerated", () => {
  const body = renderBody({
    ...bodyInput,
    level: "minor",
    docsError:
      "Error: Generated endpoint pages are missing from docs.json navigation: list-widgets.mdx",
  });
  assert.match(body, /## API reference pages not regenerated/);
  assert.match(body, /list-widgets\.mdx/);
  assert.doesNotMatch(renderBody({ ...bodyInput, level: "minor" }), /not regenerated/);
});

test("the body lists pages of endpoints that left the contract", () => {
  const body = renderBody({ ...bodyInput, level: "minor", docsOrphans: ["list-widgets.mdx"] });
  assert.match(body, /## API reference pages for removed endpoints/);
  assert.match(body, /- `packages\/docs\/api-reference\/endpoint\/list-widgets\.mdx`/);
  assert.doesNotMatch(renderBody({ ...bodyInput, level: "minor" }), /removed endpoints/);
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
      "docs-error": join(dir, "missing-file.txt"),
    };
    const argv = Object.entries(args).map(([key, value]) => `--${key}=${value}`);
    assert.equal(main(argv), "minor");
    assert.match(readFileSync(args.changeset, "utf8"), /"creem": minor/);
    assert.match(readFileSync(args.body, "utf8"), /new query parameter `external_id`/);

    assert.equal(main([...argv, "--labels=sdk-release:patch"]), "patch");
    assert.match(readFileSync(args.changeset, "utf8"), /"creem": patch/);
    assert.match(readFileSync(args.body, "utf8"), /Speakeasy's report suggests \*\*minor\*\*/);

    assert.throws(() => main(["--old=x"]), /Missing --new/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
