#!/usr/bin/env node

/**
 * Inject Speakeasy-generated TypeScript SDK snippets into the Mintlify OpenAPI
 * document as x-codeSamples.
 *
 * The SDK docs are generated from the same OpenAPI source, so this keeps the
 * API Reference examples aligned with the generated SDK without hand-editing
 * every endpoint page.
 */

const fs = require("fs");
const path = require("path");

const docsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(docsRoot, "../..");
const openApiPath = path.join(docsRoot, "api-reference", "openapi.json");
const sdkDocsRoot = path.join(repoRoot, "packages", "creem-sdk", "docs", "sdks");

const SAMPLE_LANG = "typescript";
const SAMPLE_LABEL = "TypeScript SDK";
const LEGACY_LABEL = "Typescript (SDK)";

const CURATED_SAMPLES = {
  updateSubscription: `import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env["CREEM_API_KEY"] ?? "",
});

async function run() {
  const result = await creem.subscriptions.update("sub_1234567890", {
    items: [
      {
        id: "sitem_1234567890",
        priceId: "pprice_1234567890",
        units: 15,
      },
    ],
    updateBehavior: "proration-charge-immediately",
  });

  console.log(result);
}

run();`,
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkMarkdownFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractUsageSnippets() {
  const snippets = new Map();
  const usageSnippetPattern =
    /<!-- UsageSnippet language="typescript" operationID="([^"]+)" method="([^"]+)" path="([^"]+)" -->\s*```typescript\n([\s\S]*?)\n```/g;

  for (const filePath of walkMarkdownFiles(sdkDocsRoot)) {
    const content = fs.readFileSync(filePath, "utf8");
    let match;

    while ((match = usageSnippetPattern.exec(content)) !== null) {
      const [, operationId, method, apiPath, source] = match;
      snippets.set(operationId, {
        method,
        path: apiPath,
        source: CURATED_SAMPLES[operationId] || source.trim(),
      });
    }
  }

  for (const [operationId, source] of Object.entries(CURATED_SAMPLES)) {
    const existing = snippets.get(operationId) || {};
    snippets.set(operationId, {
      ...existing,
      source,
    });
  }

  return snippets;
}

function isSdkSample(sample) {
  return sample?.lang === SAMPLE_LANG && [SAMPLE_LABEL, LEGACY_LABEL].includes(sample.label);
}

function injectSamples(spec, snippets) {
  let injected = 0;
  const missing = [];

  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!operation || typeof operation !== "object" || !operation.operationId) {
        continue;
      }

      const snippet = snippets.get(operation.operationId);
      if (!snippet) {
        missing.push(operation.operationId);
        continue;
      }

      const currentSamples = Array.isArray(operation["x-codeSamples"])
        ? operation["x-codeSamples"].filter((sample) => !isSdkSample(sample))
        : [];

      operation["x-codeSamples"] = [
        ...currentSamples,
        {
          lang: SAMPLE_LANG,
          label: SAMPLE_LABEL,
          source: snippet.source,
        },
      ];

      injected++;
    }
  }

  return { injected, missing };
}

async function formatJson(json) {
  try {
    const prettier = require("prettier");
    return await prettier.format(json, { parser: "json" });
  } catch {
    return `${json}\n`;
  }
}

async function main() {
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI document not found: ${openApiPath}`);
  }

  if (!fs.existsSync(sdkDocsRoot)) {
    throw new Error(`Generated SDK docs not found: ${sdkDocsRoot}`);
  }

  const spec = readJson(openApiPath);
  const snippets = extractUsageSnippets();
  const { injected, missing } = injectSamples(spec, snippets);

  fs.writeFileSync(openApiPath, await formatJson(JSON.stringify(spec, null, 2)));

  console.log(`Injected ${injected} TypeScript SDK code samples into ${openApiPath}`);

  if (missing.length > 0) {
    console.warn(`Missing TypeScript SDK snippets for: ${missing.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
