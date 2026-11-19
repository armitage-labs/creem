import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { password, select } from "@inquirer/prompts";
import { createContext, type CliContext } from "../lib/context";
import { CliError } from "../lib/errors";
import { parseInteger } from "../lib/input";
import { readCreemCatalog } from "../lib/migration/catalog";
import { fromLemonSqueezy, type MigrationPlan } from "../lib/migration/lemon-squeezy/map";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
  type LSStore,
} from "../lib/migration/lemon-squeezy/source";
import {
  MIGRATION_EXIT_CODES,
  migrationExitCode,
  type MigrationItem,
  type MigrationReport,
} from "../lib/migration/report";
import { executeMigration } from "../lib/migration/writer";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";

const SCOPE = "products, product groups, discounts, license keys and files";

const NOT_MIGRATED_LABELS: Record<string, string> = {
  customers: "customers",
  subscriptions: "subscriptions",
  orders: "orders",
  license_keys: "issued license keys",
  discounts: "discounts (--exclude-discounts)",
};
const KIND_TITLES: Record<MigrationItem["kind"], string> = {
  product: "Products",
  product_group: "Product groups",
  file: "Files",
  discount: "Discounts",
};
const ACTION_MARKS: Record<MigrationItem["action"], string> = {
  create: chalk.green("+ create   "),
  update: chalk.cyan("~ update   "),
  unchanged: chalk.dim("= unchanged"),
  skip: chalk.yellow("- skip     "),
};

/** The plan or run report as terminal text. */
function formatReport(report: MigrationReport, environment: string): string[] {
  const lines: string[] = [];
  const s = report.summary;
  const title =
    report.mode === "run" ? "Migration result" : `Plan: Lemon Squeezy → Creem ${environment}`;
  lines.push(
    chalk.bold(title),
    chalk.dim(
      `Store ${report.source.store_name} (${report.source.store_id}, ${report.source.currency})`,
    ),
    `Create ${s.create} · Update ${s.update} · Unchanged ${s.unchanged} · Skip ${s.skip}` +
      (s.failed ? chalk.red(` · Failed ${s.failed}`) : "") +
      (s.warnings ? chalk.yellow(` · Warnings ${s.warnings}`) : ""),
  );
  for (const kind of Object.keys(KIND_TITLES) as MigrationItem["kind"][]) {
    const items = report.items.filter((item) => item.kind === kind);
    if (!items.length) continue;
    lines.push("", chalk.bold(KIND_TITLES[kind]));
    for (const item of items) {
      const status =
        item.status === "failed" ? chalk.red(" FAILED") : item.status === "done" ? " ✓" : "";
      const changes = item.action === "update" ? chalk.dim(` (${item.changes.join(", ")})`) : "";
      lines.push(`  ${ACTION_MARKS[item.action]}  ${item.key}  ${item.name}${changes}${status}`);
      if (item.reason) lines.push(chalk.dim(`      ${item.reason.code}: ${item.reason.message}`));
      for (const warning of item.warnings)
        lines.push(chalk.yellow(`      ! ${warning.code}: ${warning.message}`));
      if (item.error) {
        lines.push(chalk.red(`      ✗ ${item.error.code}: ${item.error.message}`));
        if (item.error.hint) lines.push(chalk.dim(`        ${item.error.hint}`));
      }
    }
  }
  const pending = report.proposals.filter((p) => p.decision === "pending");
  if (pending.length) {
    lines.push("", chalk.bold("Adoption proposals (not confirmed)"));
    for (const proposal of pending)
      lines.push(
        `  ${proposal.creem_id} "${proposal.creem_name}" → ${proposal.key} (${proposal.match})`,
      );
    lines.push(chalk.dim("  Confirm them in a terminal, or pass --adopt to accept them all."));
  }
  lines.push(
    "",
    chalk.dim(
      `Not migrated: ${report.not_migrated.map((n) => NOT_MIGRATED_LABELS[n.kind] ?? n.kind).join(", ")}.`,
    ),
  );
  if (report.fetch_failures.length) {
    lines.push("", chalk.red("Could not read from Lemon Squeezy:"));
    for (const failure of report.fetch_failures)
      lines.push(chalk.red(`  • ${failure.kind}: ${failure.message}`));
  }
  return lines;
}

function createLemonSqueezyCommand(context: CliContext): Command {
  const command = addGlobalOptions(
    new Command("lemon-squeezy").description(
      `Migrate ${SCOPE} from Lemon Squeezy to Creem. Re-runnable: objects are matched by their key.`,
    ),
  )
    .option("--ls-api-key <key>", "Lemon Squeezy API key (stays on this machine)")
    .option("--ls-store-id <id>", "Lemon Squeezy store ID to migrate from")
    .option("--dry-run", "Print the plan and write nothing")
    .option("--exclude-discounts", "Skip migrating discounts entirely")
    .option("--adopt", "Accept every proposal to adopt an existing Creem object without a key")
    .action(
      async (
        localOptions: {
          lsApiKey?: string;
          lsStoreId?: string;
          dryRun?: boolean;
          excludeDiscounts?: boolean;
          adopt?: boolean;
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals();
        const json = outputFormat(cmd) !== "table";
        const options = { ...localOptions, json };
        if (!context.isTTY && !options.dryRun && !json && !globals.yes)
          throw new CliError("Migration requires --yes in non-interactive mode.");
        if (options.lsStoreId) parseInteger("--ls-store-id", options.lsStoreId, { min: 1 });
        const print = (line = "") => {
          if (!json) context.stdout(line + "\n");
        };
        print(chalk.bold.cyan("🍋 Lemon Squeezy → Creem"));
        print(chalk.dim(`Migrates ${SCOPE}. Customers and subscriptions are not migrated.`));
        print();

        let lsApiKey = options.lsApiKey;
        if (!lsApiKey) {
          if (!context.isTTY || json)
            throw new CliError("Supply --ls-api-key for non-interactive migration.", 3);
          try {
            lsApiKey = await password({
              message: "Enter your Lemon Squeezy API key:",
              validate: (value) => (value.length > 0 ? true : "API key is required"),
            });
          } catch {
            throw new CliError("Migration canceled.");
          }
        }
        context.secrets.add(lsApiKey);
        const lsClient = new LemonSqueezyClient(lsApiKey);

        let stores: LSStore[];
        try {
          stores = await lsClient.stores();
        } catch (error) {
          throw new CliError(
            error instanceof Error ? error.message : "Could not validate the API key",
            MIGRATION_EXIT_CODES.auth,
            "Check --ls-api-key and Lemon Squeezy connectivity.",
          );
        }
        if (!stores.length)
          throw new CliError(
            "No store found for this Lemon Squeezy API key.",
            MIGRATION_EXIT_CODES.auth,
          );
        let store: LSStore | undefined;
        if (options.lsStoreId) {
          store = stores.find((candidate) => candidate.id === String(Number(options.lsStoreId)));
          if (!store)
            throw new CliError(
              `Lemon Squeezy store ID ${options.lsStoreId} was not found for this API key.`,
            );
        } else if (stores.length === 1) store = stores[0];
        else {
          if (!context.isTTY || json)
            throw new CliError("Supply --ls-store-id when more than one store is available.");
          try {
            store = await select<LSStore>({
              message: "Which Lemon Squeezy store do you want to migrate?",
              choices: stores.map((candidate) => ({
                name: [
                  candidate.attributes.name,
                  candidate.attributes.domain || candidate.attributes.slug,
                  `ID: ${candidate.id}`,
                  candidate.attributes.currency,
                ]
                  .filter(Boolean)
                  .join(" · "),
                value: candidate,
              })),
            });
          } catch {
            throw new CliError("Migration canceled.");
          }
        }
        const currency = store.attributes.currency?.toUpperCase();
        if (currency !== "USD" && currency !== "EUR")
          throw new CliError(
            `Your Lemon Squeezy store uses ${currency ?? "no currency"}, and Creem supports USD and EUR. ` +
              "Change the store currency to USD or EUR before migrating, or contact Creem support.",
          );
        print(chalk.dim(`Lemon Squeezy store: ${store.attributes.name} (ID ${store.id})`));

        const downloadDir = mkdtempSync(join(tmpdir(), "creem-migrate-ls-"));
        try {
          print(chalk.dim("Reading the Lemon Squeezy catalog…"));
          const { objects, failures } = await fetchLemonSqueezyCatalog(lsClient, {
            storeId: store.id,
            excludeDiscounts: Boolean(options.excludeDiscounts),
            downloadDir,
            store,
          });
          const client = context.client({
            environment: globals.environment,
            timeout: globals.timeout,
          });
          print(chalk.dim("Reading the Creem catalog…"));
          const catalog = await readCreemCatalog(client);
          const now = new Date();
          let plan: MigrationPlan = fromLemonSqueezy(objects, catalog, { now });

          // Adoption: an existing Creem object without a key is taken over only
          // when the merchant confirms it (or passes --adopt).
          if (plan.report.proposals.length) {
            const accepted: string[] = [];
            const declined: string[] = [];
            for (const proposal of plan.report.proposals) {
              if (options.adopt) accepted.push(proposal.id);
              else if (context.isTTY && !json && !options.dryRun) {
                const yes = await context.confirm(
                  `Adopt Creem ${proposal.kind} ${proposal.creem_id} "${proposal.creem_name}" as ${proposal.key}? (${proposal.match}; no creates a new one)`,
                );
                (yes ? accepted : declined).push(proposal.id);
              }
            }
            plan = fromLemonSqueezy(objects, catalog, { now, adoption: { accepted, declined } });
          }
          plan.report.fetch_failures = failures;
          const environment = context.environment().toUpperCase();
          const preview = options.dryRun || (json && !globals.yes);
          if (preview) {
            plan.report.mode = options.dryRun ? "dry_run" : "plan";
            if (json) writeResult(context, plan.report, "json");
            else {
              for (const line of formatReport(plan.report, environment)) print(line);
              print();
              print(chalk.yellow.bold("Dry run: nothing was written."));
            }
            if (failures.length)
              throw new CliError(
                "The plan is incomplete because some Lemon Squeezy data could not be read.",
                MIGRATION_EXIT_CODES.sourceIncomplete,
                "Re-run when Lemon Squeezy answers again.",
              );
            return;
          }

          for (const line of formatReport(plan.report, environment)) print(line);
          print();
          if (failures.length) {
            if (json) writeResult(context, plan.report, "json");
            throw new CliError(
              "Nothing was written: some Lemon Squeezy data could not be read, so the plan is incomplete.",
              MIGRATION_EXIT_CODES.sourceIncomplete,
              "Re-run when Lemon Squeezy answers again.",
            );
          }
          if (!plan.requests.length) {
            plan.report.mode = "run";
            if (json) writeResult(context, plan.report, "json");
            else print(chalk.green("Creem already matches Lemon Squeezy: nothing to write."));
            return;
          }
          if (!globals.yes && !(await context.confirm(`${environment}: Write this plan to Creem?`)))
            throw new CliError("Migration canceled.");

          print(chalk.bold("Writing…"));
          const report = await executeMigration(client, plan, {
            files: objects.fileDigests,
            delayMs: 100,
            secrets: [...context.secrets],
            onProgress: (item, request) =>
              print(chalk.dim(`  ${request.type.replace("_", " ")} ${item.key}`)),
          });
          if (json) writeResult(context, report, "json");
          else {
            print();
            for (const line of formatReport(report, environment)) print(line);
            print();
            const groups = report.items.filter(
              (i) =>
                i.kind === "product_group" && i.reason?.code === "product_group_write_unavailable",
            );
            print(chalk.dim("Next steps:"));
            if (groups.length)
              print(
                chalk.dim("  • Create the product groups listed above in the Creem dashboard."),
              );
            print(chalk.dim("  • Review your products and discounts in the Creem dashboard."));
            print(chalk.dim("  • Point your checkout links at Creem."));
          }
          const exitCode = migrationExitCode(report);
          if (exitCode !== MIGRATION_EXIT_CODES.ok)
            throw new CliError(
              `${report.summary.failed} item(s) failed; the rest of the migration was written.`,
              exitCode,
              "Fix the reported errors and re-run: written items are found by their key and stay unchanged.",
            );
          print(chalk.green.bold("✓ Migration complete. Re-running it is safe."));
        } finally {
          rmSync(downloadDir, { recursive: true, force: true });
        }
      },
    );
  return command;
}

export function createMigrateCommand(context: CliContext = createContext()): Command {
  const command = new Command("migrate")
    .description("Migrate from other platforms to Creem")
    .addHelpText(
      "after",
      `
${chalk.dim("Available migrations:")}
  ${chalk.cyan("creem migrate lemon-squeezy")}    Migrate ${SCOPE} from Lemon Squeezy

${chalk.dim("Options:")}
  --dry-run               Print the plan and write nothing
  --ls-api-key <key>      Provide the API key via flag (skips the prompt)
  --ls-store-id <id>      Lemon Squeezy store ID to migrate from
  --json                  Print the migration report as JSON (with --yes, run it)
  --exclude-discounts     Skip migrating discounts entirely
  --adopt                 Adopt existing Creem objects without a key that match
  --yes                   Write without asking

${chalk.dim("Examples:")}
  ${chalk.cyan("creem migrate lemon-squeezy --dry-run")}          Print the plan
  ${chalk.cyan("creem migrate lemon-squeezy")}                    Print the plan, then ask before writing
  ${chalk.cyan("creem migrate lemon-squeezy --ls-api-key ls_xxx --ls-store-id 123 --yes")}  Non-interactive run
  ${chalk.cyan("creem migrate lemon-squeezy --json > plan.json")} Export the plan as JSON
`,
    );
  command.addCommand(createLemonSqueezyCommand(context));
  return command;
}
