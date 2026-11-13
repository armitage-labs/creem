import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Turns Speakeasy's SDK change report (`speakeasy diff files ... -l typescript`,
// changes.md) into the release level, the changeset and the pull request body
// for .github/workflows/openapi-sync.yml. Speakeasy decides what is breaking;
// this script only reads its markers, so the level follows Speakeasy's rules
// unless a reviewer overrides it with a label on the pull request.

const BREAKING = "(Breaking ⚠️)";
const CHANGE = /\*\*(Added|Changed|Removed)\*\*/;
const METHOD = /^\* `([^`]+)`:\s*(.*)$/;
const ITEM = /^(\s*)[*-]\s+(.*)$/;
const ENUM_VALUE = /^`[^`]*\.enum\(([^)]+)\)` \*\*(Added|Removed)\*\*$/;
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
export const LEVELS = ["patch", "minor", "major"];
export const LABEL_PREFIX = "sdk-release:";
// GitHub rejects pull request bodies above 65,536 characters.
const MAX_BODY = 60_000;

// One entry per SDK method: { method, items: [{ depth, text }] }.
export function parseSdkChanges(markdown) {
  const methods = [];
  for (const line of markdown.split("\n")) {
    const method = line.match(METHOD);
    if (method) {
      const entry = { method: method[1], items: [] };
      if (method[2].trim()) entry.items.push({ depth: 0, text: method[2].trim() });
      methods.push(entry);
      continue;
    }
    const item = line.match(ITEM);
    if (item && methods.length) {
      methods.at(-1).items.push({ depth: item[1].length, text: item[2].trim() });
    }
  }
  return methods;
}

// The same enum value reaches many methods through different paths
// (`features[].type` and `product.union(ProductEntity).features[].type`);
// report it once. The report does not say whether it is a request or a
// response enum, so the line does not either.
function groupKey(change) {
  const enumValue = change.match(ENUM_VALUE);
  if (!enumValue) return change;
  const verb = enumValue[2] === "Added" ? "New" : "Removed";
  return `${verb} enum value \`${enumValue[1]}\``;
}

// The breaking changes Speakeasy reported, grouped so one new enum value
// reported on fifteen methods is one line for the reviewer.
export function breakingChanges(methods) {
  const groups = new Map();
  for (const { method, items } of methods) {
    items.forEach((item, index) => {
      if (!item.text.includes(BREAKING)) return;
      const children = [];
      for (const next of items.slice(index + 1)) {
        if (next.depth <= item.depth) break;
        children.push(next);
      }
      // A parent such as "`response` **Changed** (Breaking)" only says that a
      // child is breaking; report the child that is.
      if (children.some((child) => child.text.includes(BREAKING))) return;
      const key = groupKey(item.text.replace(BREAKING, "").trim());
      if (!groups.has(key)) groups.set(key, []);
      if (!groups.get(key).includes(method)) groups.get(key).push(method);
    });
  }
  return [...groups].map(([change, methods]) => ({ change, methods }));
}

// Speakeasy's report covers SDK methods. A schema no operation references is
// still generated and exported (a new webhook event entity, for example). A
// generated file added without report entries is an addition (minor); one
// removed takes away an exported type (major). Modified files don't count:
// descriptions land in JSDoc comments.
export function releaseLevel(methods, { sdkFilesAdded = false, sdkFilesRemoved = [] } = {}) {
  const texts = methods.flatMap(({ items }) => items.map((item) => item.text));
  if (sdkFilesRemoved.length || texts.some((text) => text.includes(BREAKING))) return "major";
  if (methods.length || texts.some((text) => CHANGE.test(text))) return "minor";
  return sdkFilesAdded ? "minor" : "patch";
}

// A reviewer sets the level with a label such as `sdk-release:minor`. Labels
// are not commits, so overriding the level does not stop the daily update.
export function labelLevel(labels) {
  const levels = labels
    .filter((label) => label.startsWith(LABEL_PREFIX))
    .map((label) => label.slice(LABEL_PREFIX.length).trim())
    .filter((level) => LEVELS.includes(level));
  if (new Set(levels).size > 1) {
    throw new Error(`Conflicting release labels: ${levels.join(", ")}.`);
  }
  return levels[0] ?? "";
}

// Parameters the SDK passes by position. null means gen.yaml does not say, so
// the generator default applies; treat that as positional to stay on the safe side.
export function maxMethodParams(genYaml) {
  const match = genYaml.match(/^\s*maxMethodParams:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

function operations(spec) {
  const result = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      if (!HTTP_METHODS.has(method) || !operation?.operationId) continue;
      const parameters = [...(item.parameters ?? []), ...(operation.parameters ?? [])].filter(
        (parameter) => parameter && !parameter.$ref,
      );
      result.set(operation.operationId, {
        endpoint: `${method.toUpperCase()} ${path}`,
        parameters: parameters.map((parameter) => `${parameter.in}:${parameter.name}`),
      });
    }
  }
  return result;
}

// New path, query or header parameters on operations that already existed.
// Speakeasy reports them as additions, but with positional SDK arguments the
// trailing `options` argument moves one place for every new parameter.
export function newPositionalParameters(oldSpec, newSpec) {
  const before = operations(oldSpec);
  const found = [];
  for (const [operationId, operation] of operations(newSpec)) {
    const previous = before.get(operationId);
    if (!previous) continue;
    for (const parameter of operation.parameters) {
      if (parameter.startsWith("cookie:") || previous.parameters.includes(parameter)) continue;
      const [location, name] = parameter.split(/:(.*)/s);
      found.push({ operationId, endpoint: operation.endpoint, location, name });
    }
  }
  return found;
}

// No date or run-specific text: a rerun on the same contract must produce the
// same files, or every daily run would force-push the branch and restart CI.
export function renderChangeset(level) {
  return `---
"creem": ${level}
---

Regenerate the SDK from the live Creem API contract.
`;
}

function codeList(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function levelReason(level, breaking, sdkFilesAdded, sdkFilesRemoved, methods) {
  if (level === "major") {
    const lines = breaking.map(
      ({ change, methods }) =>
        `- ${change}, in ${methods.length === 1 ? "" : `${methods.length} methods: `}${codeList(methods)}`,
    );
    const removed = sdkFilesRemoved.map((file) => `- \`${file}\``);
    return [
      ...(lines.length ? ["Speakeasy marks these SDK changes as breaking:", "", ...lines, ""] : []),
      ...(removed.length
        ? [
            "These generated SDK files were removed, so code that imports their exports breaks:",
            "",
            ...removed,
            "",
          ]
        : []),
      "Typical causes: a new enum value in a response (code that handles every value no longer covers all of them), a removed or renamed type, or a field that became required. A major release also needs every non-workspace `creem` peer range (for example in the Convex integration) raised; the SDK cascade only bumps workspace dependencies.",
    ].join("\n");
  }
  if (level === "minor" && !methods.length && sdkFilesAdded) {
    return "Speakeasy's report lists no method changes, but generated SDK files were added, for example a new exported model that no operation references yet.";
  }
  if (level === "minor") {
    return "Speakeasy reports SDK additions or changes and nothing breaking.";
  }
  return "Speakeasy reports no SDK changes and no generated files were added or removed; only descriptions, examples or documentation comments changed.";
}

export function renderBody({
  level,
  suggestedLevel = level,
  breaking,
  positional,
  positionalLimit,
  sdkFilesAdded = false,
  sdkFilesRemoved = [],
  methods = [],
  docsError = "",
  changesetPath,
  report,
  specUrl,
  specSha256,
}) {
  const overridden = level !== suggestedLevel;
  const levelLine = overridden
    ? `> The changeset releases \`creem\` as **${level}**, set by the \`${LABEL_PREFIX}${level}\` label. Speakeasy's report suggests **${suggestedLevel}**.`
    : `> The changeset releases \`creem\` as **${level}**. The level comes from Speakeasy's SDK change report below: a change Speakeasy marks as breaking means major, any other SDK change means minor, and no SDK change means patch. Check the reason before merging.`;
  const sections = [
    "## Why",
    "",
    `The OpenAPI contract in \`packages/sdk/openapi.json\` differs from the live API at ${specUrl}. The daily OpenAPI sync regenerated the SDK, the docs copy of the contract and the API reference pages from the live contract (sha256 \`${specSha256}\`).`,
    "",
    `## Release level: \`${level}\``,
    "",
    "> [!IMPORTANT]",
    levelLine,
    `> To release at another level, add the label \`${LABEL_PREFIX}patch\`, \`${LABEL_PREFIX}minor\` or \`${LABEL_PREFIX}major\` to this pull request and run the OpenAPI Sync workflow (or wait for the next daily run). The label only works while this pull request has nothing but workflow commits. After you push a commit, edit the level in \`${changesetPath}\` instead; the workflow comments if a label and the changeset disagree.`,
    "",
    levelReason(suggestedLevel, breaking, sdkFilesAdded, sdkFilesRemoved, methods),
  ];

  if (positional.length && positionalLimit !== 0) {
    const limit =
      positionalLimit === null
        ? "passes parameters by position (`packages/sdk/.speakeasy/gen.yaml` sets no `maxMethodParams`, so the generator default applies)"
        : `passes up to ${positionalLimit} parameters by position (\`maxMethodParams\` in \`packages/sdk/.speakeasy/gen.yaml\`)`;
    sections.push(
      "",
      "## New positional parameters",
      "",
      "> [!WARNING]",
      `> Speakeasy reports these as additions, but the SDK ${limit}. Each new parameter moves the trailing \`options\` argument one place, so a caller that passes \`options\` breaks. Decide whether that makes this release major.`,
      "",
      ...positional.map(
        ({ operationId, endpoint, location, name }) =>
          `- \`${operationId}\` (\`${endpoint}\`): new ${location} parameter \`${name}\``,
      ),
    );
  }

  if (docsError.trim()) {
    sections.push(
      "",
      "## API reference pages not regenerated",
      "",
      "> [!WARNING]",
      "> `pnpm --dir packages/docs generate:api` failed, so the endpoint pages in this pull request are not regenerated, and `merge-gate` fails until the docs match the contract. A new endpoint needs an entry in `packages/docs/docs.json` navigation. A removed endpoint must lose its page and its navigation entry, so it does not stay published. Fix that in this pull request, then run the command again and commit the pages it writes.",
      "",
      "```text",
      docsError.trim().slice(0, 4000),
      "```",
    );
  }

  sections.push(
    "",
    "## If a check fails",
    "",
    "| Check | Meaning | Fix |",
    "| --- | --- | --- |",
    "| `merge-gate` build, typecheck or tests | The regenerated SDK breaks hand-written code (CLI, integrations) | Fix the code in this pull request |",
    "| `merge-gate` docs steps | API reference pages or navigation are out of date | Update `packages/docs` in this pull request |",
    "| `cli-parity` | The CLI does not cover new parameters or request bodies | Update the CLI manifest, flags and reference in this pull request |",
    "| The sync workflow itself (Speakeasy step) | Speakeasy cannot generate from the contract | Fix the API annotations in the backend; the next daily run picks the fix up |",
    "",
    "Do not edit `packages/sdk/openapi.json` here: the next run replaces it with the live contract. Once this pull request has a commit that the workflow did not make, the workflow stops updating it and comments instead.",
  );

  const header = sections.join("\n");
  const footer = [
    "",
    "## Speakeasy SDK change report",
    "",
    "<details>",
    "<summary>TypeScript SDK changes</summary>",
    "",
  ];
  const end = ["", "</details>", ""];
  const room = MAX_BODY - header.length - footer.join("\n").length - end.join("\n").length - 200;
  const trimmed = report.trim() || "No SDK-level changes.";
  const reportText =
    trimmed.length > room
      ? `${trimmed.slice(0, room)}\n\n… The report is truncated; the full report is attached to the workflow run.`
      : trimmed;
  return [header, ...footer, reportText, ...end].join("\n");
}

function readOptional(path) {
  return path && existsSync(path) ? readFileSync(path, "utf8") : "";
}

function lines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function main(argv = process.argv.slice(2)) {
  const args = Object.fromEntries(
    argv.map((arg) => {
      const match = arg.match(/^--([^=]+)=(.*)$/s);
      if (!match) throw new Error(`Unexpected argument: ${arg}`);
      return [match[1], match[2]];
    }),
  );
  for (const required of [
    "old",
    "new",
    "report",
    "gen-yaml",
    "changeset",
    "body",
    "spec-url",
    "spec-sha256",
  ]) {
    if (!args[required]) throw new Error(`Missing --${required}=...`);
  }
  const report = readFileSync(args.report, "utf8");
  const methods = parseSdkChanges(report);
  const sdkFilesAdded = args["sdk-files-added"] === "true";
  const sdkFilesRemoved = lines(readOptional(args["sdk-files-removed"]));
  const suggestedLevel = releaseLevel(methods, { sdkFilesAdded, sdkFilesRemoved });
  const override = labelLevel((args.labels ?? "").split(",").filter(Boolean));
  const level = override || suggestedLevel;
  const positionalLimit = maxMethodParams(readFileSync(args["gen-yaml"], "utf8"));
  const positional = newPositionalParameters(
    JSON.parse(readFileSync(args.old, "utf8")),
    JSON.parse(readFileSync(args.new, "utf8")),
  );
  writeFileSync(args.changeset, renderChangeset(level));
  writeFileSync(
    args.body,
    renderBody({
      level,
      suggestedLevel,
      breaking: breakingChanges(methods),
      positional,
      positionalLimit,
      sdkFilesAdded,
      sdkFilesRemoved,
      methods,
      docsError: readOptional(args["docs-error"]),
      changesetPath: args.changeset,
      report,
      specUrl: args["spec-url"],
      specSha256: args["spec-sha256"],
    }),
  );
  return level;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(main());
}
