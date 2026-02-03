# Creem API Documentation

Documentation for the Creem API, built with [Mintlify](https://mintlify.com)..

## Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify) to preview the documentation changes locally:

```bash
npm i -g mintlify
```

Run the following command at the root of your documentation:

```bash
mintlify dev
```

## API Reference Generation

The API reference MDX files are generated from the OpenAPI spec. The script updates only the frontmatter (title, description, openapi reference) and preserves any custom content you add below.

### Available Commands

```bash
# Generate from local openapi.json
npm run generate:api

# Generate from remote API, update local openapi.json, and cleanup orphans
npm run generate:api:remote -- https://your-api.com/open-api/json

# Preview changes without writing files
npm run generate:api:dry-run

# Delete orphaned MDX files (endpoints removed from spec)
npm run generate:api:cleanup
```

### Using Custom URLs

You can also run the script directly with custom options:

```bash
# From a custom remote URL
node scripts/generate-api-docs.js --url https://your-api.com/open-api/json --update-spec

# From a local file
node scripts/generate-api-docs.js --file path/to/openapi.json

# Preview changes (dry run)
node scripts/generate-api-docs.js --url https://your-api.com/open-api/json --dry-run
```

### Script Options

| Option          | Description                                                               |
| --------------- | ------------------------------------------------------------------------- |
| `--url <url>`   | Fetch OpenAPI spec from a remote URL                                      |
| `--file <path>` | Read OpenAPI spec from local file (default: `api-reference/openapi.json`) |
| `--update-spec` | Update the local `openapi.json` from the remote URL                       |
| `--dry-run`     | Preview changes without writing files                                     |
| `--cleanup`     | Delete orphaned MDX files (endpoints removed from spec)                   |
| `--help`        | Show help message                                                         |

### Output Legend

When running the script, you'll see indicators for each file:

- `[desc: ✓]` - Description comes from OpenAPI spec
- `[desc: ○]` - Using fallback/summary as description
- `[+content]` - File has custom content below frontmatter (preserved)

### Adding Custom Content

You can add custom content (examples, notes, etc.) below the frontmatter in any MDX file. The script will preserve this content when regenerating:

```markdown
---
title: 'Activate License Key'
description: 'Activate a license key for a specific device.'
openapi: post /v1/licenses/activate
---

## Example Usage

Your custom content here will be preserved!
```

## Publishing Changes

Changes pushed to the default branch are automatically deployed to production via the Mintlify GitHub App.

## Troubleshooting

- **Mintlify dev isn't running** - Run `mintlify install` to re-install dependencies
- **Page loads as a 404** - Make sure you are running in a folder with `docs.json`
