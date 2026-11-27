import chalk from "chalk";
import { password } from "@inquirer/prompts";
import Stripe from "stripe";
import { CliError } from "../lib/errors";
import { MIGRATION_EXIT_CODES } from "../lib/migration/report";
import { fromStripe } from "../lib/migration/stripe/map";
import { fetchStripeCatalog, stripeClient } from "../lib/migration/stripe/source";
import type { MigrationSource } from "./migrate";

export const STRIPE_SCOPE = "Billing Meters and products (one per price)";

/** `creem migrate stripe`: its flags and how it reads Stripe; the rest is shared. */
export const stripeSource: MigrationSource = {
  name: "stripe",
  title: "Stripe",
  banner: "💳 Stripe → Creem",
  scope: STRIPE_SCOPE,
  meters: true,
  options: (command) =>
    command
      .option(
        "--stripe-key <key>",
        "Stripe restricted key with read access to Products, Prices and Billing Meters (or STRIPE_API_KEY; stays on this machine)",
      )
      .option(
        "--include-archived",
        "Also migrate inactive Stripe prices and products, as archived Creem products",
      )
      .option(
        "--create-new-unmatched",
        "Create a new Creem object for every adoption proposal that --adopt doesn't answer",
      ),
  check(options, context) {
    if (!options.stripeKey && !process.env.STRIPE_API_KEY && (!context.isTTY || options.json))
      throw new CliError(
        "Supply --stripe-key or STRIPE_API_KEY for non-interactive migration.",
        MIGRATION_EXIT_CODES.usage,
      );
  },
  async read({ context, options, print }) {
    // `check` refused a missing key outside a terminal.
    let key = (options.stripeKey as string | undefined) || process.env.STRIPE_API_KEY;
    if (!key) {
      try {
        key = await password({
          message: "Enter your Stripe restricted key:",
          validate: (value) => (value.length > 0 ? true : "A key is required"),
        });
      } catch {
        throw new CliError("Migration canceled.");
      }
    }
    context.secrets.add(key);
    print(chalk.dim("Reading the Stripe catalog…"));
    let read: Awaited<ReturnType<typeof fetchStripeCatalog>>;
    try {
      read = await fetchStripeCatalog(stripeClient(key), {
        includeArchived: Boolean(options.includeArchived),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Stripe.errors.StripeAuthenticationError)
        throw new CliError(message, MIGRATION_EXIT_CODES.auth, "Check --stripe-key.");
      if (error instanceof Stripe.errors.StripeConnectionError)
        throw new CliError(message, MIGRATION_EXIT_CODES.network, "Check Stripe connectivity.");
      throw error;
    }
    const { objects, failures } = read;
    const { account } = objects;
    if (account.id)
      print(chalk.dim(`Stripe account: ${account.name || account.id} (${account.id})`));
    return {
      plan: (catalog, adoption) =>
        fromStripe(objects, catalog, {
          adoption,
          includeArchived: Boolean(options.includeArchived),
          createNewUnmatched: Boolean(options.createNewUnmatched),
        }),
      failures,
      files: {},
    };
  },
};
