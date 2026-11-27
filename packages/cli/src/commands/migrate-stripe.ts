import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { CliError } from "../lib/errors";
import type { CreemCatalog } from "../lib/migration/catalog";
import { ADOPT_NEW } from "../lib/migration/plan";
import { MIGRATION_EXIT_CODES } from "../lib/migration/report";
import { fromStripe } from "../lib/migration/stripe/map";
import {
  fetchStripeCatalog,
  isAuthError,
  isConnectionError,
  redactStripe,
  stripeClient,
} from "../lib/migration/stripe/source";
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
        secrets: [key],
      });
    } catch (error) {
      const message = redactStripe(error instanceof Error ? error.message : String(error), [key]);
      if (isAuthError(error))
        throw new CliError(message, MIGRATION_EXIT_CODES.auth, "Check --stripe-key.");
      if (isConnectionError(error))
        throw new CliError(message, MIGRATION_EXIT_CODES.network, "Check Stripe connectivity.");
      throw error;
    }
    const { objects, failures } = read;
    const { account } = objects;
    if (account.id)
      print(chalk.dim(`Stripe account: ${account.name || account.id} (${account.id})`));
    const plan = (catalog: CreemCatalog, adoption: Record<string, string>) =>
      fromStripe(objects, catalog, {
        adoption,
        includeArchived: Boolean(options.includeArchived),
      });
    return {
      plan: (catalog, adoption) => {
        if (!options.createNewUnmatched) return plan(catalog, adoption);
        // --create-new-unmatched answers `new` only to what --adopt leaves open: bare
        // --adopt first takes each proposal with one candidate, as the shared loop does.
        const answers = { ...adoption };
        for (;;) {
          const planned = plan(catalog, answers);
          const open = planned.report.proposals.find(
            (p) => p.decision === "pending" && !(p.id in answers),
          );
          if (!open || planned.answerErrors.length) return planned;
          answers[open.id] =
            options.adopt === true && open.candidates.length === 1
              ? open.candidates[0].creem_id
              : ADOPT_NEW;
        }
      },
      failures,
      files: {},
    };
  },
};
