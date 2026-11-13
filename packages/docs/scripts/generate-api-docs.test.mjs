import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const generator = join(dirname(fileURLToPath(import.meta.url)), "generate-api-docs.js");

// A docs folder with one listed operation (`getWidget`) in the contract, the given
// navigation entries and the given endpoint pages already on disk.
function docsFixture({ navigation, pages = [] }) {
  const dir = mkdtempSync(join(tmpdir(), "generate-api-docs-"));
  const endpointDir = join(dir, "api-reference", "endpoint");
  mkdirSync(endpointDir, { recursive: true });
  // The hidden operations keep HIDDEN_ENDPOINT_ALLOWLIST valid; they need no
  // navigation entry.
  const hidden = [
    "createCustomer",
    "updateCustomer",
    "listCustomerLicenses",
    "listCustomerOrders",
    "listCustomerSubscriptions",
  ];
  const spec = {
    openapi: "3.0.0",
    paths: {
      "/v1/widgets": {
        get: { operationId: "getWidget", summary: "Get widget", description: "Get a widget." },
      },
      ...Object.fromEntries(
        hidden.map((operationId) => [`/v1/hidden/${operationId}`, { get: { operationId } }]),
      ),
    },
  };
  writeFileSync(join(dir, "api-reference", "openapi.json"), JSON.stringify(spec));
  writeFileSync(
    join(dir, "docs.json"),
    JSON.stringify({ navigation: { tabs: [{ tab: "API Reference", pages: navigation }] } }),
  );
  for (const page of pages) {
    writeFileSync(join(endpointDir, page), "---\ntitle: 'Old'\n---\n");
  }
  return { dir, page: (name) => join(endpointDir, name) };
}

function generate(dir, ...args) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [generator, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  return { status, output: stdout + stderr };
}

test("generates pages for every operation in the contract", () => {
  const { dir, page } = docsFixture({ navigation: ["api-reference/endpoint/get-widget"] });
  try {
    const { status } = generate(dir);
    assert.equal(status, 0);
    assert.ok(existsSync(page("get-widget.mdx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a page whose endpoint left the contract fails before anything is written", () => {
  const { dir, page } = docsFixture({
    navigation: ["api-reference/endpoint/get-widget", "api-reference/endpoint/delete-widget"],
    pages: ["delete-widget.mdx"],
  });
  try {
    for (const args of [[], ["--dry-run"]]) {
      const { status, output } = generate(dir, ...args);
      assert.equal(status, 1);
      assert.match(output, /no operation in the OpenAPI spec: delete-widget\.mdx/);
      assert.match(
        output,
        /docs\.json navigation lists endpoint pages that are not in the OpenAPI spec: api-reference\/endpoint\/delete-widget\. /,
      );
    }
    assert.ok(!existsSync(page("get-widget.mdx")));
    assert.ok(existsSync(page("delete-widget.mdx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--cleanup deletes the page only once its navigation entry is gone", () => {
  const { dir, page } = docsFixture({
    navigation: ["api-reference/endpoint/get-widget", "api-reference/endpoint/delete-widget"],
    pages: ["delete-widget.mdx"],
  });
  try {
    const blocked = generate(dir, "--cleanup");
    assert.equal(blocked.status, 1);
    assert.match(blocked.output, /docs\.json navigation lists endpoint pages/);
    assert.doesNotMatch(blocked.output, /no operation in the OpenAPI spec/);
    assert.ok(existsSync(page("delete-widget.mdx")));

    writeFileSync(
      join(dir, "docs.json"),
      JSON.stringify({ navigation: { pages: ["api-reference/endpoint/get-widget"] } }),
    );
    const cleaned = generate(dir, "--cleanup");
    assert.equal(cleaned.status, 0);
    assert.ok(!existsSync(page("delete-widget.mdx")));
    assert.ok(existsSync(page("get-widget.mdx")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a navigation entry without an operation fails even when its page is gone", () => {
  const { dir } = docsFixture({
    navigation: ["api-reference/endpoint/get-widget", "api-reference/endpoint/delete-widget"],
  });
  try {
    const { status, output } = generate(dir, "--dry-run");
    assert.equal(status, 1);
    assert.match(
      output,
      /docs\.json navigation lists endpoint pages that are not in the OpenAPI spec: api-reference\/endpoint\/delete-widget\. /,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a renamed endpoint reports the new page and the stale one in the same run", () => {
  const { dir } = docsFixture({
    navigation: ["api-reference/endpoint/fetch-widget"],
    pages: ["fetch-widget.mdx"],
  });
  try {
    const { status, output } = generate(dir, "--dry-run");
    assert.equal(status, 1);
    assert.match(output, /missing from docs\.json navigation: get-widget\.mdx/);
    assert.match(output, /not in the OpenAPI spec: api-reference\/endpoint\/fetch-widget\. /);
    assert.match(output, /no operation in the OpenAPI spec: fetch-widget\.mdx/);
    assert.match(output, /add a redirect/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an allowlisted hidden page that left the contract fails", () => {
  const { dir } = docsFixture({ navigation: ["api-reference/endpoint/get-widget"] });
  try {
    const path = join(dir, "api-reference", "openapi.json");
    const spec = JSON.parse(readFileSync(path, "utf8"));
    delete spec.paths["/v1/hidden/createCustomer"];
    writeFileSync(path, JSON.stringify(spec));
    const { status, output } = generate(dir, "--dry-run");
    assert.equal(status, 1);
    assert.match(
      output,
      /HIDDEN_ENDPOINT_ALLOWLIST lists pages that are not in the OpenAPI spec: create-customer\.mdx/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
