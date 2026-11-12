import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Turns Speakeasy's SDK change report (`speakeasy diff files ... -l typescript`,
// changes.md) into the release level, the changeset and the pull request body
// for .github/workflows/openapi-sync.yml. Speakeasy decides what is breaking;
// this script only reads its markers, so the level follows Speakeasy's rules.

const BREAKING = "(Breaking ⚠️)";
const CHANGE = /\*\*(Added|Changed|Removed)\*\*/;
const METHOD = /^\* `([^`]+)`:\s*(.*)$/;
const ITEM = /^(\s*)[*-]\s+(.*)$/;
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
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

// The breaking changes Speakeasy reported, grouped by change so one new enum
// value reported on fifteen methods is one line for the reviewer.
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
      const change = item.text.replace(BREAKING, "").trim();
      if (!groups.has(change)) groups.set(change, []);
      if (!groups.get(change).includes(method)) groups.get(change).push(method);
    });
  }
  return [...groups].map(([change, methods]) => ({ change, methods }));
}

export function releaseLevel(methods) {
  const texts = methods.flatMap(({ items }) => items.map((item) => item.text));
  if (texts.some((text) => text.includes(BREAKING))) return "major";
  if (methods.length || texts.some((text) => CHANGE.test(text))) return "minor";
  return "patch";
}

// Parameters the SDK passes by position while `maxMethodParams` is above zero.
export function maxMethodParams(genYaml) {
  const match = genYaml.match(/^\s*maxMethodParams:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : 0;
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

export function renderChangeset(level, date) {
  return `---
"creem": ${level}
---

Regenerate the SDK from the live Creem API contract (${date}).
`;
}

function codeList(values) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function levelReason(level, breaking) {
  if (level === "major") {
    const lines = breaking.map(
      ({ change, methods }) =>
        `- ${change}, in ${methods.length === 1 ? "" : `${methods.length} methods: `}${codeList(methods)}`,
    );
    return [
      "Speakeasy marks these SDK changes as breaking:",
      "",
      ...lines,
      "",
      "Typical causes: a new enum value in a response (code that handles every value no longer covers all of them), a removed or renamed type, or a field that became required. If the change is acceptable as a minor release, change the level in `.changeset/openapi-sync.md`.",
    ].join("\n");
  }
  if (level === "minor") {
    return "Speakeasy reports SDK additions or changes and nothing breaking.";
  }
  return "The SDK's methods and types do not change; only descriptions or examples in the contract changed.";
}

export function renderBody({
  level,
  breaking,
  positional,
  positionalLimit,
  report,
  specUrl,
  specSha256,
  date,
}) {
  const sections = [
    "## Why",
    "",
    `The OpenAPI contract in \`packages/sdk/openapi.json\` differs from the live API at ${specUrl}. The daily OpenAPI sync regenerated the SDK, the docs copy of the contract and the API reference pages from the live contract (${date}, sha256 \`${specSha256}\`).`,
    "",
    `## Release level: \`${level}\``,
    "",
    "> [!IMPORTANT]",
    `> The changeset releases \`creem\` as **${level}**. The level comes from Speakeasy's SDK change report below: a change Speakeasy marks as breaking means major, any other SDK change means minor, and no SDK change means patch. Check the reason before merging.`,
    "",
    levelReason(level, breaking),
  ];

  if (positional.length && positionalLimit > 0) {
    sections.push(
      "",
      "## New positional parameters",
      "",
      "> [!WARNING]",
      `> Speakeasy reports these as additions, but the SDK passes up to ${positionalLimit} parameters by position (\`maxMethodParams\` in \`packages/sdk/.speakeasy/gen.yaml\`). Each new parameter moves the trailing \`options\` argument one place, so a caller that passes \`options\` breaks. Decide whether that makes this release major.`,
      "",
      ...positional.map(
        ({ operationId, endpoint, location, name }) =>
          `- \`${operationId}\` (\`${endpoint}\`): new ${location} parameter \`${name}\``,
      ),
    );
  }

  sections.push(
    "",
    "## If a check fails",
    "",
    "| Check | Meaning | Fix |",
    "| --- | --- | --- |",
    "| `merge-gate` build, typecheck or tests | The regenerated SDK breaks hand-written code (CLI, integrations) | Fix the code in this pull request |",
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
  const date = args.date ?? new Date().toISOString().slice(0, 10);
  const report = readFileSync(args.report, "utf8");
  const methods = parseSdkChanges(report);
  const level = releaseLevel(methods);
  const positionalLimit = maxMethodParams(readFileSync(args["gen-yaml"], "utf8"));
  const positional = newPositionalParameters(
    JSON.parse(readFileSync(args.old, "utf8")),
    JSON.parse(readFileSync(args.new, "utf8")),
  );
  writeFileSync(args.changeset, renderChangeset(level, date));
  writeFileSync(
    args.body,
    renderBody({
      level,
      breaking: breakingChanges(methods),
      positional,
      positionalLimit,
      report,
      specUrl: args["spec-url"],
      specSha256: args["spec-sha256"],
      date,
    }),
  );
  return level;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(main());
}
