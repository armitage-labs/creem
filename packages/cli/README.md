# Creem CLI

The official command-line tool for [Creem](https://creem.io) — the Merchant of Record for SaaS and digital businesses.

Manage products, customers, subscriptions, checkouts, transactions, and discounts from your terminal.

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap armitage-labs/creem
brew install creem
```

### npm (Global)

```bash
npm install -g creem-cli
```

### npx (No Install)

```bash
npx creem-cli <command>
```

## Quick Start

```bash
# Authenticate with your API key
creem login

# Check your auth status
creem whoami

# Switch to live mode
creem config set environment live
```

Get your API key from the [Creem Dashboard](https://creem.io/dashboard/api-keys).

- Test keys start with `creem_test_`
- Live keys start with `creem_`

## Commands

### Authentication

```bash
# Login with API key (interactive)
creem login

# Login with API key (non-interactive)
creem login --api-key creem_xxxxx

# Check current authentication
creem whoami

# Logout
creem logout
```

### Configuration

```bash
# Show all config
creem config show

# Get a specific value
creem config get environment

# Set a value
creem config set environment live
creem config set output_format json

# List available config keys
creem config list
```

### Resources

- `creem products` — list, create, get, update products
- `creem customers` — list, get, create customers and open billing portals
- `creem subscriptions` — list, get, cancel, pause, resume, upgrade, update
- `creem checkouts` — create and get checkout sessions
- `creem transactions` — list and inspect transactions
- `creem discounts` — create and list discount codes
- `creem migrate` — migrate from LemonSqueezy to Creem

Run `creem <command> --help` for details on any command.

### Global Options

- `--json` — Output in JSON format (works with most commands)
- `--help` — Show help for any command
- `--version` — Show CLI version

## Configuration

Config is stored at `~/.creem/config.json`:

```json
{
  "api_key": "creem_xxxxx",
  "environment": "test",
  "output_format": "table"
}
```

### Environment

- `test` — Uses `https://test-api.creem.io` (default)
- `live` — Uses `https://api.creem.io`

## Development

This package lives inside the [armitage-labs/creem](https://github.com/armitage-labs/creem) monorepo and uses `pnpm` + `turbo`.

```bash
# From the repo root
pnpm install
pnpm --filter creem-cli build

# Or from this directory
cd packages/creem-cli
pnpm build      # build once
pnpm dev        # watch mode
```

Run the locally built binary:

```bash
node packages/creem-cli/dist/index.js <command>
```

### Optional: direnv

A `.envrc` is included that adds `packages/creem-cli/bin` to your `PATH`, so after building you can just run `creem`:

```bash
brew install direnv       # if not already installed
cd packages/creem-cli
direnv allow
creem whoami
```

## Contributing

Contributions are welcome! Please open an issue or pull request at
[github.com/armitage-labs/creem](https://github.com/armitage-labs/creem).

## License

MIT
