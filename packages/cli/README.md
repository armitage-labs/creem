# Creem CLI

The Creem CLI lets you manage products, customers, subscriptions, and transactions directly from the terminal. It's designed for both human developers and AI agents building automation workflows.

**Full documentation: [docs.creem.io/code/cli](https://docs.creem.io/code/cli).**

| I want to…                                  | Go here                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Install and authenticate                    | [Setup guide](https://docs.creem.io/code/cli#installation)            |
| Browse and manage my store interactively    | [Interactive guide](https://docs.creem.io/ai/for-humans/cli)          |
| Build automation or give an AI agent access | [Agent guide](https://docs.creem.io/ai/for-agents/cli)                |
| Find commands, flags, and request examples  | [Command reference](https://docs.creem.io/code/cli#command-reference) |

## Quick start

Choose your installation method. npm and npx require Node.js 22 or newer.

**Homebrew (macOS/Linux)**

```sh
brew tap armitage-labs/creem
brew install creem
```

**npm**

```sh
npm install -g @creem_io/cli
```

**npx (without a global install)**

```sh
npx @creem_io/cli --help
```

Log in with your API key, then browse your store or run a command:

```sh
creem login
creem products
creem products list --json
creem --help
```

If using npx, replace `creem` with `npx @creem_io/cli` in these examples.
For automation, provide `CREEM_API_KEY` through your environment or secret store;
see the [agent guide](https://docs.creem.io/ai/for-agents/cli) for authentication,
JSON output, and error handling.

## Contributing

See the repository [contributing guide](../../CONTRIBUTING.md) and
[CLI development instructions](./AGENTS.md) for setup and validation.
