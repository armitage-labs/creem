import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { CliError } from "../lib/errors";
import { fromPaddle } from "../lib/migration/paddle/map";
import {
  PADDLE_HOSTS,
  PaddleApiError,
  PaddleClient,
  fetchPaddleCatalog,
  type PaddleEnvironment,
} from "../lib/migration/paddle/source";
import { MIGRATION_EXIT_CODES } from "../lib/migration/report";
import type { MigrationSource } from "./migrate";

export const PADDLE_SCOPE = "products, product groups and discounts";

/** The environment a key belongs to, from its prefix (`pdl_sdbx_` or `pdl_live_`). */
const environmentOfKey = (key: string): PaddleEnvironment | undefined =>
  key.startsWith("pdl_sdbx_") ? "sandbox" : key.startsWith("pdl_live_") ? "production" : undefined;

/** `creem migrate paddle`: Paddle Billing (not Paddle Classic). */
export const paddle: MigrationSource = {
  name: "paddle",
  title: "Paddle",
  banner: "Paddle → Creem",
  scope: PADDLE_SCOPE,
  options: (command) =>
    command
      .option(
        "--paddle-key <key>",
        "Paddle API key with read permission on products, prices and discounts (or PADDLE_API_KEY; stays on this machine)",
      )
      .option(
        "--paddle-environment <environment>",
        "Paddle environment: sandbox or production (default: the key's own)",
      )
      .option("--include-archived", "Write archived Paddle prices as archived Creem products"),
  check(options) {
    const environment = options.paddleEnvironment;
    if (environment !== undefined && !Object.hasOwn(PADDLE_HOSTS, String(environment)))
      throw new CliError(
        `--paddle-environment takes sandbox or production, not "${String(environment)}".`,
        MIGRATION_EXIT_CODES.usage,
      );
  },
  async read({ context, options, print }) {
    let key = (options.paddleKey as string | undefined) || process.env.PADDLE_API_KEY;
    if (!key) {
      if (!context.isTTY || options.json)
        throw new CliError(
          "Supply --paddle-key or PADDLE_API_KEY for non-interactive migration.",
          MIGRATION_EXIT_CODES.usage,
        );
      try {
        key = await password({
          message: "Enter your Paddle API key:",
          validate: (value) => (value.length > 0 ? true : "API key is required"),
        });
      } catch {
        throw new CliError("Migration canceled.");
      }
    }
    context.secrets.add(key);
    const own = environmentOfKey(key);
    const environment = (options.paddleEnvironment as PaddleEnvironment | undefined) ?? own;
    if (!environment)
      throw new CliError(
        "Pass --paddle-environment sandbox or production: the key's prefix doesn't say which it is.",
        MIGRATION_EXIT_CODES.usage,
      );
    if (own && own !== environment)
      throw new CliError(
        `The key is a ${own === "sandbox" ? "sandbox key" : "live key"}, and --paddle-environment is ${environment}.`,
        MIGRATION_EXIT_CODES.usage,
        `Pass --paddle-environment ${own}, or a ${environment} key.`,
      );
    print(chalk.dim(`Reading the Paddle ${environment} catalog…`));
    const client = new PaddleClient(key, { environment });
    let read;
    try {
      read = await fetchPaddleCatalog(client);
    } catch (error) {
      if (error instanceof PaddleApiError)
        throw new CliError(
          error.message,
          MIGRATION_EXIT_CODES.auth,
          "Check --paddle-key, its read permissions and --paddle-environment.",
        );
      throw error;
    }
    const { objects, failures } = read;
    return {
      plan: (catalog, adoption, now) =>
        fromPaddle(objects, catalog, {
          now,
          adoption,
          includeArchived: Boolean(options.includeArchived),
        }),
      failures,
      files: {},
    };
  },
};
