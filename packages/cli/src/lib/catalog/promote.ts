import type { Creem } from "creem";
import type * as components from "creem/models/components";
import { CliError } from "../errors";

/**
 * `POST /v1/catalog/promote` from the CLI (ENG-2437, ADR catalog-as-code
 * § 2.10): one run over every page, and what its items say.
 */

export type PromoteItem = components.CatalogPromoteItemResponseDto;
export type PromoteSummary = components.CatalogPromoteSummaryResponseDto;
export type PromoteSelect = components.CatalogPromoteSelectRequestDto;

/** One promote run, every page together. */
export interface PromoteReport {
  runId: string;
  dryRun: boolean;
  /** The counts of every page, added up. */
  summary: PromoteSummary;
  items: PromoteItem[];
  /** The check before the real run's first write, as its last page answered it; null on a dry run. */
  validation: components.CatalogPromoteValidationResponseDto | null;
}

export interface PromoteRequest {
  select?: PromoteSelect | undefined;
  force?: boolean | undefined;
}

/** The results that leave the catalog unfinished: the exit code is 4 when an item ends with one. */
export const UNFINISHED_RESULTS = ["failed", "conflict", "blocked", "needs_key"] as const;

export const emptySummary = (): PromoteSummary => ({
  created: 0,
  updated: 0,
  unchanged: 0,
  needsKey: 0,
  conflict: 0,
  failed: 0,
  blocked: 0,
  notWritten: 0,
});

/** Creem answered a dry run as a real run (Q59): it may have written. */
export class PromoteDryRunIgnoredError extends CliError {
  constructor(where: string, answered: unknown) {
    super(
      `Creem answered the promote dry run with ${where} ${JSON.stringify(answered ?? null)} instead of true, so it may have written to live. The command stopped; no further page was requested.`,
      1,
      "Check the live catalog in the dashboard, and the API version, before running promote again.",
    );
    this.name = "PromoteDryRunIgnoredError";
  }
}

/** A dry-run page whose answer isn't a dry run, or whose item's write wasn't one. */
function assertDryRun(page: components.CatalogPromoteResponseDto): void {
  if (page.dryRun !== true) throw new PromoteDryRunIgnoredError("dry_run", page.dryRun);
  for (const item of page.items) {
    const writeResult = item.writeResult;
    if (writeResult !== undefined && writeResult.dry_run !== true)
      throw new PromoteDryRunIgnoredError(
        `write_result.dry_run on ${item.testId}`,
        writeResult.dry_run,
      );
  }
}

/**
 * Runs promote on live until `next_cursor` is null, sending the same `select`,
 * `dry_run` and `force` on every page. A dry run stops at the first page that
 * isn't one.
 */
export async function runPromote(
  live: Creem,
  request: PromoteRequest,
  dryRun: boolean,
  options: { timeoutMs?: number } = {},
): Promise<PromoteReport> {
  const summary = emptySummary();
  const items: PromoteItem[] = [];
  let validation: PromoteReport["validation"] = null;
  let runId = "";
  let cursor: string | null = null;
  do {
    const page: components.CatalogPromoteResponseDto = await live.catalog.promote(
      {
        ...(dryRun ? { dryRun: true } : {}),
        catalogPromoteRequestDto: {
          ...(request.select !== undefined ? { select: request.select } : {}),
          ...(request.force ? { force: true } : {}),
          ...(cursor !== null ? { cursor } : {}),
        },
      },
      { timeoutMs: options.timeoutMs, retries: { strategy: "none" } },
    );
    if (dryRun) assertDryRun(page);
    runId = page.runId;
    items.push(...page.items);
    for (const key of Object.keys(summary) as (keyof PromoteSummary)[])
      summary[key] += page.summary[key];
    if (page.validation !== null) validation = page.validation;
    cursor = page.nextCursor;
  } while (cursor !== null);
  return { runId, dryRun, summary, items, validation };
}

export const isUnfinished = (item: PromoteItem): boolean =>
  (UNFINISHED_RESULTS as readonly string[]).includes(item.result);

/** The warning on a keyed item without a live match that has same-name live items. */
export const isPossibleRename = (item: PromoteItem): boolean =>
  Array.isArray(item.writeResult?.warnings) &&
  item.writeResult.warnings.some(
    (warning: unknown) =>
      typeof warning === "object" &&
      warning !== null &&
      (warning as { code?: unknown }).code === "possible_rename",
  );

/** The `live_metadata_not_in_test` conflict's live-only keys (Q102); empty for any other item. */
export function liveOnlyMetadataKeys(item: PromoteItem): string[] {
  if (item.result !== "conflict" || item.error?.code !== "live_metadata_not_in_test") return [];
  const keys: unknown = item.error.details?.keys;
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
}

/** Parses `--select <kind>=all|<id>,<id>` values into promote's `select`. */
export function parseSelect(values: string[] | undefined): PromoteSelect | undefined {
  if (!values?.length) return undefined;
  const select: PromoteSelect = {};
  for (const value of values) {
    const match = /^(meters|products)=(.+)$/.exec(value);
    if (!match)
      throw new CliError(
        `Invalid --select ${value}.`,
        2,
        "Use --select meters=all, --select products=all or --select products=<test id>,<test id>.",
      );
    const kind = match[1] as keyof PromoteSelect;
    const ids = match[2]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (select[kind] !== undefined)
      throw new CliError(`--select ${kind} is given twice.`, 2, "Give each kind once.");
    select[kind] = ids.length === 1 && ids[0] === "all" ? "all" : ids;
  }
  return select;
}
