import { Command, Option } from "commander";
import chalk from "chalk";
import type { Creem } from "creem";
import * as components from "creem/models/components";
import type { CliContext, Choice } from "../lib/context";
import { CliError } from "../lib/errors";
import { decode } from "../lib/operation";
import { readData } from "../lib/input";
import {
  isPossibleRename,
  isUnfinished,
  liveOnlyMetadataKeys,
  parseSelect,
  PromoteInterruptedError,
  runPromote,
  type PromoteItem,
  type PromoteReport,
  type PromoteRequest,
} from "../lib/catalog/promote";
import {
  copyLiveMetadata,
  LinkPartialError,
  linkFeature,
  linkItem,
  proposeFeatureKey,
  proposeItemKey,
  readFeatureLink,
  readItem,
  unlinkItem,
  type Clients,
  type FeatureLink,
  type LinkReport,
  type PairKind,
} from "../lib/catalog/pairing";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";

/**
 * ENG-2437: `creem catalog promote`, `link` and `unlink` (ADR catalog-as-code
 * § 2.6, § 2.10). Promote copies the store's test catalog into live through
 * `POST /v1/catalog/promote`; `link` and `unlink` pair a test and a live item
 * by giving both the same `external_id`, through each side's own write.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** `1. prod_l2 "Team" (no key), differs in price` */
function candidateLine(
  index: number,
  candidate: { liveId: string; name: string; externalId: string | null; differences?: string[] },
): string {
  const differences = candidate.differences?.length
    ? `, differs in ${candidate.differences.join(", ")}`
    : "";
  return `${index + 1}. ${candidate.liveId} "${candidate.name}" (${candidate.externalId ? `key ${candidate.externalId}` : "no key"})${differences}`;
}

const show = (value: unknown) => (value === undefined ? "null" : JSON.stringify(value));

/** One item as terminal lines: its result, then what it changes, its error or its candidates. */
function itemLines(item: PromoteItem, dryRun: boolean): string[] {
  // A dry run's created item carries an id that is never stored.
  const live = dryRun && item.result === "created" ? "new" : item.liveId;
  const head = `${item.kind.padEnd(7)} ${item.testId}${live ? ` → ${live}` : ""}  ${item.result}${
    item.blockedBy ? ` by ${item.blockedBy.kind} ${item.blockedBy.testId}` : ""
  }`;
  const lines = [head];
  const writeResult = item.writeResult;
  if (Array.isArray(writeResult?.changes))
    for (const change of writeResult.changes as { path?: unknown; from?: unknown; to?: unknown }[])
      lines.push(`    ${String(change.path)}: ${show(change.from)} → ${show(change.to)}`);
  if (Array.isArray(writeResult?.warnings))
    for (const warning of writeResult.warnings as { code?: unknown; path?: unknown }[])
      lines.push(
        warning.code === "possible_rename"
          ? "    possible_rename: live has items with its name; promote creates a second one unless it is re-paired"
          : `    warning ${String(warning.code)}${warning.path ? ` (${String(warning.path)})` : ""}`,
      );
  if (item.error) lines.push(`    ${item.error.code ?? "error"}: ${item.error.message}`);
  if (item.result === "needs_key" && item.proposedExternalId)
    lines.push(`    proposed key ${item.proposedExternalId}`);
  (item.candidates ?? []).forEach((candidate, index) =>
    lines.push(`    ${candidateLine(index, candidate)}`),
  );
  for (const feature of item.featureCandidates ?? []) {
    lines.push(
      `    feature ${feature.testFeatureId} "${feature.description}" (${feature.type}) needs a key, proposed ${feature.proposedExternalId}`,
    );
    feature.candidates.forEach((candidate, index) =>
      lines.push(
        `      ${index + 1}. ${candidate.liveFeatureId} "${candidate.description}" (${candidate.externalId ? `key ${candidate.externalId}` : "no key"})`,
      ),
    );
  }
  return lines;
}

function reportLines(report: PromoteReport, interrupted = false): string[] {
  const s = report.summary;
  const lines = [
    chalk.bold(
      `${report.dryRun ? "Promote dry run" : "Promote run"} (run ${report.runId})${interrupted ? ", interrupted" : ""}`,
    ),
    `Created ${s.created} · Updated ${s.updated} · Unchanged ${s.unchanged} · Needs key ${s.needsKey} · Conflict ${s.conflict} · Failed ${s.failed} · Blocked ${s.blocked} · Not written ${s.notWritten}`,
  ];
  const v = report.validation;
  if (v)
    lines.push(
      `Check: ${v.passed === true ? "passed" : v.passed === false ? "refused at least one write" : "not finished"} (${v.checkedBatches} of ${v.batches} batches, ${v.scope}); ${
        v.written === true
          ? "the run wrote"
          : v.written === false
            ? "nothing was written"
            : "nothing written yet"
      }.`,
    );
  for (const item of report.items) lines.push(...itemLines(item, report.dryRun));
  return lines;
}

/** Exit 4 when an item ends `failed`, `conflict`, `blocked` or `needs_key`. */
function finish(report: PromoteReport): void {
  const unfinished = report.items.filter(isUnfinished);
  if (!unfinished.length) return;
  const counts = ["needs_key", "conflict", "failed", "blocked"]
    .map((result) => [result, unfinished.filter((i) => i.result === result).length] as const)
    .filter(([, n]) => n > 0)
    .map(([result, n]) => `${n} ${result}`)
    .join(", ");
  const hints: string[] = [];
  if (report.validation?.written === false)
    hints.push(
      "The check refused an item, so nothing was written: fix it, or send --force to write the others.",
    );
  if (unfinished.some((i) => i.result === "needs_key"))
    hints.push(
      "Give each needs_key item its key with creem catalog link, or run creem catalog promote in a terminal to pick one.",
    );
  if (unfinished.some((i) => liveOnlyMetadataKeys(i).length))
    hints.push(
      "For live_metadata_not_in_test, set the keys on the test product (the terminal flow offers to copy them), or clear them on live.",
    );
  if (unfinished.some((i) => i.result === "blocked"))
    hints.push("A blocked product waits for its meter: give the meter a key and promote it too.");
  throw new CliError(
    `${report.dryRun ? "The dry run" : "The run"} ended with ${counts} (run ${report.runId}).`,
    4,
    hints.join(" ") || "Check each item's error above, then promote again.",
  );
}

/** The request from `--data`, or from `--select` and `--force`. */
async function promoteRequest(
  opts: Record<string, any>,
  context: CliContext,
): Promise<PromoteRequest> {
  if (opts.data !== undefined) {
    if (opts.select !== undefined || opts.force !== undefined)
      throw new CliError("--data cannot be combined with --select or --force.");
    const request = decode(
      components.CatalogPromoteRequestDto$outboundSchema,
      components.CatalogPromoteRequestDto$inboundSchema,
      await readData(opts.data, context.stdin),
    );
    if (request.cursor != null)
      throw new CliError("--data cannot carry a cursor: the command follows next_cursor itself.");
    return { select: request.select, force: request.force };
  }
  return { select: parseSelect(opts.select), force: opts.force === true };
}

interface Session {
  context: CliContext;
  live: Creem;
  test?: Creem;
  /** Decisions already made in this session, so a re-run dry run doesn't ask again. */
  decided: Set<string>;
}
const testClient = async (session: Session, timeout?: number) =>
  (session.test ??= await session.context.clientFor("test", { timeout }));
const clientsOf = async (session: Session): Promise<Clients> => ({
  live: session.live,
  test: await testClient(session),
});

function printLink(context: CliContext, report: LinkReport): void {
  context.stdout(
    [
      `Key ${report.key}`,
      ...(report.live ? [`LIVE ${report.live.id}: ${report.live.result}`] : []),
      `TEST ${report.test.id}: ${report.test.result}`,
    ].join("\n") + "\n",
  );
}

/** One side of a pairing question: `LIVE prod_l2` and the key it has now. */
interface QuestionSide {
  label: string;
  externalId: string | null | undefined;
}
const currentKey = (side: QuestionSide) =>
  side.externalId ? `currently ${side.externalId}` : "no key";

/**
 * The question before a pairing write. It names the key each item has now,
 * so re-keying an item that is already paired is visible before it happens.
 */
function pairQuestion(key: string, live: QuestionSide | null, test: QuestionSide): string {
  return live
    ? `Write the key ${key} on ${live.label} (${currentKey(live)}), then on ${test.label} (${currentKey(test)})?`
    : `Write the key ${key} on ${test.label} (${currentKey(test)})?`;
}

/** The question before a feature's pairing write, with each feature's current key. */
function featureQuestion(link: FeatureLink, key: string): string {
  const test = {
    label: `TEST feature ${link.testFeature.id} of ${link.testProduct.id}`,
    externalId: link.testFeature.externalId,
  };
  return link.liveFeature
    ? pairQuestion(
        key,
        {
          label: `LIVE feature ${link.liveFeature.id} of ${link.liveProduct.id}`,
          externalId: link.liveFeature.externalId,
        },
        test,
      )
    : pairQuestion(key, null, test);
}

type Pick =
  | { action: "pair"; liveId: string }
  | { action: "test-only" }
  | { action: "skip" }
  | { action: "create" };

/** A keyless item: pick a live candidate or none, confirm the key, and write it on both sides. */
async function pickItemKey(session: Session, item: PromoteItem): Promise<boolean> {
  const { context } = session;
  const kind = item.kind as PairKind;
  const clients = await clientsOf(session);
  const test = await readItem(clients.test, kind, item.testId);
  const candidates = item.candidates ?? [];
  const choices: Choice<Pick>[] = [
    ...candidates.map((candidate, index) => ({
      name: candidateLine(index, candidate),
      value: { action: "pair", liveId: candidate.liveId } as Pick,
    })),
    {
      name: `No live match: give ${item.testId} a key on test, and promote creates it in live`,
      value: { action: "test-only" },
    },
    { name: "Skip for now", value: { action: "skip" } },
  ];
  const pick = await context.choose(`${item.testId} "${test.name}" needs a key`, choices);
  if (pick.action === "pair") {
    const candidate = candidates.find((c) => c.liveId === pick.liveId);
    const key = await context.ask(
      `Key for ${item.testId} and ${pick.liveId}`,
      candidate?.externalId ?? item.proposedExternalId ?? item.testId,
    );
    const question = pairQuestion(
      key,
      { label: `LIVE ${pick.liveId}`, externalId: candidate?.externalId },
      { label: `TEST ${item.testId}`, externalId: test.externalId },
    );
    if (!(await context.confirm(question))) return false;
    printLink(
      context,
      await linkItem(clients, { kind, testId: item.testId, liveId: pick.liveId, key }),
    );
    return true;
  }
  if (pick.action === "test-only") {
    const key = await context.ask(`Key for ${item.testId}`, item.proposedExternalId ?? item.testId);
    const question = pairQuestion(key, null, {
      label: `TEST ${item.testId}`,
      externalId: test.externalId,
    });
    if (!(await context.confirm(question))) return false;
    printLink(context, await linkItem(clients, { kind, testId: item.testId, key }));
    return true;
  }
  return false;
}

/**
 * A matched product whose features need keys: one pick per feature. True
 * after the first write, so the dry run runs again before the next feature's
 * question (its candidates may have changed).
 */
async function pickFeatureKeys(session: Session, item: PromoteItem): Promise<boolean> {
  const { context, decided } = session;
  for (const feature of item.featureCandidates ?? []) {
    const decision = `feature:${item.testId}:${feature.testFeatureId}`;
    if (decided.has(decision)) continue;
    decided.add(decision);
    const choices: Choice<Pick>[] = [
      ...feature.candidates.map((candidate, index) => ({
        name: `${index + 1}. ${candidate.liveFeatureId} "${candidate.description}" (${candidate.externalId ? `key ${candidate.externalId}` : "no key"})`,
        value: { action: "pair", liveId: candidate.liveFeatureId } as Pick,
      })),
      {
        name: `No live match: give it a key on test, and promote creates it in live`,
        value: { action: "test-only" },
      },
      { name: "Skip for now", value: { action: "skip" } },
    ];
    const pick = await context.choose(
      `Feature ${feature.testFeatureId} "${feature.description}" of ${item.testId} needs a key`,
      choices,
    );
    if (pick.action !== "pair" && pick.action !== "test-only") continue;
    const clients = await clientsOf(session);
    const link = await readFeatureLink(clients, {
      testProductId: item.testId,
      testFeatureId: feature.testFeatureId,
      liveFeatureId: pick.action === "pair" ? pick.liveId : undefined,
    });
    const target = link.liveFeature
      ? `${feature.testFeatureId} and ${link.liveFeature.id}`
      : feature.testFeatureId;
    const key = await context.ask(
      `Key for ${target}`,
      proposeFeatureKey(link.testFeature, link.liveFeature),
    );
    const question = featureQuestion(link, key);
    if (!(await context.confirm(question))) continue;
    printLink(context, await linkFeature(clients, link, key));
    return true;
  }
  return false;
}

/** A keyed item without a live match that has same-name live items: create it, or re-pair. */
async function pickRename(session: Session, item: PromoteItem): Promise<boolean> {
  const { context } = session;
  const kind = item.kind as PairKind;
  const clients = await clientsOf(session);
  const test = await readItem(clients.test, kind, item.testId);
  const key = test.externalId ?? item.testId;
  const candidates = item.candidates ?? [];
  const pick = await context.choose<Pick>(
    `${item.testId} "${test.name}" has no live match, but live has items with its name. Create it, or re-pair it with one of them?`,
    [
      { name: `Create a new live ${kind} with the key ${key}`, value: { action: "create" } },
      ...candidates.map((candidate, index) => ({
        name: `Re-pair: ${candidateLine(index, candidate)}`,
        value: { action: "pair", liveId: candidate.liveId } as Pick,
      })),
    ],
  );
  if (pick.action !== "pair") return false;
  const question = pairQuestion(
    key,
    {
      label: `LIVE ${pick.liveId}`,
      externalId: candidates.find((c) => c.liveId === pick.liveId)?.externalId,
    },
    { label: `TEST ${item.testId}`, externalId: test.externalId },
  );
  if (!(await context.confirm(question))) return false;
  printLink(
    context,
    await linkItem(clients, { kind, testId: item.testId, liveId: pick.liveId, key }),
  );
  return true;
}

/** Q102: offers to copy live-only metadata keys into test, which promote can't write. */
async function offerMetadataCopy(
  session: Session,
  item: PromoteItem,
  keys: string[],
): Promise<boolean> {
  const { context } = session;
  if (!item.liveId) return false;
  if (
    !(await context.confirm(
      `Copy the live-only metadata ${keys.length === 1 ? "key" : "keys"} ${keys.join(", ")} of LIVE ${item.liveId} into TEST ${item.testId}?`,
    ))
  )
    return false;
  const copied = await copyLiveMetadata(await clientsOf(session), item.testId, item.liveId, keys);
  if (!copied.length) return false;
  context.stdout(`Copied ${copied.join(", ")} into TEST ${item.testId}\n`);
  return true;
}

/**
 * The decisions a dry run asks for, once per session. True as soon as one
 * wrote: the dry run runs again before the next question, because a write can
 * change other items' candidates (a live item just paired is no longer free).
 */
async function decide(session: Session, preview: PromoteReport): Promise<boolean> {
  const ask = async (decision: string, run: () => Promise<boolean>) => {
    if (session.decided.has(decision)) return false;
    session.decided.add(decision);
    return run();
  };
  for (const item of preview.items) {
    const keys = liveOnlyMetadataKeys(item);
    const wrote =
      item.result === "needs_key" && item.featureCandidates?.length
        ? await pickFeatureKeys(session, item)
        : item.result === "needs_key"
          ? await ask(`key:${item.kind}:${item.testId}`, () => pickItemKey(session, item))
          : isPossibleRename(item)
            ? await ask(`rename:${item.kind}:${item.testId}`, () => pickRename(session, item))
            : keys.length
              ? await ask(`metadata:${item.testId}:${keys.join(",")}`, () =>
                  offerMetadataCopy(session, item, keys),
                )
              : false;
    if (wrote) return true;
  }
  return false;
}

const WRITTEN_RESULTS = ["created", "updated", "unchanged"];

/**
 * Promote's wait per page when --timeout isn't given. A page takes up to 25 s
 * of work by default and up to 45 s, its last step runs to its end, and a dry
 * run's batch transaction can take 15 s more: the 30 s of other commands is
 * shorter than one page.
 */
export const PROMOTE_TIMEOUT_MS = 90_000;

async function promoteCommand(command: Command, context: CliContext): Promise<void> {
  const opts = command.optsWithGlobals();
  const format = outputFormat(command);
  const machine = format !== "table";
  if (opts.environment === "test")
    throw new CliError(
      "Promote runs on live: it copies the store's test catalog into live.",
      2,
      "Leave out --environment test; promote uses the store's live key (CREEM_LIVE_API_KEY).",
    );
  const request = await promoteRequest(opts, context);
  const dryRunOnly = opts.dryRun === true;
  const interactive = context.isTTY && !machine && !opts.yes && !dryRunOnly;
  if (!dryRunOnly && !interactive && !opts.yes)
    throw new CliError(
      "catalog promote writes to live and requires --yes in non-interactive or machine-output mode.",
      2,
      "Preview it with --dry-run, run it in a terminal, or confirm the real run with --yes.",
    );
  const timeoutMs: number = opts.timeout ?? PROMOTE_TIMEOUT_MS;
  const live = await context.clientFor("live", { timeout: opts.timeout });
  const print = (report: PromoteReport) => {
    if (!machine) context.stdout(reportLines(report).join("\n") + "\n");
  };
  const output = (preview: PromoteReport | null, run: PromoteReport | null) => {
    if (machine) writeResult(context, { preview, run }, "json");
  };
  /**
   * One run over every page. A run that stops after its first page prints
   * (or writes as JSON) what it got, with its run_id and cursor, before the
   * error ends the command with exit 4.
   */
  const promote = async (
    promoteRequest: PromoteRequest,
    dryRun: boolean,
    preview: PromoteReport | null = null,
  ): Promise<PromoteReport> => {
    try {
      return await runPromote(live, promoteRequest, dryRun, { timeoutMs });
    } catch (error) {
      if (error instanceof PromoteInterruptedError) {
        if (!machine) context.stdout(reportLines(error.report, true).join("\n") + "\n");
        if (dryRun) output(error.report, null);
        else output(preview, error.report);
      }
      throw error;
    }
  };

  if (dryRunOnly) {
    const preview = await promote(request, true);
    print(preview);
    output(preview, null);
    finish(preview);
    return;
  }

  let preview: PromoteReport;
  let force = request.force === true;
  if (interactive) {
    const session: Session = { context, live, decided: new Set() };
    for (;;) {
      preview = await promote(request, true);
      print(preview);
      if (!(await decide(session, preview))) break;
    }
    const writable = preview.items.filter((i) => WRITTEN_RESULTS.includes(i.result));
    if (!writable.length) {
      context.stdout("Nothing to promote.\n");
      finish(preview);
      return;
    }
    const counts = WRITTEN_RESULTS.map(
      (result) => [result, writable.filter((i) => i.result === result).length] as const,
    )
      .filter(([, n]) => n > 0)
      .map(([result, n]) => `${n} ${result}`)
      .join(", ");
    const refused = preview.items.filter((i) => i.result === "conflict" || i.result === "failed");
    const question = refused.length
      ? `${plural(refused.length, "item")} ${refused.length === 1 ? "is" : "are"} refused (conflict or failed) and ${refused.length === 1 ? "stays" : "stay"} out; promote the other ${writable.length} to LIVE (${counts})?`
      : `Promote to LIVE: ${counts}?`;
    if (!(await context.confirm(question))) throw new CliError("Operation canceled.");
    // The merchant saw the refused items and confirmed the rest: the check mustn't hold them back.
    force ||= refused.length > 0;
  } else {
    preview = await promote(request, true);
    print(preview);
    const create = new Set<string>((opts.create as string[] | undefined) ?? []);
    const renames = preview.items.filter((i) => isPossibleRename(i) && !create.has(i.testId));
    if (renames.length) {
      output(preview, null);
      throw new CliError(
        `${plural(renames.length, "item")} may be renamed (possible_rename): ${renames.map((i) => i.testId).join(", ")}. --yes never decides that, so nothing was promoted.`,
        4,
        `Re-pair each with creem catalog link, run the command in a terminal to decide, or pass ${renames.map((i) => `--create ${i.testId}`).join(" ")} to create ${renames.length === 1 ? "it" : "them"} in live.`,
      );
    }
  }
  const run = await promote({ ...request, force }, false, preview);
  print(run);
  output(preview, run);
  finish(run);
}

const collect = (value: string, previous: string[] = []) => [...previous, value];

/** Wraps a pairing write so a half-done pair still prints what was written. */
async function reportLink(
  context: CliContext,
  machine: boolean,
  write: () => Promise<LinkReport>,
): Promise<void> {
  try {
    const report = await write();
    if (machine) writeResult(context, report, "json");
    else printLink(context, report);
  } catch (error) {
    if (error instanceof LinkPartialError && machine) writeResult(context, error.report, "json");
    throw error;
  }
}

function requireAnswerable(
  context: CliContext,
  machine: boolean,
  opts: Record<string, any>,
): boolean {
  const terminal = context.isTTY && !machine;
  if (!terminal && !opts.yes)
    throw new CliError(
      "This command writes and requires --yes in non-interactive or machine-output mode.",
      2,
      "Run it in a terminal to confirm, or add --yes.",
    );
  return terminal;
}

async function linkCommand(command: Command, context: CliContext): Promise<void> {
  const opts = command.optsWithGlobals();
  // --key is a secret elsewhere (a license key); here it's an external_id the merchant reads back.
  if (typeof opts.key === "string") context.secrets.delete(opts.key);
  const machine = outputFormat(command) !== "table";
  const kind: "product" | "meter" | "feature" = opts.kind;
  const terminal = requireAnswerable(context, machine, opts);
  if (opts.key === undefined && !terminal)
    throw new CliError(
      "--key is required in non-interactive or machine-output mode: --yes never confirms a key.",
      2,
      "Pass --key, or run the command in a terminal to confirm the proposed key.",
    );
  if (kind === "feature" && opts.product === undefined)
    throw new CliError("--kind feature needs --product <test product id>.");
  if (kind !== "feature" && opts.product !== undefined)
    throw new CliError("--product applies to --kind feature only.");
  // A test-only key (no --live) is written through the test client alone.
  const needsLive = opts.live !== undefined;
  const clients: Clients = {
    test: await context.clientFor("test", { timeout: opts.timeout }),
    live: needsLive
      ? await context.clientFor("live", { timeout: opts.timeout })
      : (undefined as never),
  };
  const confirm = async (question: string) => {
    if (!opts.yes && !(await context.confirm(question))) throw new CliError("Operation canceled.");
  };
  if (kind === "feature") {
    const link = await readFeatureLink(clients, {
      testProductId: opts.product,
      testFeatureId: opts.test,
      liveFeatureId: opts.live,
    });
    const target = link.liveFeature ? `${opts.test} and ${link.liveFeature.id}` : opts.test;
    const key: string =
      opts.key ??
      (await context.ask(
        `Key for ${target}`,
        proposeFeatureKey(link.testFeature, link.liveFeature),
      ));
    await confirm(featureQuestion(link, key));
    await reportLink(context, machine, () => linkFeature(clients, link, key));
    return;
  }
  const test = await readItem(clients.test, kind, opts.test);
  const live = opts.live !== undefined ? await readItem(clients.live, kind, opts.live) : null;
  const key: string =
    opts.key ??
    (await context.ask(
      live ? `Key for ${test.id} and ${live.id}` : `Key for ${test.id}`,
      proposeItemKey(live, test.id),
    ));
  await confirm(
    pairQuestion(key, live && { label: `LIVE ${live.id}`, externalId: live.externalId }, {
      label: `TEST ${test.id}`,
      externalId: test.externalId,
    }),
  );
  await reportLink(context, machine, () =>
    linkItem(clients, { kind, testId: test.id, liveId: live?.id, key }),
  );
}

async function unlinkCommand(command: Command, context: CliContext): Promise<void> {
  const opts = command.optsWithGlobals();
  const machine = outputFormat(command) !== "table";
  requireAnswerable(context, machine, opts);
  const kind: PairKind = opts.kind;
  const live = await context.clientFor("live", { timeout: opts.timeout });
  const item = await readItem(live, kind, opts.live);
  if (
    !opts.yes &&
    !(await context.confirm(
      `Clear the key ${item.externalId ?? "(none)"} on LIVE ${item.id}? Its test item is no longer paired.`,
    ))
  )
    throw new CliError("Operation canceled.");
  const write = await unlinkItem(live, kind, item.id);
  const report = { kind, previousKey: item.externalId, live: write };
  if (machine) writeResult(context, report, "json");
  else
    context.stdout(
      `LIVE ${write.id}: ${write.result} (key ${item.externalId ?? "none"} cleared)\n`,
    );
}

/**
 * Gives `creem catalog` its promote flow (the manifest's `promote` command,
 * whose generic action would send one page) and the `link` and `unlink`
 * commands.
 */
export function extendCatalogCommand(root: Command, context: CliContext): void {
  const promote = root.commands.find((c) => c.name() === "promote");
  if (promote) {
    promote
      .description(
        "Promote the test catalog (meters and products) to live, paired by key: a dry run first, every page",
      )
      .option(
        "--select <kind=all|ids>",
        "What to promote: meters=all, products=<test id>,<test id> (repeatable; default: everything)",
        collect,
      )
      .option(
        "--create <test-id>",
        "Create this keyed item in live although live has items with its name (possible_rename; repeatable)",
        collect,
      )
      .addHelpText(
        "after",
        "\nWithout --yes it runs the dry run, asks for each item's key and each possible rename, then asks before the real run.\n--yes confirms the real run, never a key. Exit 4 when an item ends failed, conflict, blocked or needs_key.\nUses the store's live key (CREEM_LIVE_API_KEY, or the current key when it is live); pairing writes also need its test key (CREEM_TEST_API_KEY).\n--timeout defaults to 90 s per page here, not 30 s: a promote page can take up to 45 s of work on Creem's side.",
      )
      .action(async (...args: unknown[]) => promoteCommand(args.at(-1) as Command, context));
    const force = promote.options.find((option) => option.long === "--force");
    if (force)
      force.description =
        "Real run: write the other items even when the check before the first write refuses one";
  }
  root.addCommand(
    addGlobalOptions(new Command("link"))
      .description(
        "Pair a test and a live item by writing the same key (external_id) on both, live first",
      )
      .addOption(
        new Option("--kind <kind>", "What to pair")
          .choices(["product", "meter", "feature"])
          .makeOptionMandatory(),
      )
      .requiredOption("--test <id>", "The test item (for a feature: the test feature's id)")
      .option(
        "--live <id>",
        "The live item (for a feature: the live feature's id); leave out to key test only",
      )
      .option("--product <id>", "For --kind feature: the test product whose feature this is")
      .option("--key <key>", "The key; without it the command proposes one and asks")
      .action(async (...args: unknown[]) => linkCommand(args.at(-1) as Command, context)),
  );
  root.addCommand(
    addGlobalOptions(new Command("unlink"))
      .description("Break a pair by clearing the live item's key")
      .addOption(
        new Option("--kind <kind>", "What to unpair")
          .choices(["product", "meter"])
          .makeOptionMandatory(),
      )
      .requiredOption("--live <id>", "The live item")
      .action(async (...args: unknown[]) => unlinkCommand(args.at(-1) as Command, context)),
  );
}
