import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import test from "node:test";

const workflow = readFileSync(".github/workflows/changeset-check.yml", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const docsWorkflow = readFileSync(".github/workflows/docs-ci.yml", "utf8");

function pullRequestPaths(source) {
  const lines = source.split("\n");
  const pullRequestStart = lines.indexOf("  pull_request:");
  assert.notEqual(pullRequestStart, -1, "pull_request trigger is missing");

  const pathsStart = lines.indexOf("    paths:", pullRequestStart);
  assert.notEqual(pathsStart, -1, "pull_request.paths is missing");

  const patterns = [];
  for (const line of lines.slice(pathsStart + 1)) {
    const match = line.match(/^      - ["'](.+)["']$/);
    if (match) {
      patterns.push(match[1]);
      continue;
    }

    const indentation = line.match(/^ */)[0].length;
    if (line.trim() && !line.trimStart().startsWith("#") && indentation <= 4) break;
  }

  assert.notEqual(patterns.length, 0, "pull_request.paths is empty");
  return patterns;
}

const patterns = pullRequestPaths(workflow);
const isCovered = (file) => patterns.some((pattern) => matchesGlob(file, pattern));

test("Changeset Check covers publishable package changes across every layout", () => {
  const triggerMatrix = [
    // Top-level primitives.
    "packages/sdk/src/sdk/sdk.ts",
    "packages/cli/src/index.ts",
    "packages/webhook-types/package.json",

    // Integrations with conventional, root-level, and deeper source layouts.
    "packages/integrations/better-auth/src/index.ts",
    "packages/integrations/nextjs/index.ts",
    "packages/integrations/nextjs/server/checkout.ts",
    "packages/integrations/strapi/admin/src/index.ts",
    "packages/integrations/strapi/server/src/index.ts",
    "packages/integrations/framer/src/main.tsx",

    // UI packages keep their entrypoints and components at package root.
    "packages/ui/embed/index.ts",
    "packages/ui/react/index.tsx",
    "packages/ui/svelte/CreemCheckout.svelte",
    "packages/ui/vue/index.ts",
  ];

  for (const file of triggerMatrix) {
    assert.equal(isCovered(file), true, `${file} should trigger Changeset Check`);
  }
});

test("Changeset Check ignores files outside publishable package trees", () => {
  const ignoredMatrix = [
    "README.md",
    "packages/docs/code/sdks/typescript.mdx",
    "packages/examples/demo/src/index.ts",
    "packages/templates/demo/package.json",
    "packages/creem-sdk/README.md",
  ];

  for (const file of ignoredMatrix) {
    assert.equal(isCovered(file), false, `${file} should not trigger Changeset Check`);
  }
});

test("CI exposes one stable merge gate for every pull request", () => {
  assert.match(ciWorkflow, /^  pull_request:\n    branches: \[main\]$/m);
  assert.match(ciWorkflow, /^  merge-gate:$/m);
  assert.match(ciWorkflow, /^    name: merge-gate$/m);
  assert.doesNotMatch(
    ciWorkflow,
    /^  pull_request:\n(?:    .+\n)*?    paths:/m,
    "the required merge gate must not be skipped by workflow-level path filters",
  );
});

test("documentation validation runs inside the merge gate", () => {
  for (const command of [
    "pnpm --dir packages/docs generate:api:dry-run",
    "pnpm --dir packages/docs validate",
    "pnpm --dir packages/docs check:links",
  ]) {
    assert.ok(ciWorkflow.includes(command), `${command} is missing from the merge gate`);
  }

  assert.match(ciWorkflow, /if: steps\.docs\.outputs\.changed == 'true'/);
});

test("the standalone Docs CI is post-merge or manually dispatched", () => {
  assert.doesNotMatch(docsWorkflow, /^  pull_request:/m);
  assert.match(docsWorkflow, /^  push:\n    branches: \[main\]\n    paths:$/m);
  assert.match(docsWorkflow, /^  workflow_dispatch: \{\}$/m);
});
