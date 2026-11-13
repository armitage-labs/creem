#!/usr/bin/env node

/**
 * OpenAPI to MDX Generator for Creem API Documentation
 *
 * This script fetches the OpenAPI spec and generates MDX files for Mintlify docs.
 * It uses the OpenAPI `summary` and `description` fields when available.
 *
 * Usage:
 *   node scripts/generate-api-docs.js [--url <openapi-url>] [--file <openapi-file>] [--dry-run]
 *
 * Options:
 *   --url <url>     Fetch OpenAPI spec from URL (default: uses local file)
 *   --file <path>   Read OpenAPI spec from local file (default: api-reference/openapi.json)
 *   --dry-run       Preview changes without writing files
 *   --update-spec   Update the local openapi.json from the remote URL
 */

const fs = require("fs");
const path = require("path");

// Exception-only mapping: OpenAPI operationId -> stable MDX slug (without .mdx).
// Add an entry only when the desired public docs filename differs from the
// automatic camelCase-to-kebab-case filename. Do not add no-op mappings such
// as `createProduct: "create-product"`.
const FILENAME_OVERRIDES = {
  retrieveCustomer: "get-customer",
  retrieveSubscription: "get-subscription",
  retrieveCheckout: "get-checkout",
  retrieveDiscount: "get-discount-code",
  generateCustomerLinks: "create-customer-billing",
  getTransactionById: "get-transaction",
  searchTransactions: "get-transactions",
  createDiscount: "create-discount-code",
  deleteDiscount: "delete-discount-code",
  getMetricsSummary: "get-stats-summary",
  createCustomerCreditsAccount: "create-credits-account",
  listCustomerCreditsAccounts: "list-credits-accounts",
  getCustomerCreditsAccount: "get-credits-account",
  getCustomerCreditsAccountBalance: "get-credits-account-balance",
  listCustomerCreditsAccountEntries: "list-credits-entries",
  freezeCustomerCreditsAccount: "freeze-credits-account",
  unfreezeCustomerCreditsAccount: "unfreeze-credits-account",
  creditCustomerCreditsAccount: "credit-account",
  debitCustomerCreditsAccount: "debit-account",
  reverseCustomerCreditsAccountTransaction: "reverse-credits-transaction",
  closeCustomerCreditsAccount: "close-credits-account",
  postCustomerCreditsTransaction: "post-credits-transaction",
  getCustomerCreditsTransaction: "get-credits-transaction",
  reverseCustomerCreditsTransaction: "reverse-credits-transaction-by-id",
  listCustomerCreditsTransactionsByReference: "list-credits-transactions",
};

// Fallback descriptions when not provided in OpenAPI spec
const DESCRIPTION_FALLBACKS = {
  updateCustomer:
    "Update a customer's name, email, metadata or external id. Only the fields you send change.",
};

// Endpoint pages intentionally kept public but omitted from the curated API
// reference navigation. Every other generated endpoint must be navigable.
const HIDDEN_ENDPOINT_ALLOWLIST = new Set([
  "create-customer.mdx",
  "update-customer.mdx",
  "list-customer-licenses.mdx",
  "list-customer-orders.mdx",
  "list-customer-subscriptions.mdx",
]);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    file: "api-reference/openapi.json",
    dryRun: false,
    updateSpec: false,
    cleanup: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        options.url = args[++i];
        break;
      case "--file":
        options.file = args[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--update-spec":
        options.updateSpec = true;
        break;
      case "--cleanup":
        options.cleanup = true;
        break;
      case "--help":
        console.log(`
OpenAPI to MDX Generator for Creem API Documentation

Usage:
  node scripts/generate-api-docs.js [options]

Options:
  --url <url>      Fetch OpenAPI spec from URL
  --file <path>    Read OpenAPI spec from local file (default: api-reference/openapi.json)
  --dry-run        Preview changes without writing files
  --update-spec    Update the local openapi.json from the remote URL
  --cleanup        Delete orphaned MDX files (endpoints removed from spec)
  --help           Show this help message

The script uses OpenAPI 'summary' as title and 'description' for the MDX description.
Add these in your NestJS controllers using @ApiOperation decorator:

  @ApiOperation({
    summary: 'Get Product',
    description: 'Retrieve product details by ID...'
  })
        `);
        process.exit(0);
    }
  }

  return options;
}

// Fetch OpenAPI spec from URL
async function fetchOpenApiSpec(url) {
  console.log(`Fetching OpenAPI spec from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Read OpenAPI spec from file
function readOpenApiSpec(filePath) {
  console.log(`Reading OpenAPI spec from: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// Convert operationId to kebab-case filename
function operationIdToFilename(operationId) {
  // Check for override first
  if (FILENAME_OVERRIDES[operationId]) {
    return FILENAME_OVERRIDES[operationId] + ".mdx";
  }

  // Convert camelCase to kebab-case
  return operationId.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() + ".mdx";
}

function collectNavigationPages(value, pages = new Set()) {
  if (typeof value === "string") {
    pages.add(value);
    return pages;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectNavigationPages(item, pages);
    }
    return pages;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      collectNavigationPages(child, pages);
    }
  }

  return pages;
}

// Endpoint pages must match the contract, so every problem below fails the run
// before any page is written. They are collected and reported together, so a
// renamed endpoint shows its new page and its stale one in the same run. An
// endpoint that left the contract must not stay published: its page and its
// navigation entry both fail the run until they are removed. --cleanup deletes
// the pages, but only once no navigation entry points at them any more. The
// problems stay on one line, because the OpenAPI sync quotes the `Error:` line.
function validateEndpointPages(generatedFiles, outputDir, cleanup) {
  const docsConfigPath = path.join(process.cwd(), "docs.json");
  const docsConfig = JSON.parse(fs.readFileSync(docsConfigPath, "utf-8"));
  const navigationPages = collectNavigationPages(docsConfig.navigation);
  const prefix = "api-reference/endpoint/";
  const missingFromNavigation = [...generatedFiles]
    .filter((filename) => !HIDDEN_ENDPOINT_ALLOWLIST.has(filename))
    .filter((filename) => !navigationPages.has(`${prefix}${filename.replace(/\.mdx$/, "")}`))
    .sort();
  const staleNavigation = [...navigationPages]
    .filter((page) => page.startsWith(prefix))
    .filter((page) => !generatedFiles.has(`${page.slice(prefix.length)}.mdx`))
    .sort();
  const staleAllowlist = [...HIDDEN_ENDPOINT_ALLOWLIST]
    .filter((filename) => !generatedFiles.has(filename))
    .sort();
  const orphanedFiles = fs
    .readdirSync(outputDir)
    .filter((filename) => filename.endsWith(".mdx") && !generatedFiles.has(filename))
    .sort();

  const problems = [];
  if (missingFromNavigation.length > 0) {
    problems.push(
      `Generated endpoint pages are missing from docs.json navigation: ${missingFromNavigation.join(
        ", ",
      )}. Add them to navigation or explicitly document them in HIDDEN_ENDPOINT_ALLOWLIST.`,
    );
  }
  if (staleNavigation.length > 0) {
    problems.push(
      `docs.json navigation lists endpoint pages that are not in the OpenAPI spec: ${staleNavigation.join(
        ", ",
      )}. Remove these navigation entries, and add a redirect if the endpoint was renamed.`,
    );
  }
  if (staleAllowlist.length > 0) {
    problems.push(
      `HIDDEN_ENDPOINT_ALLOWLIST lists pages that are not in the OpenAPI spec: ${staleAllowlist.join(
        ", ",
      )}. Remove them from the list.`,
    );
  }
  if (orphanedFiles.length > 0 && !cleanup) {
    problems.push(
      `Endpoint pages have no operation in the OpenAPI spec: ${orphanedFiles.join(
        ", ",
      )}. Delete them (generate:api:cleanup does this once their navigation entries are gone).`,
    );
  }
  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }
  return orphanedFiles;
}

// Get description from OpenAPI or fallback
function getDescription(operationId, operation) {
  // Use OpenAPI description if available
  if (operation.description) {
    return operation.description;
  }

  // Use fallback
  return DESCRIPTION_FALLBACKS[operationId] || operation.summary || "API endpoint documentation.";
}

// Get title from OpenAPI summary (used as-is from spec)
function getTitle(operationId, operation) {
  // Use summary directly as defined in the spec
  if (operation.summary) {
    // Only remove trailing period if present
    return operation.summary.replace(/\.$/, "");
  }

  // Fallback: generate from operationId
  return operationId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (str) => str.toUpperCase());
}

function quoteYamlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

// Parse existing MDX file to extract frontmatter and content
function parseExistingMdx(filePath) {
  if (!fs.existsSync(filePath)) {
    return { frontmatter: null, content: "" };
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  // Match frontmatter between --- markers
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (frontmatterMatch) {
    return {
      frontmatter: frontmatterMatch[1],
      content: frontmatterMatch[2] || "",
    };
  }

  // No frontmatter found, treat entire file as content
  return { frontmatter: null, content: fileContent };
}

// Generate frontmatter for an endpoint
function generateFrontmatter(operationId, method, apiPath, operation) {
  const title = getTitle(operationId, operation);
  const description = getDescription(operationId, operation);
  const openApiRef = `${method} ${apiPath}`;

  return `title: ${quoteYamlString(title)}
description: ${quoteYamlString(description)}
openapi: ${openApiRef}`;
}

// Generate full MDX content, preserving existing content after frontmatter
function generateMdxContent(operationId, method, apiPath, operation, existingContent) {
  const frontmatter = generateFrontmatter(operationId, method, apiPath, operation);

  // If there's existing content, preserve it
  if (existingContent && existingContent.trim()) {
    return `---
${frontmatter}
---
${existingContent}`;
  }

  // New file, just frontmatter
  return `---
${frontmatter}
---
`;
}

// Main function
async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), "api-reference", "endpoint");

  // Get the OpenAPI spec
  let spec;
  if (options.url) {
    spec = await fetchOpenApiSpec(options.url);

    // Update local spec if requested
    if (options.updateSpec) {
      const specPath = path.join(process.cwd(), options.file);
      if (options.dryRun) {
        console.log(`[DRY RUN] Would update: ${specPath}`);
      } else {
        fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
        console.log(`Updated: ${specPath}`);
      }
    }
  } else {
    const specPath = path.join(process.cwd(), options.file);
    spec = readOpenApiSpec(specPath);
  }

  // Collect all operations from the spec
  const operations = [];
  for (const [apiPath, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (operation.operationId) {
        operations.push({
          operationId: operation.operationId,
          method,
          path: apiPath,
          operation,
        });
      }
    }
  }

  console.log(`\nFound ${operations.length} operations in OpenAPI spec\n`);

  // Fail before writing if two operations resolve to the same public docs
  // filename. Without this check, the later operation silently overwrites the
  // earlier operation's MDX frontmatter.
  const operationsByFilename = new Map();
  for (const operation of operations) {
    const filename = operationIdToFilename(operation.operationId);
    const existingOperation = operationsByFilename.get(filename);
    if (existingOperation) {
      throw new Error(
        `Filename collision: ${existingOperation.operationId} (${existingOperation.method} ${existingOperation.path}) and ${operation.operationId} (${operation.method} ${operation.path}) both resolve to ${filename}. Add or correct a FILENAME_OVERRIDES exception.`,
      );
    }
    operationsByFilename.set(filename, operation);
  }

  const orphanedFiles = validateEndpointPages(
    new Set(operationsByFilename.keys()),
    outputDir,
    options.cleanup,
  );

  // Check for operations without descriptions
  const missingDescriptions = operations.filter(
    (op) => !op.operation.description && !DESCRIPTION_FALLBACKS[op.operationId],
  );

  if (missingDescriptions.length > 0) {
    console.log("⚠️  Operations without description (add in NestJS @ApiOperation):");
    missingDescriptions.forEach((op) => console.log(`   - ${op.operationId}`));
    console.log("");
  }

  // Generate MDX files
  console.log("Generating MDX files:\n");

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  // Track generated filenames to detect orphans
  const generatedFiles = new Set();

  for (const { operationId, method, path: apiPath, operation } of operations) {
    const filename = operationIdToFilename(operationId);
    generatedFiles.add(filename);
    const filePath = path.join(outputDir, filename);

    // Parse existing file to preserve content below frontmatter
    const { content: existingContent } = parseExistingMdx(filePath);

    // Generate new MDX with updated frontmatter but preserved content
    const mdxContent = generateMdxContent(operationId, method, apiPath, operation, existingContent);

    // Check if file exists and compare content
    let status;
    let hasCustomContent = existingContent && existingContent.trim().length > 0;

    if (fs.existsSync(filePath)) {
      const currentFileContent = fs.readFileSync(filePath, "utf-8");
      if (currentFileContent === mdxContent) {
        status = "unchanged";
        unchanged++;
      } else {
        status = "updated";
        updated++;
      }
    } else {
      status = "created";
      created++;
    }

    const statusIcon = {
      created: "✨",
      updated: "📝",
      unchanged: "✓",
    }[status];

    const hasOpenApiDesc = operation.description ? "✓" : "○";
    const customContentIndicator = hasCustomContent ? " [+content]" : "";
    console.log(
      `${statusIcon} ${filename} [desc: ${hasOpenApiDesc}]${customContentIndicator} (${status})`,
    );

    if (!options.dryRun && status !== "unchanged") {
      fs.writeFileSync(filePath, mdxContent);
    }
  }

  // Orphaned pages only reach this point with --cleanup; otherwise
  // validateEndpointPages has already failed the run.
  let deleted = 0;

  if (orphanedFiles.length > 0) {
    console.log("\n⚠️  Orphaned files (not in OpenAPI spec):\n");
    for (const filename of orphanedFiles) {
      if (!options.dryRun) {
        fs.unlinkSync(path.join(outputDir, filename));
      }
      console.log(`🗑️  ${filename} (deleted)`);
      deleted++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  if (orphanedFiles.length > 0) {
    console.log(
      `  Orphaned: ${orphanedFiles.length}${options.cleanup ? ` (${deleted} deleted)` : ""}`,
    );
  }
  console.log(`\nLegend:`);
  console.log(`  [desc: ✓] = has OpenAPI description`);
  console.log(`  [desc: ○] = using fallback/summary`);
  console.log(`  [+content] = has custom content below frontmatter (preserved)`);

  if (options.dryRun) {
    console.log("\n[DRY RUN] No files were modified");
  }

  // Print NestJS decorator example for missing descriptions
  if (missingDescriptions.length > 0) {
    console.log("\n--- NestJS Example ---");
    console.log("Add descriptions to your controllers:\n");
    console.log(`@ApiOperation({
  summary: 'Your Summary Here',
  description: 'Your detailed description here.'
})
@Get()
yourMethod() { ... }`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
