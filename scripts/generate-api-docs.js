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

const fs = require('fs');
const path = require('path');

// Filename overrides: operationId -> custom filename
// Only needed when the auto-generated filename isn't what you want
const FILENAME_OVERRIDES = {
  retrieveProduct: 'get-product',
  retrieveCustomer: 'get-customer',
  retrieveSubscription: 'get-subscription',
  retrieveCheckout: 'get-checkout',
  retrieveDiscount: 'get-discount-code',
  generateCustomerLinks: 'create-customer-billing',
  getTransactionById: 'get-transaction',
  searchTransactions: 'get-transactions',
  searchProducts: 'search-products',
  listCustomers: 'list-customers',
  createDiscount: 'create-discount-code',
  deleteDiscount: 'delete-discount-code',
  activateLicense: 'activate-license',
  deactivateLicense: 'deactivate-license',
  validateLicense: 'validate-license',
  cancelSubscription: 'cancel-subscription',
  updateSubscription: 'update-subscription',
  upgradeSubscription: 'upgrade-subscription',
  pauseSubscription: 'pause-subscription',
  resumeSubscription: 'resume-subscription',
  createCheckout: 'create-checkout',
  createProduct: 'create-product'
};

// Fallback descriptions when not provided in OpenAPI spec
const DESCRIPTION_FALLBACKS = {};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    file: 'api-reference/openapi.json',
    dryRun: false,
    updateSpec: false,
    cleanup: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        options.url = args[++i];
        break;
      case '--file':
        options.file = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--update-spec':
        options.updateSpec = true;
        break;
      case '--cleanup':
        options.cleanup = true;
        break;
      case '--help':
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
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Convert operationId to kebab-case filename
function operationIdToFilename(operationId) {
  // Check for override first
  if (FILENAME_OVERRIDES[operationId]) {
    return FILENAME_OVERRIDES[operationId] + '.mdx';
  }
  
  // Convert camelCase to kebab-case
  return operationId
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase() + '.mdx';
}

// Get description from OpenAPI or fallback
function getDescription(operationId, operation) {
  // Use OpenAPI description if available
  if (operation.description) {
    return operation.description;
  }
  
  // Use fallback
  return DESCRIPTION_FALLBACKS[operationId] || operation.summary || 'API endpoint documentation.';
}

// Get title from OpenAPI summary (used as-is from spec)
function getTitle(operationId, operation) {
  // Use summary directly as defined in the spec
  if (operation.summary) {
    // Only remove trailing period if present
    return operation.summary.replace(/\.$/, '');
  }
  
  // Fallback: generate from operationId
  return operationId
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Parse existing MDX file to extract frontmatter and content
function parseExistingMdx(filePath) {
  if (!fs.existsSync(filePath)) {
    return { frontmatter: null, content: '' };
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // Match frontmatter between --- markers
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  
  if (frontmatterMatch) {
    return {
      frontmatter: frontmatterMatch[1],
      content: frontmatterMatch[2] || ''
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
  
  return `title: '${title}'
description: '${description}'
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
  const outputDir = path.join(process.cwd(), 'api-reference', 'endpoint');

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
          operation
        });
      }
    }
  }

  console.log(`\nFound ${operations.length} operations in OpenAPI spec\n`);

  // Check for operations without descriptions
  const missingDescriptions = operations.filter(op => 
    !op.operation.description && !DESCRIPTION_FALLBACKS[op.operationId]
  );

  if (missingDescriptions.length > 0) {
    console.log('⚠️  Operations without description (add in NestJS @ApiOperation):');
    missingDescriptions.forEach(op => console.log(`   - ${op.operationId}`));
    console.log('');
  }

  // Generate MDX files
  console.log('Generating MDX files:\n');
  
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
      const currentFileContent = fs.readFileSync(filePath, 'utf-8');
      if (currentFileContent === mdxContent) {
        status = 'unchanged';
        unchanged++;
      } else {
        status = 'updated';
        updated++;
      }
    } else {
      status = 'created';
      created++;
    }

    const statusIcon = {
      created: '✨',
      updated: '📝',
      unchanged: '✓'
    }[status];

    const hasOpenApiDesc = operation.description ? '✓' : '○';
    const customContentIndicator = hasCustomContent ? ' [+content]' : '';
    console.log(`${statusIcon} ${filename} [desc: ${hasOpenApiDesc}]${customContentIndicator} (${status})`);

    if (!options.dryRun && status !== 'unchanged') {
      fs.writeFileSync(filePath, mdxContent);
    }
  }

  // Detect orphaned MDX files (exist but not in spec)
  const existingFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.mdx'));
  const orphanedFiles = existingFiles.filter(f => !generatedFiles.has(f));
  let deleted = 0;

  if (orphanedFiles.length > 0) {
    console.log('\n⚠️  Orphaned files (not in OpenAPI spec):\n');
    for (const filename of orphanedFiles) {
      const filePath = path.join(outputDir, filename);
      if (options.cleanup) {
        if (!options.dryRun) {
          fs.unlinkSync(filePath);
        }
        console.log(`🗑️  ${filename} (deleted)`);
        deleted++;
      } else {
        console.log(`   ${filename}`);
      }
    }
    if (!options.cleanup) {
      console.log('\n   Run with --cleanup to delete these files');
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  if (orphanedFiles.length > 0) {
    console.log(`  Orphaned: ${orphanedFiles.length}${options.cleanup ? ` (${deleted} deleted)` : ''}`);
  }
  console.log(`\nLegend:`);
  console.log(`  [desc: ✓] = has OpenAPI description`);
  console.log(`  [desc: ○] = using fallback/summary`);
  console.log(`  [+content] = has custom content below frontmatter (preserved)`);

  if (options.dryRun) {
    console.log('\n[DRY RUN] No files were modified');
  }

  // Print NestJS decorator example for missing descriptions
  if (missingDescriptions.length > 0) {
    console.log('\n--- NestJS Example ---');
    console.log('Add descriptions to your controllers:\n');
    console.log(`@ApiOperation({
  summary: 'Your Summary Here',
  description: 'Your detailed description here.'
})
@Get()
yourMethod() { ... }`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
