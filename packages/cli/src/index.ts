#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import {
  createLoginCommand,
  createLogoutCommand,
  createWhoamiCommand,
  createConfigCommand,
  createProductsCommand,
  createCheckoutsCommand,
  createSubscriptionsCommand,
  createCustomersCommand,
  createTransactionsCommand,
  createDiscountsCommand,
  createMigrateCommand,
} from "./commands";

const VERSION = "0.1.3";

const creem = chalk.hex("#ffbe98");

const BANNER =
  creem(`
   ██████╗██████╗ ███████╗███████╗███╗   ███╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝████╗ ████║
  ██║     ██████╔╝█████╗  █████╗  ██╔████╔██║
  ██║     ██╔══██╗██╔══╝  ██╔══╝  ██║╚██╔╝██║
  ╚██████╗██║  ██║███████╗███████╗██║ ╚═╝ ██║
   ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚═╝
`) + chalk.dim(`  v${VERSION} · The Smooth Merchant of Record\n`);

const FULL_HELP = `
${chalk.dim("Examples:")}
  ${chalk.cyan("creem login")}                          Authenticate with your API key
  ${chalk.cyan("creem config set environment live")}    Switch to live mode
  ${chalk.cyan("creem products list")}                  List all products
  ${chalk.cyan("creem products create --name ... ")}    Create a product
  ${chalk.cyan("creem customers list")}                 List all customers
  ${chalk.cyan("creem subscriptions get <id>")}         Get subscription details
  ${chalk.cyan("creem transactions list")}              List transactions
  ${chalk.cyan("creem checkouts create --product <id>")}  Create checkout
  ${chalk.cyan("creem migrate lemon-squeezy")}          Migrate from Lemon Squeezy

${chalk.dim("Interactive mode:")}
  Run a resource command without a subcommand to browse interactively:
  ${chalk.cyan("creem products")}    ${chalk.cyan("creem customers")}    ${chalk.cyan("creem subscriptions")}    ${chalk.cyan("creem transactions")}

${chalk.dim("Configuration:")}
  Config is stored at ${chalk.cyan("~/.creem/config.json")}
  API keys:  test keys start with ${chalk.cyan("creem_test_")}, live keys with ${chalk.cyan("creem_")}
  Environments:  ${chalk.cyan("test")} (default) uses test-api.creem.io, ${chalk.cyan("live")} uses api.creem.io
  Output format:  ${chalk.cyan("table")} (default) or ${chalk.cyan("json")} (set globally or per-command with --json)

${chalk.dim("Agents:")}
  Quickstart:        https://creem.io/agents.md
  Creem Skills:      https://github.com/armitage-labs/creem-skills

${chalk.dim("Documentation:")}  https://docs.creem.io
${chalk.dim("API keys:")}       https://creem.io/dashboard/api-keys
`;

const program = new Command();

program
  .name("creem")
  .description("The official CLI for Creem")
  .version(VERSION, "-v, --version", "Display version number")
  .helpOption("-h, --help", "Display help")
  .enablePositionalOptions()
  .passThroughOptions();

// Register commands
program.addCommand(createLoginCommand());
program.addCommand(createLogoutCommand());
program.addCommand(createWhoamiCommand());
program.addCommand(createConfigCommand());
program.addCommand(createProductsCommand());
program.addCommand(createCheckoutsCommand());
program.addCommand(createSubscriptionsCommand());
program.addCommand(createCustomersCommand());
program.addCommand(createTransactionsCommand());
program.addCommand(createDiscountsCommand());
program.addCommand(createMigrateCommand());

// creem help: full reference; creem help <command>: specific command help
const helpCmd = new Command("help")
  .description("Display full help with examples and configuration reference")
  .argument("[command]", "Command to get help for")
  .action((commandName: string | undefined) => {
    if (commandName) {
      const sub = program.commands.find(
        (c) => c.name() === commandName || c.aliases().includes(commandName),
      );
      if (sub) {
        sub.outputHelp();
      } else {
        console.error(chalk.red(`Unknown command: ${commandName}`));
        process.exit(1);
      }
      return;
    }

    program.outputHelp();
    console.log(FULL_HELP);
  });
// Replace the default help command with ours
program.addCommand(helpCmd, { hidden: false });

// Show ASCII banner before help output (only for the root command)
program.addHelpText("beforeAll", BANNER);

// Compact footer on default help
program.addHelpText(
  "after",
  `
  Run ${chalk.cyan("creem help")} for examples and configuration reference.
`,
);

// Handle unknown commands
program.on("command:*", () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
  console.error();
  program.outputHelp();
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);

// If no command provided, show help (banner is printed by the beforeAll hook)
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
