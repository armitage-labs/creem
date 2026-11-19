/**
 * The migration report, shared by every `creem migrate <source>` command.
 *
 * Its shape is a public contract (stdout JSON): change it only additively, and
 * bump `MIGRATION_REPORT_VERSION` for anything else. The Stripe migrator
 * (ENG-2012) reuses it as is.
 */
export const MIGRATION_REPORT_SCHEMA = "creem.migration_report";
export const MIGRATION_REPORT_VERSION = 1;

/**
 * Exit codes of a migration. 0–5 keep their meaning across the CLI
 * (`describeError`); 6 is specific to migrations.
 */
export const MIGRATION_EXIT_CODES = {
  /** Every item is created, updated, unchanged or skipped by a mapping rule. */
  ok: 0,
  /** Unexpected failure. */
  unexpected: 1,
  /** Invalid flags or input, a missing `--yes`, or a declined confirmation. */
  usage: 2,
  /** The source or Creem API key was refused. */
  auth: 3,
  /** The source could not be read completely; nothing was written. */
  sourceIncomplete: 4,
  /** Network failure before the run started. */
  network: 5,
  /** The run finished, and at least one item failed. Re-run to retry them. */
  itemsFailed: 6,
} as const;

export type MigrationItemKind = "product" | "product_group" | "discount" | "file";
/** What the plan does with an item. */
export type MigrationAction = "create" | "update" | "unchanged" | "skip";
/** `pending` until the run sends the item's requests; `null` for items without requests. */
export type MigrationItemStatus = "pending" | "done" | "failed" | null;

export interface MigrationIssue {
  code: string;
  message: string;
}
export interface MigrationError extends MigrationIssue {
  /** HTTP status of the failed Creem request, if there was one. */
  status: number | null;
  hint: string | null;
}

export interface MigrationItem {
  kind: MigrationItemKind;
  /** The Creem `external_id` the item is matched by. */
  key: string;
  name: string;
  /** The source object; `product_id` names the source product a variant belongs to. */
  source: { type: string; id: string; product_id?: string };
  action: MigrationAction;
  status: MigrationItemStatus;
  /** The matched or written Creem object. */
  creem_id: string | null;
  /** Set when an existing Creem object without a key is adopted (its key is PATCHed first). */
  adopted_from: string | null;
  /** Fields an `update` changes. */
  changes: string[];
  /** Product groups: the keys of their member products, in order. */
  members?: string[];
  /** Why the item is skipped. */
  reason: MigrationIssue | null;
  warnings: MigrationIssue[];
  error: MigrationError | null;
}

/** An existing Creem object without a key that looks like a source object. */
export interface AdoptionProposal {
  id: string;
  kind: "product" | "discount";
  key: string;
  creem_id: string;
  creem_name: string;
  match: string;
  decision: "pending" | "accepted" | "declined";
}

export interface MigrationReport {
  schema: typeof MIGRATION_REPORT_SCHEMA;
  version: typeof MIGRATION_REPORT_VERSION;
  source: {
    provider: string;
    store_id: string;
    store_name: string;
    currency: string;
  };
  /** `plan`: computed, not run; `dry_run`: `--dry-run`; `run`: requests were sent. */
  mode: "plan" | "dry_run" | "run";
  summary: MigrationSummary;
  items: MigrationItem[];
  proposals: AdoptionProposal[];
  /** Source data the command does not migrate, listed once per kind. */
  not_migrated: { kind: string; reason: MigrationIssue }[];
  /** Source reads that failed; the run refuses to write while there are any. */
  fetch_failures: { kind: string; message: string }[];
}

export interface MigrationSummary {
  create: number;
  update: number;
  unchanged: number;
  skip: number;
  failed: number;
  warnings: number;
}

export function summarize(items: MigrationItem[]): MigrationSummary {
  const summary: MigrationSummary = {
    create: 0,
    update: 0,
    unchanged: 0,
    skip: 0,
    failed: 0,
    warnings: 0,
  };
  for (const item of items) {
    summary[item.action] += 1;
    if (item.status === "failed") summary.failed += 1;
    summary.warnings += item.warnings.length;
  }
  return summary;
}

export function migrationExitCode(report: MigrationReport): number {
  if (report.fetch_failures.length) return MIGRATION_EXIT_CODES.sourceIncomplete;
  if (report.items.some((item) => item.status === "failed"))
    return MIGRATION_EXIT_CODES.itemsFailed;
  return MIGRATION_EXIT_CODES.ok;
}

export function newItem(
  fields: Pick<MigrationItem, "kind" | "key" | "name" | "source" | "action"> &
    Partial<MigrationItem>,
): MigrationItem {
  return {
    status: null,
    creem_id: null,
    adopted_from: null,
    changes: [],
    reason: null,
    warnings: [],
    error: null,
    ...fields,
  };
}
