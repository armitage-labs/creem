import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { password, select } from "@inquirer/prompts";
import { createContext, type CliContext } from "../lib/context";
import { CliError } from "../lib/errors";
import { parseInteger } from "../lib/input";
import { readCreemCatalog, type CreemCatalog } from "../lib/migration/catalog";
import { fromLemonSqueezy } from "../lib/migration/lemon-squeezy/map";
import { ADOPT_NEW, type MigrationPlan } from "../lib/migration/plan";
import {
  LemonSqueezyClient,
  fetchLemonSqueezyCatalog,
  type FetchFailure,
  type LSStore,
} from "../lib/migration/lemon-squeezy/source";
import {
  MIGRATION_EXIT_CODES,
  migrationExitCode,
  type AdoptionProposal,
  type MigrationItem,
  type MigrationReport,
} from "../lib/migration/report";
import {
  CreemCheckError,
  DryRunIgnoredError,
  RateLimitWaitError,
  checkMigration,
  executeMigration,
} from "../lib/migration/writer";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";

const LS_SCOPE = "products, product groups, discounts, license keys and files";

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
function formatReport(report: MigrationReport, environment: string, title: string): string[] {
  const lines: string[] = [];
  const s = report.summary;
  lines.push(
    chalk.bold(
      report.mode === "run" ? "Migration result" : `Plan: ${title} → Creem ${environment}`,
    ),
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
        item.status === "failed"
          ? chalk.red(report.mode === "run" ? " FAILED" : " REFUSED by Creem")
          : item.status === "done"
            ? " ✓"
            : "";
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
    lines.push("", chalk.bold("Adoption proposals (unanswered)"));
    for (const proposal of pending) {
      lines.push(`  ${proposal.key}  ${proposal.name}`);
      for (const candidate of proposal.candidates)
        lines.push(
          `      ${candidate.creem_id} "${candidate.creem_name}"` +
            (candidate.differences.length
              ? chalk.dim(` (${candidate.differences.join("; ")})`)
              : ""),
        );
    }
    lines.push(chalk.dim(`  ${ADOPT_HINT}`));
  }
  lines.push(
    "",
    chalk.dim(
      `Not migrated: ${report.not_migrated.map((n) => NOT_MIGRATED_LABELS[n.kind] ?? n.kind).join(", ")}.`,
    ),
  );
  if (report.fetch_failures.length) {
    lines.push("", chalk.red(`Could not read from ${title}:`));
    for (const failure of report.fetch_failures)
      lines.push(chalk.red(`  • ${failure.kind}: ${failure.message}`));
  }
  return lines;
}

const ADOPT_HINT =
  "Answer them in a terminal, or with --adopt <key>=<creem id> to adopt one, --adopt <key>=new to create a new one, or --adopt alone to adopt every proposal that has one candidate.";

const pendingCount = (report: MigrationReport) =>
  report.proposals.filter((p) => p.decision === "pending").length;

/** Parses `--adopt` values: `<key>=<creem id>` or `<key>=new`, by proposal id. */
function adoptAnswers(values: string[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const value of values) {
    const match = /^([^=\s]+)=([^=\s]+)$/.exec(value);
    if (!match)
      throw new CliError(
        `--adopt takes <key>=<creem id> or <key>=new, not "${value}".`,
        MIGRATION_EXIT_CODES.usage,
      );
    answers[`adopt:${match[1]}`] = match[2];
  }
  return answers;
}

/** Asks about each candidate in turn; no to all of them creates a new object. */
async function askAdoption(context: CliContext, proposal: AdoptionProposal): Promise<string> {
  for (const candidate of proposal.candidates) {
    const differences = candidate.differences.length
      ? `differs: ${candidate.differences.join("; ")}`
      : "no differences";
    let yes: boolean;
    try {
      yes = await context.confirm(
        `Adopt Creem ${proposal.kind} ${candidate.creem_id} "${candidate.creem_name}" as ${proposal.key} (${proposal.name})? (${differences})`,
      );
    } catch {
      throw new CliError("Migration canceled.");
    }
    if (yes) return candidate.creem_id;
  }
  return ADOPT_NEW;
}

/** What a source command read, for the shared plan, check and run. */
interface SourceRead {
  /** Plans against the Creem catalog with the adoption answers given so far. */
  plan(catalog: CreemCatalog, adoption: Record<string, string>, now: Date): MigrationPlan;
  failures: FetchFailure[];
  /** Local copies of the files the run uploads, by source file id. */
  files: Record<string, { path: string }>;
}

type SourceOptions = Record<string, unknown> & { json: boolean };

/**
 * One `creem migrate <source>` command: its own flags and how it reads the
 * source. Planning against Creem, adoption, the check, the confirmation and the
 * run are the same for every source.
 */
interface MigrationSource {
  name: string;
  /** The source's name in messages ("Lemon Squeezy"). */
  title: string;
  banner: string;
  scope: string;
  options(command: Command): Command;
  /** Checks the source's flags before anything is printed or read. */
  check?(options: SourceOptions): void;
  read(input: {
    context: CliContext;
    options: SourceOptions;
    print: (line?: string) => void;
    downloadDir: string;
  }): Promise<SourceRead>;
}

const lemonSqueezy: MigrationSource = {
  name: "lemon-squeezy",
  title: "Lemon Squeezy",
  banner: "🍋 Lemon Squeezy → Creem",
  scope: LS_SCOPE,
  options: (command) =>
    command
      .option("--ls-api-key <key>", "Lemon Squeezy API key (stays on this machine)")
      .option("--ls-store-id <id>", "Lemon Squeezy store ID to migrate from")
      .option("--exclude-discounts", "Skip migrating discounts entirely"),
  check(options) {
    if (options.lsStoreId) parseInteger("--ls-store-id", String(options.lsStoreId), { min: 1 });
  },
  async read({ context, options, print, downloadDir }) {
    const json = options.json;
    let lsApiKey = options.lsApiKey as string | undefined;
    if (!lsApiKey) {
      if (!context.isTTY || json)
        throw new CliError(
          "Supply --ls-api-key for non-interactive migration.",
          MIGRATION_EXIT_CODES.usage,
        );
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
          `Lemon Squeezy store ID ${String(options.lsStoreId)} was not found for this API key.`,
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
    print(chalk.dim("Reading the Lemon Squeezy catalog…"));
    const { objects, failures } = await fetchLemonSqueezyCatalog(lsClient, {
      storeId: store.id,
      excludeDiscounts: Boolean(options.excludeDiscounts),
      downloadDir,
      store,
    });
    return {
      plan: (catalog, adoption, now) => fromLemonSqueezy(objects, catalog, { now, adoption }),
      failures,
      files: objects.fileDigests,
    };
  },
};

function createSourceCommand(context: CliContext, source: MigrationSource): Command {
  const command = source
    .options(
      addGlobalOptions(
        new Command(source.name).description(
          `Migrate ${source.scope} from ${source.title} to Creem. Re-runnable: objects are matched by their key.`,
        ),
      ),
    )
    .option("--dry-run", "Check the plan with Creem's dry run, print it and write nothing")
    .option(
      "--adopt [answers...]",
      "Answer adoption proposals: <key>=<creem id> adopts that object, <key>=new creates a new one; alone, adopts every proposal with one candidate",
    )
    .option(
      "--force",
      "Write even when Creem's check refuses items: the refused items are left out and reported failed",
    )
    .action(
      async (
        localOptions: Record<string, unknown> & {
          dryRun?: boolean;
          adopt?: boolean | string[];
          force?: boolean;
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals();
        const json = outputFormat(cmd) !== "table";
        const options = { ...localOptions, json };
        if (!context.isTTY && !options.dryRun && !json && !globals.yes)
          throw new CliError("Migration requires --yes in non-interactive mode.");
        source.check?.(options);
        const adoptAll = options.adopt === true;
        const answers = adoptAnswers(Array.isArray(options.adopt) ? options.adopt : []);
        const print = (line = "") => {
          if (!json) context.stdout(line + "\n");
        };
        print(chalk.bold.cyan(source.banner));
        print(chalk.dim(`Migrates ${source.scope}. Customers and subscriptions are not migrated.`));
        print();

        const downloadDir = mkdtempSync(join(tmpdir(), `creem-migrate-${source.name}-`));
        try {
          const read = await source.read({ context, options, print, downloadDir });
          const { failures } = read;
          const client = context.client({
            environment: globals.environment,
            timeout: globals.timeout,
          });
          print(chalk.dim("Reading the Creem catalog…"));
          const catalog = await readCreemCatalog(client);
          const now = new Date();
          // Adoption: an existing Creem object without a key is taken over only
          // when the merchant answers its proposal; --yes never does. Each answer
          // re-plans, so a candidate adopted once isn't offered again.
          const ask = context.isTTY && !json && !options.dryRun;
          const asked = new Set<string>();
          let plan: MigrationPlan;
          for (;;) {
            plan = read.plan(catalog, answers, now);
            // An incomplete read writes nothing (exit 4 below), so nothing is asked, and an
            // answer for an item the read couldn't plan isn't taken for a wrong answer.
            if (failures.length) break;
            // An --adopt answer that can't be applied stops the run before any question.
            if (plan.answerErrors.length)
              throw new CliError(
                `Nothing was written: ${plan.answerErrors.map((e) => e.message).join(" ")}`,
                MIGRATION_EXIT_CODES.usage,
                "Each --adopt answer names a key from the plan and one of its candidates, an unkeyed Creem object of the same kind, or new.",
              );
            const next = plan.report.proposals.find(
              (p) => p.decision === "pending" && !asked.has(p.id) && !(p.id in answers),
            );
            if (!next) break;
            asked.add(next.id);
            if (adoptAll && next.candidates.length === 1)
              answers[next.id] = next.candidates[0].creem_id;
            else if (ask) answers[next.id] = await askAdoption(context, next);
          }
          plan.report.fetch_failures = failures;
          const environment = context.environment().toUpperCase();
          // Creem checks every write before anything is written: validate for the
          // products, a dry run for each group and discount. An incomplete read is
          // never written, so it isn't checked.
          if (!failures.length && !plan.answerErrors.length && plan.requests.length) {
            print(chalk.dim("Checking the plan with Creem (dry run)…"));
            try {
              plan = await checkMigration(client, plan, {
                secrets: [...context.secrets],
                delayMs: 100,
              });
            } catch (error) {
              if (error instanceof CreemCheckError)
                throw new CliError(
                  error.message,
                  error.status === 401 || error.status === 403
                    ? MIGRATION_EXIT_CODES.auth
                    : MIGRATION_EXIT_CODES.unexpected,
                  error.status === 401 || error.status === 403
                    ? "Check the Creem API key and its environment."
                    : "Re-run when Creem answers again.",
                );
              if (error instanceof DryRunIgnoredError)
                throw new CliError(
                  error.message,
                  MIGRATION_EXIT_CODES.unexpected,
                  "Check the Creem environment and API version; the migrator needs the dry run (write_result.dry_run).",
                );
              if (error instanceof RateLimitWaitError)
                throw new CliError(
                  `${error.message} Nothing was written.`,
                  MIGRATION_EXIT_CODES.unexpected,
                  `Re-run in ${Math.ceil(error.waitMs / 1000)} s.`,
                );
              throw error;
            }
          }
          const refused = plan.report.items.filter((i) => i.status === "failed");
          const refusedMessage = `Creem's check refused ${refused.length} item(s) (${refused.map((i) => i.key).join(", ")})`;
          const FORCE_HINT =
            "Fix what each refused item's error says and re-run, or pass --force to write the other items.";
          const preview = options.dryRun || (json && !globals.yes);
          if (preview) {
            plan.report.mode = options.dryRun ? "dry_run" : "plan";
            if (json) writeResult(context, plan.report, "json");
            else {
              for (const line of formatReport(plan.report, environment, source.title)) print(line);
              print();
              print(chalk.yellow.bold("Dry run: nothing was written."));
            }
            const exitCode = migrationExitCode(plan.report);
            if (exitCode === MIGRATION_EXIT_CODES.sourceIncomplete)
              throw new CliError(
                `The plan is incomplete because some ${source.title} data could not be read.`,
                MIGRATION_EXIT_CODES.sourceIncomplete,
                `Re-run when ${source.title} answers again.`,
              );
            if (exitCode === MIGRATION_EXIT_CODES.adoptionPending)
              throw new CliError(
                `${pendingCount(plan.report)} adoption proposal(s) are unanswered; a run would write nothing until they are answered.`,
                MIGRATION_EXIT_CODES.adoptionPending,
                ADOPT_HINT,
              );
            if (exitCode === MIGRATION_EXIT_CODES.validationFailed)
              throw new CliError(
                `${refusedMessage}; a run would write nothing.`,
                MIGRATION_EXIT_CODES.validationFailed,
                FORCE_HINT,
              );
            return;
          }

          for (const line of formatReport(plan.report, environment, source.title)) print(line);
          print();
          if (failures.length) {
            if (json) writeResult(context, plan.report, "json");
            throw new CliError(
              `Nothing was written: some ${source.title} data could not be read, so the plan is incomplete.`,
              MIGRATION_EXIT_CODES.sourceIncomplete,
              `Re-run when ${source.title} answers again.`,
            );
          }
          const unanswered = plan.report.proposals.filter((p) => p.decision === "pending");
          if (unanswered.length) {
            if (json) writeResult(context, plan.report, "json");
            throw new CliError(
              `Nothing was written: ${unanswered.length} adoption proposal(s) are unanswered (${unanswered.map((p) => p.key).join(", ")}).`,
              MIGRATION_EXIT_CODES.adoptionPending,
              ADOPT_HINT,
            );
          }
          if (refused.length && !options.force) {
            if (json) writeResult(context, plan.report, "json");
            throw new CliError(
              `Nothing was written: ${refusedMessage}.`,
              MIGRATION_EXIT_CODES.validationFailed,
              FORCE_HINT,
            );
          }
          if (!plan.report.items.some((i) => i.status === "pending")) {
            plan.report.mode = "run";
            if (json) writeResult(context, plan.report, "json");
            else print(chalk.green(`Creem already matches ${source.title}: nothing to write.`));
            if (refused.length)
              throw new CliError(
                `${refusedMessage}; nothing else was left to write.`,
                MIGRATION_EXIT_CODES.itemsFailed,
                FORCE_HINT,
              );
            return;
          }
          let write: boolean;
          try {
            write =
              Boolean(globals.yes) ||
              (await context.confirm(`${environment}: Write this plan to Creem?`));
          } catch {
            throw new CliError("Migration canceled.");
          }
          if (!write) throw new CliError("Migration canceled.");

          print(chalk.bold("Writing… (each write runs as a dry run first)"));
          let report: MigrationReport;
          try {
            report = await executeMigration(client, plan, {
              files: read.files,
              delayMs: 100,
              secrets: [...context.secrets],
              force: options.force,
              onProgress: (item, request) =>
                print(chalk.dim(`  ${request.type.replace(/_/g, " ")} ${item.key}`)),
            });
          } catch (error) {
            if (error instanceof DryRunIgnoredError || error instanceof RateLimitWaitError) {
              // What the run wrote before it stopped.
              if (error.report) {
                if (json) writeResult(context, error.report, "json");
                else
                  for (const line of formatReport(error.report, environment, source.title))
                    print(line);
              }
              throw new CliError(
                error.message,
                MIGRATION_EXIT_CODES.unexpected,
                error instanceof RateLimitWaitError
                  ? `Re-run in ${Math.ceil(error.waitMs / 1000)} s: written items are found by their key.`
                  : "Check the Creem environment and API version, then re-run: written items are found by their key.",
              );
            }
            throw error;
          }
          if (json) writeResult(context, report, "json");
          else {
            print();
            for (const line of formatReport(report, environment, source.title)) print(line);
            print();
            print(chalk.dim("Next steps:"));
            print(
              chalk.dim(
                "  • Review your products, product groups and discounts in the Creem dashboard.",
              ),
            );
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
  ${chalk.cyan("creem migrate lemon-squeezy")}    Migrate ${LS_SCOPE} from Lemon Squeezy

${chalk.dim("Options:")}
  --dry-run               Check the plan with Creem's dry run and write nothing
  --ls-api-key <key>      Provide the API key via flag (skips the prompt)
  --ls-store-id <id>      Lemon Squeezy store ID to migrate from
  --json                  Print the migration report as JSON (with --yes, run it)
  --exclude-discounts     Skip migrating discounts entirely
  --adopt [key=id|new]    Answer adoption proposals (alone: adopt every single match)
  --force                 Write even when Creem's check refuses items (they are left out)
  --yes                   Write without asking

${chalk.dim("Examples:")}
  ${chalk.cyan("creem migrate lemon-squeezy --dry-run")}          Print the plan
  ${chalk.cyan("creem migrate lemon-squeezy")}                    Print the plan, then ask before writing
  ${chalk.cyan("creem migrate lemon-squeezy --ls-api-key ls_xxx --ls-store-id 123 --yes")}  Non-interactive run
  ${chalk.cyan("creem migrate lemon-squeezy --json > plan.json")} Export the plan as JSON
`,
    );
  command.addCommand(createSourceCommand(context, lemonSqueezy));
  return command;
}
